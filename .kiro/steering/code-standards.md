---
inclusion: always
---

# Code Standards

## TypeScript

- Strict mode enabled
- Use `import type` for type-only imports
- Prefer `interface` over `type` for object shapes
- Use `@/*` path alias for cross-folder imports within the package
- No `any` unless explicitly justified (DI internals, error captureStackTrace,
  third-party wrappers like Pusher)
- Unused variables must be prefixed with `_`

## File Organization Rules

- `src/interfaces/*.interface.ts` — ONLY `export interface`, one per file
- `src/types/*.type.ts` — ONLY `export type`, one per file
- `src/constants/tokens.constant.ts` — ALL `Symbol.for()` declarations
- `src/errors/*.error.ts` — typed error classes, one per file
- `src/connectors/*.connector.ts` — driver factories (Pusher, Redis), one per
  file

## Documentation

- Every file must have a `@fileoverview` JSDoc block
- Every exported function/class/interface/type must have JSDoc
- Include `@param`, `@returns`, `@throws`, `@example` where applicable

## File Naming

- Services: `kebab-case.service.ts`
- Connections: `kebab-case.connection.ts`
- Connectors: `kebab-case.connector.ts`
- Interfaces: `kebab-case.interface.ts`
- Types: `kebab-case.type.ts`
- Enums: `kebab-case.enum.ts`
- Errors: `kebab-case.error.ts`
- Decorators: `kebab-case.decorator.ts`
- Hooks: `use-kebab-case.hook.ts`
- Constants: `kebab-case.constant.ts`

## Error Handling

- Use typed error classes from `src/errors/` (`RealtimeError`,
  `RealtimeConnectionError`, `RealtimeChannelError`)
- Never swallow errors silently — log or re-throw
- Include connection and channel names in error messages
- Set `Error.captureStackTrace` on custom errors

## Logger Usage

- Inject `LoggerServiceInterface` optionally via
  `@Optional() @Inject(LOGGER_MANAGER_TOKEN)`
- Use `this.logger?.warn(...)` for default channel
- Never use raw `console.*` in services (OK in static `forRoot()` with an
  explanatory comment — DI container is not available there)

## Testing

- Tests use Vitest and fast-check for property-based checks where helpful
- Mock Laravel Echo and Pusher, not `EchoConnection`
- Aim for behavior testing, not implementation testing
