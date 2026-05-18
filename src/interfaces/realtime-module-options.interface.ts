/**
 * @fileoverview Realtime configuration interface for multi-connection setup.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

import type { RealtimeConnectionConfig } from "./realtime-connection-config.interface";

/**
 * Top-level configuration for the realtime module.
 *
 * Follows the multi-connection pattern from `RedisConfig`: a `default`
 * connection name and a `connections` map of named configurations.
 *
 * @example
 * ```typescript
 * import { RealtimeModule } from '@stackra/ts-realtime';
 *
 * @Module({
 *   imports: [
 *     RealtimeModule.forRoot({
 *       default: 'main',
 *       connections: {
 *         main: {
 *           driver: 'echo',
 *           key: 'my-app-key',
 *           wsHost: 'ws.example.com',
 *           wsPort: 6001,
 *           authEndpoint: '/broadcasting/auth',
 *           forceTLS: true,
 *         },
 *         admin: {
 *           driver: 'echo',
 *           key: 'admin-key',
 *           wsHost: 'ws-admin.example.com',
 *           wsPort: 6001,
 *         },
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export interface RealtimeModuleOptions {
  /** Default connection name. */
  default: string;

  /** Named connections map. */
  connections: Record<string, RealtimeConnectionConfig>;
}
