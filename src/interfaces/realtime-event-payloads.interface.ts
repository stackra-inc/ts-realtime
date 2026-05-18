/**
 * @fileoverview Global interface for type-safe realtime event payloads.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

/**
 * Global interface for type-safe realtime event payloads.
 *
 * Users augment this interface via module declaration merging to define
 * their event payload types. When a `listen()` call uses an event name
 * that matches a key in this interface, the callback payload is
 * automatically typed.
 *
 * Renamed from `RealtimeEvents` to `RealtimeEventPayloads` to avoid
 * collision with the `RealtimeEvents` const exported from
 * `@stackra/contracts`, which holds canonical event-name strings.
 *
 * @example
 * ```typescript
 * // Augment in your app:
 * declare module '@stackra/ts-realtime' {
 *   interface RealtimeEventPayloads {
 *     '.order.created': { id: number; total: number };
 *     '.order.updated': { id: number; status: string };
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RealtimeEventPayloads {}
