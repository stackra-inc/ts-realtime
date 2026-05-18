---
inclusion: always
---

# Tech Stack

## Language & Runtime

- TypeScript 6.x (strict mode)
- Node.js >= 22 (LTS)
- ESM-first (`"type": "module"`)
- Target: ES2022

## Build

- Bundler: tsup (via `@stackra/tsup-config`)
- Output: ESM + CJS + `.d.ts` declarations
- Package manager: pnpm 10.x

## Testing

- Runner: Vitest 4.x
- Environment: jsdom
- Location: `__tests__/**/*.{test,spec}.{ts,tsx}`
- Property-based testing: fast-check available

## Key Dependencies

- `@stackra/ts-container` — DI container (workspace:\*)
- `@stackra/ts-support` — `MultipleInstanceManager`, `Facade`, `GlobalRegistry`
  (^2.6.4)
- `laravel-echo` ^2.3.4 — pluggable WebSocket client
- `pusher-js` ^8.5.0 — Pusher protocol driver
- `@stackra/tsup-config`, `@stackra/typescript-config`

## Peer Dependencies

- `@stackra/ts-container` (required)
- `@stackra/ts-support` ^2.6.4 (required)
- `@stackra/ts-events` (optional — enables auto-bridge)
- `@stackra/ts-logger` (optional — structured logging via
  `LOGGER_MANAGER_TOKEN`)
- `@stackra/ts-redis` ^1.1.9 (optional — Redis connector)
- `react` ^19.2.5 (optional — required for hooks)

## Commands

| Command              | Purpose                 |
| -------------------- | ----------------------- |
| `pnpm build`         | Production build (tsup) |
| `pnpm dev`           | Watch-mode build        |
| `pnpm test`          | Run Vitest suite        |
| `pnpm test:watch`    | Vitest in watch mode    |
| `pnpm test:coverage` | Coverage report         |
| `pnpm test:ui`       | Vitest UI               |
| `pnpm typecheck`     | `tsc --noEmit`          |
| `pnpm lint`          | ESLint (max-warnings 0) |
| `pnpm format`        | Prettier write          |
| `pnpm release`       | Publish to npm          |
