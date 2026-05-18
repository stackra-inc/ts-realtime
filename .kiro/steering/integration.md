---
inclusion: always
---

# Package Integration

## Dependencies on Other Stackra Packages

- `@stackra/ts-container` (required) — `@Module`, `@Injectable`, `@Inject`,
  `DynamicModule`
- `@stackra/ts-support` (required) — `MultipleInstanceManager`, `Facade`,
  `GlobalRegistry`

## Optional Integrations

- **`@stackra/ts-events`** — enables the auto-bridge. When present,
  `RealtimeModule.forRoot()` wires `LaravelEchoConnector.setDispatchFn()` so
  channel events are emitted as `realtime:{channel}.{event}` through
  `EventEmitterManager`.
- **`@stackra/ts-http`** — enables the `X-Socket-Id` interceptor.
  `RealtimeModule` wraps `HttpClient.request` so every HTTP request carries the
  current socket ID, allowing the server to skip echo-back to the sender.
- **`@stackra/ts-redis`** — required only when using the `RedisConnector`
  broadcaster backend.
- **`@stackra/ts-logger`** — structured logging.
- **`react`** — only needed to consume `useChannel`, `usePresence`, and
  `useRealtime` hooks.

## Auto-Wiring

- `GlobalRegistry.register('realtime', ...)` exposes `realtime(name)` for use
  outside DI.
- Auto-bridge: events published on any channel reach subscribers registered with
  `@OnEvent('realtime:orders.created')` etc. via `@stackra/ts-events`.
- HTTP interceptor: runs once at bootstrap and silently skips when the socket
  isn't ready yet.

## Cross-Package Examples

```typescript
import { Module } from "@stackra/ts-container";
import { HttpModule } from "@stackra/ts-http";
import { EventEmitterModule } from "@stackra/ts-events";
import { RealtimeModule } from "@stackra/ts-realtime";

@Module({
  imports: [
    HttpModule.forRoot({
      default: "api",
      connections: { api: { baseURL: "/api" } },
    }),
    EventEmitterModule.forRoot({
      default: "memory",
      connections: { memory: { driver: "memory", wildcard: true } },
    }),
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
    }),
  ],
})
export class AppModule {}
```

```typescript
// Auto-bridged listener — no manual wiring required
@Injectable()
class OrderNotifier {
  @OnEvent("realtime:orders.order-created")
  onOrderCreated(payload: { id: string }) {
    // fired whenever the 'orders' channel receives 'order-created'
  }
}
```

## Token Interoperability

- `EVENT_MANAGER_TOKEN` = `Symbol.for('EVENT_EMITTER_MANAGER')` — shared with
  `@stackra/ts-events`.
- `HTTP_MANAGER_TOKEN` = `Symbol.for('HTTP_MANAGER')` — shared with
  `@stackra/ts-http`.
- `LOGGER_MANAGER_TOKEN` = `Symbol.for('LOGGER_MANAGER')` — shared with
  `@stackra/ts-logger`.
- `REALTIME_MANAGER` is exported for downstream consumers.
