/**
 * @fileoverview RealtimeManager injection decorator.
 *
 * Provides `@InjectRealtimeManager()` which wraps
 * `@Inject(REALTIME_MANAGER)` from @stackra/ts-container.
 *
 * This follows the same pattern as `@InjectEntityManager()` in
 * `@stackra/ts-orm`.
 *
 * @module decorators/inject-realtime-manager
 * @category Decorators
 */

import { Inject } from "@stackra/ts-container";

import { REALTIME_MANAGER } from "@stackra/contracts";

/**
 * Injects the {@link RealtimeManager} from the DI container.
 *
 * Use this when you need direct access to the RealtimeManager for
 * advanced operations like switching connections at runtime,
 * disconnecting connections, or introspecting the configuration.
 *
 * For most use cases, prefer `@InjectRealtime()` which gives you a
 * `RealtimeConnection` directly.
 *
 * @returns A parameter/property decorator.
 *
 * @example
 * ```typescript
 * import { Injectable } from '@stackra/ts-container';
 * import { InjectRealtimeManager, RealtimeManager } from '@stackra/ts-realtime';
 *
 * @Injectable()
 * class RealtimeAdminService {
 *   constructor(@InjectRealtimeManager() private manager: RealtimeManager) {}
 *
 *   async disconnectAll(): Promise<void> {
 *     await this.manager.disconnectAll();
 *   }
 *
 *   getActiveConnections(): string[] {
 *     return this.manager.getActiveConnectionNames();
 *   }
 * }
 * ```
 */
export const InjectRealtimeManager = (): PropertyDecorator & ParameterDecorator =>
  Inject(REALTIME_MANAGER);
