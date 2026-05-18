/**
 * Decorators Barrel Export
 *
 * Re-exports all DI decorators for the Realtime package.
 *
 * - {@link InjectRealtime} — Injects a RealtimeConnection for a named connection
 * - {@link InjectRealtimeManager} — Injects the RealtimeManager directly
 *
 * @module decorators
 *
 * @example
 * ```typescript
 * import { InjectRealtime, InjectRealtimeManager } from '@stackra/ts-realtime';
 * ```
 */

export { InjectRealtime, getRealtimeConnectionToken } from "./inject-realtime.decorator";
export { InjectRealtimeManager } from "./inject-realtime-manager.decorator";
