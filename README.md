<p align="center">
  <a href="https://www.npmjs.com/package/@stackra/ts-realtime">
    <img src="https://img.shields.io/npm/v/@stackra/ts-realtime?style=flat-square&color=38bdf8&label=npm" alt="npm version" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-818cf8?style=flat-square" alt="MIT license" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-6.x-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
</p>

# @stackra/ts-realtime

Laravel Echo wrapper with typed channels, multi-connection support, and React
hooks for real-time WebSocket communication.

## Features

- Multiple named realtime connections (Pusher, Reverb, Redis-backed)
- Typed channels, private channels, and presence channels
- Typed event payloads via `RealtimeEvents`
- Automatic bridge into `@stackra/ts-events` — channel events become
  `realtime:{channel}.{event}`
- HTTP interceptor — adds `X-Socket-Id` to every outgoing request when
  `@stackra/ts-http` is present
- React hooks: `useChannel`, `usePresence`, `useRealtime`
- DI decorators: `@InjectRealtime(name?)`, `@InjectRealtimeManager()`

## Install

```bash
pnpm add @stackra/ts-realtime
```

### Peer Dependencies

Required:

- `@stackra/ts-container` — DI module, `@Module`, `@Injectable`, `@Inject`
- `@stackra/ts-support` — `MultipleInstanceManager`, `Facade`, `GlobalRegistry`

Optional:

- `@stackra/ts-events` — enables the `realtime:{channel}.{event}` auto-bridge
- `@stackra/ts-redis` — required only when using the Redis broadcaster backend
- `@stackra/ts-logger` — structured logging for reconnection warnings
- `react` ^19.2.5 — required only for the React hooks

## Quick Start

### 1. Register the module

```typescript
import { Module } from "@stackra/ts-container";
import { RealtimeModule } from "@stackra/ts-realtime";

@Module({
  imports: [
    RealtimeModule.forRoot({
      default: "main",
      connections: {
        main: {
          broadcaster: "pusher",
          key: import.meta.env.VITE_PUSHER_APP_KEY,
          host: import.meta.env.VITE_PUSHER_HOST,
          authEndpoint: "/api/broadcasting/auth",
        },
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Subscribe in a component

```tsx
import { useChannel } from "@stackra/ts-realtime";

export function OrdersFeed() {
  const channel = useChannel("orders");

  channel.listen("order-created", (payload: { id: string }) => {
    console.log("new order", payload.id);
  });

  return <div>Listening…</div>;
}
```

## Configuration

`RealtimeModule.forRoot(config)` accepts a `RealtimeConfig` with named
connections. Each connection config is keyed by `broadcaster` and mirrors
Laravel Echo options:

```typescript
RealtimeModule.forRoot({
  default: "main",
  connections: {
    main: {
      broadcaster: "pusher",
      key: "app-key",
      host: "ws.example.com",
      port: 443,
      forceTLS: true,
      authEndpoint: "/api/broadcasting/auth",
    },
    reverb: {
      broadcaster: "reverb",
      key: "reverb-key",
      host: "reverb.example.com",
    },
  },
});
```

### Credential Gating

`RealtimeModule.hasCredentials()` requires either Pusher
(`VITE_PUSHER_APP_KEY` + `VITE_PUSHER_HOST`) or Reverb (`VITE_REVERB_APP_KEY` +
`VITE_REVERB_HOST`) env vars. When missing, `forRoot()` returns an empty module
and logs a warning.

## Core Concepts

### RealtimeManager

`RealtimeManager` extends `MultipleInstanceManager<RealtimeConnection>` and
orchestrates `EchoConnection` instances. Each call to `manager.connection(name)`
returns a cached connection ready for `channel()`, `private()`, `presence()`,
and `leave()` calls.

### Auto-bridge

When `@stackra/ts-events` is installed and registered, `RealtimeModule` sets a
dispatch function on `LaravelEchoConnector`. Any channel event is then emitted
through `EventEmitterManager` as `realtime:{channel}.{event}`, so subscribers
can use `@OnEvent('realtime:orders.order-created')` without subscribing
manually.

### HTTP interceptor

When `@stackra/ts-http` is available, the module wraps `HttpClient.request` to
attach `X-Socket-Id` so the server can exclude the current socket from
broadcasts.

## API

### Services

- `RealtimeManager` — multi-connection orchestrator
- `ChannelWrapper` / `PresenceChannelWrapper` — typed channel wrappers
- `LaravelEchoConnector`, `RedisConnector` — driver factories

### Hooks

- `useChannel(channel)` — subscribe to a public/private channel
- `usePresence(channel)` — presence channel with members list
- `useRealtime(name?)` — returns the full `RealtimeConnection`

### Decorators

- `@InjectRealtime(name?)` — inject a `RealtimeConnection`
- `@InjectRealtimeManager()` — inject the `RealtimeManager`
- `getRealtimeConnectionToken(name?)` — resolve the per-connection DI token

### Facades

- `RealtimeFacade` — static access outside DI

### Tokens

- `REALTIME_CONFIG`, `REALTIME_CONNECTOR`, `REALTIME_MANAGER`

### Enums

- `ConnectionStatus` — `connecting`, `connected`, `disconnected`, `error`

### Errors

- `RealtimeError`, `RealtimeConnectionError`, `RealtimeChannelError`

## Usage Examples

### Presence channel

```tsx
import { usePresence } from "@stackra/ts-realtime";

export function RoomMembers({ room }: { room: string }) {
  const { members, here, joining, leaving } = usePresence(`room.${room}`);

  here((users) => console.log("members:", users));
  joining((user) => console.log("joined:", user.id));
  leaving((user) => console.log("left:", user.id));

  return <div>{members.length} online</div>;
}
```

### Typed event payloads

```typescript
// Declare your event map once
declare module "@stackra/ts-realtime" {
  interface RealtimeEvents {
    "orders.order-created": { id: string; total: number };
  }
}

channel.listen("orders.order-created", (payload) => {
  // payload is typed: { id: string; total: number }
});
```

### Auto-bridge listener

```typescript
import { Injectable } from "@stackra/ts-container";
import { OnEvent } from "@stackra/ts-events";

@Injectable()
export class OrderNotifier {
  @OnEvent("realtime:orders.order-created")
  onOrderCreated(payload: { id: string }) {
    // fires on every order-created event on the 'orders' channel
  }
}
```

## Integration with Other Packages

- `@stackra/ts-events` — auto-bridge channel events as
  `realtime:{channel}.{event}`
- `@stackra/ts-http` — registers an `X-Socket-Id` interceptor on the default
  client
- `@stackra/ts-redis` — required for the Redis broadcaster backend
- `@stackra/ts-logger` — optional structured logger for reconnection warnings

## Testing

`RealtimeFacade.swap(manager)` substitutes the manager with a fake during tests.
In DI tests, override `REALTIME_MANAGER` with a stub connection that records
`channel().listen()` calls.

## License

MIT © [Stackra L.L.C](https://github.com/stackra-inc)
