---
inclusion: always
---

# Package Structure

```
realtime/
├── src/
│   ├── constants/        — tokens.constant.ts (REALTIME_CONFIG, REALTIME_MANAGER, REALTIME_CONNECTOR, EVENT_MANAGER_TOKEN, HTTP_MANAGER_TOKEN, LOGGER_MANAGER_TOKEN, internal bridge/interceptor tokens)
│   ├── interfaces/       — one interface per .interface.ts file (RealtimeConfig, RealtimeConnection, RealtimeConnector, RealtimeEvents, ...)
│   ├── types/            — type-only exports (InferEventPayload, ...)
│   ├── enums/            — ConnectionStatus
│   ├── config/           — defaultRealtimeConfig
│   ├── services/         — RealtimeManager, ChannelWrapper, PresenceChannelWrapper
│   ├── connections/      — EchoConnection, RedisConnection
│   ├── connectors/       — LaravelEchoConnector (pusher.connector.ts), RedisConnector
│   ├── decorators/       — @InjectRealtime, @InjectRealtimeManager
│   ├── facades/          — RealtimeFacade (static access)
│   ├── hooks/            — useChannel, usePresence, useRealtime
│   ├── errors/           — RealtimeError, RealtimeConnectionError, RealtimeChannelError
│   ├── utils/            — defineConfig helper
│   ├── realtime.module.ts — DI module with forRoot()
│   └── index.ts          — public API barrel
├── @types/               — ambient declarations
├── config/               — default realtime.config.ts for consumers
├── .examples/            — usage examples
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Conventions

- Every folder has an `index.ts` barrel export
- File naming: `kebab-case.<category>.ts` (e.g., `realtime-manager.service.ts`,
  `realtime-config.interface.ts`)
- One interface per `.interface.ts` file
- One type per `.type.ts` file
- All `Symbol.for()` tokens centralized in `constants/tokens.constant.ts`
- Path alias `@/*` → `./src/*`

## Actual Folders Present in This Package

- `config/`
- `connections/`
- `connectors/`
- `constants/`
- `decorators/`
- `enums/`
- `errors/`
- `facades/`
- `hooks/`
- `interfaces/`
- `services/`
- `types/`
- `utils/`
