import { expect } from "bun:test"
import { Plugin } from "@opencode/core/plugin"
import { PluginHost } from "@opencode/core/plugin/host"
import { PluginPromise } from "@opencode/core/plugin/promise"
import { SessionNotFoundError } from "@opencode/plugin/effect"
import { Effect } from "effect"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

const removed = (context: Awaited<ReturnType<typeof PluginHost.make>>) =>
  Effect.gen(function* () {
    const session = yield* context.session.create({ title: "Transient session" })
    yield* context.session.remove({ sessionID: session.id })
    return session.id
  })

it.live("Effect plugins receive the published error when a session is missing", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const context = yield* PluginHost.make(plugins, "test")
    const sessionID = yield* removed(context)

    const error = yield* context.session.get({ sessionID }).pipe(Effect.flip)

    expect(error).toBeInstanceOf(SessionNotFoundError)
    expect(error._tag).toBe("SessionNotFoundError")
    expect(error.sessionID).toBe(sessionID)
    expect(error.message).toContain(sessionID)
  }),
)

it.live("Promise plugins reject with the published error when a session is missing", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const context = yield* PluginHost.make(plugins, "test")
    const sessionID = yield* removed(context)

    yield* PluginPromise.fromPromise({
      id: "test.session-not-found",
      async setup(ctx) {
        const error = await ctx.session.get({ sessionID }).then(
          () => undefined,
          (cause: unknown) => cause,
        )
        expect(error).toBeInstanceOf(SessionNotFoundError)
        expect((error as SessionNotFoundError)._tag).toBe("SessionNotFoundError")
        expect((error as SessionNotFoundError).sessionID).toBe(sessionID)
      },
    }).effect(context)
  }),
)
