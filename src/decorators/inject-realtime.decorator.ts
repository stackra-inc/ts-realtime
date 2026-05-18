/**
 * @fileoverview Realtime connection injection decorator.
 *
 * Provides `@InjectRealtime(connectionName?)` which wraps
 * `@Inject(getRealtimeConnectionToken(connectionName))` from @stackra/ts-container.
 *
 * This follows the same pattern as `@InjectRepository(Entity)` in
 * `@stackra/ts-orm`, but uses a connection name string instead of an entity class.
 *
 * @module decorators/inject-realtime
 * @category Decorators
 */

import { Inject } from "@stackra/ts-container";

/**
 * Returns the DI injection token for a named realtime connection.
 *
 * The token follows the convention `"RealtimeConnection:<name>"` where `<name>`
 * is the connection name from the realtime configuration. When no name is
 * provided, it defaults to `"default"`.
 *
 * @param connectionName - The realtime connection name (e.g., "main", "notifications").
 *   Defaults to `"default"` if omitted.
 * @returns The realtime connection injection token string.
 *
 * @example
 * ```typescript
 * getRealtimeConnectionToken();              // "RealtimeConnection:default"
 * getRealtimeConnectionToken('main');        // "RealtimeConnection:main"
 * getRealtimeConnectionToken('notifications'); // "RealtimeConnection:notifications"
 * ```
 */
export const getRealtimeConnectionToken = (connectionName: string = "default"): string =>
  `RealtimeConnection:${connectionName}`;

/**
 * Injects a {@link RealtimeConnection} for the specified connection.
 *
 * When used without arguments, injects the default realtime connection.
 * When a connection name is provided, injects the RealtimeConnection for that
 * specific named connection.
 *
 * Requires `RealtimeModule.forRoot()` to be imported in your application
 * and the connection name to be registered in the configuration.
 *
 * @param connectionName - Optional connection name. Uses `"default"` if omitted.
 * @returns A parameter/property decorator.
 *
 * @example
 * ```typescript
 * import { Injectable } from '@stackra/ts-container';
 * import { InjectRealtime } from '@stackra/ts-realtime';
 * import type { RealtimeConnection } from '@stackra/ts-realtime';
 *
 * @Injectable()
 * class ChatService {
 *   constructor(
 *     @InjectRealtime() private realtime: RealtimeConnection,                // default
 *     @InjectRealtime('notifications') private notifs: RealtimeConnection   // named
 *   ) {}
 *
 *   subscribeToMessages() {
 *     this.realtime.channel('messages')
 *       .listen('.message.sent', (data) => logger.info(data));
 *   }
 * }
 * ```
 */
export const InjectRealtime = (connectionName?: string): PropertyDecorator & ParameterDecorator =>
  Inject(getRealtimeConnectionToken(connectionName));
