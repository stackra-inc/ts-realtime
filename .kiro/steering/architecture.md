---
inclusion: always
---

# Architecture

## DI Pattern

This package follows the standard @stackra multi-connection DI pattern using
**connection** terminology:

- `RealtimeModule.forRoot(config)` — registers providers (global by default)
- `RealtimeManager` extends `MultipleInstanceManager<RealtimeConnection>` —
  orchestrates named connections
- `RealtimeFacade` — static-access facade for use outside DI
- Decorators: `@InjectRealtime(name?)`, `@InjectRealtimeManager()`
- React hooks: `useChannel(channel)`, `usePresence(channel)`,
  `useRealtime(name?)`

## Multi-Connection Support

Each configured connection has its own Echo instance. Connections are lazily
resolved via `manager.connection(name)` and cached.

```typescript
RealtimeModule.forRoot({
  default: "main",
  connections: {
    main: {
      broadcaster: "pusher",
      key: "app-key",
      host: "ws.example.com",
      authEndpoint: "/api/broadcasting/auth",
    },
  },
});
```

Per-connection DI tokens are registered as `RealtimeConnection:<name>` plus a
`RealtimeConnection:default` alias.

### Credential Gating

`RealtimeModule.hasCredentials()` checks for either Pusher
(`VITE_PUSHER_APP_KEY` + `VITE_PUSHER_HOST`) or Reverb (`VITE_REVERB_APP_KEY` +
`VITE_REVERB_HOST`). When both are missing, `forRoot()` returns an empty module
and logs a warning.

## Lifecycle Hooks

- `OnModuleInit` — eagerly resolves the default connection so WebSocket
  handshake errors surface at bootstrap
- `OnModuleDestroy` — disconnects all active channels and closes connections

## Key Services

- `RealtimeManager` — extends `MultipleInstanceManager<RealtimeConnection>`, DI
  entry point
- `LaravelEchoConnector` — factory producing `EchoConnection` instances, holds
  optional `dispatchFn` for auto-bridge
- `EchoConnection` — wraps Laravel Echo + Pusher, exposes `channel()`,
  `private()`, `presence()`, `leave()`, `socketId()`
- `ChannelWrapper` / `PresenceChannelWrapper` — typed wrappers for channel
  subscriptions
- `RedisConnector` / `RedisConnection` — alternative backend scaffolding

## DI Tokens

All tokens are `Symbol.for(...)` exported from
`src/constants/tokens.constant.ts`:

- `REALTIME_CONFIG` — raw `RealtimeConfig`
- `REALTIME_CONNECTOR` — connector factory
- `REALTIME_MANAGER` — `useExisting` alias to `RealtimeManager`
- `EVENT_MANAGER_TOKEN` (internal) — matches `@stackra/ts-events`
  `EVENT_EMITTER_MANAGER`
- `HTTP_MANAGER_TOKEN` (internal) — matches `@stackra/ts-http` `HTTP_MANAGER`
- `LOGGER_MANAGER_TOKEN` (internal) — matches `@stackra/ts-logger`
  `LOGGER_MANAGER`
- `REALTIME_AUTO_BRIDGE`, `REALTIME_HTTP_INTERCEPTOR` (internal provider
  markers)

Per-connection tokens are generated at runtime via
`getRealtimeConnectionToken(name)`.

## Error Handling

Typed error classes in `src/errors/`:

- `RealtimeError` — base class
- `RealtimeConnectionError` — connection lifecycle failures
- `RealtimeChannelError` — channel subscription/auth failures

All errors extend a base `RealtimeError` with:

- `code: string` for programmatic handling
- `cause?: Error` for chained errors
- `name: string` for identification

## Logger Integration (Optional)

`RealtimeManager` optionally injects `LoggerServiceInterface` from
`@stackra/ts-logger`:

- Falls back silently if logger package is not installed
- Uses `this.logger?.warn(...)` for reconnection warnings
- Use `this.logger?.channel('realtime').error(...)` for channel-specific
  failures

## Auto-Bridge and HTTP Interceptor

The `RealtimeModule` registers two internal providers that wire optional
integrations at bootstrap:

- **`REALTIME_AUTO_BRIDGE`** — when `@stackra/ts-events` is available, sets
  `LaravelEchoConnector.setDispatchFn()` so every channel event dispatches as
  `realtime:{channel}.{event}` via `EventEmitterManager.emit()`.
- **`REALTIME_HTTP_INTERCEPTOR`** — when `@stackra/ts-http` is available, wraps
  the default `HttpClient.request` to attach `X-Socket-Id` so the server can
  exclude the sender from broadcasts.

Both providers are dependency-free when their peer is missing (the factory
returns `null`/`true` silently).
