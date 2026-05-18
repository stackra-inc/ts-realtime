/**
 * @fileoverview RealtimeConnector interface for pluggable driver factories.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

import type { RealtimeConnection } from "./realtime-connection.interface";
import type { RealtimeConnectionConfig } from "./realtime-connection-config.interface";

/**
 * Connector factory interface for creating realtime connections.
 *
 * Implementations validate configuration and produce a connected
 * `RealtimeConnection` instance. Analogous to `RedisConnector` in
 * `@stackra/ts-redis`.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class LaravelEchoConnector implements RealtimeConnector {
 *   async connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection> {
 *     const connection = new EchoConnection(config, config.driver);
 *     connection.connect();
 *     return connection;
 *   }
 * }
 * ```
 */
export interface RealtimeConnector {
  /**
   * Create a realtime connection from configuration.
   *
   * @param config - The connection configuration
   * @returns A promise resolving to a connected RealtimeConnection
   * @throws {Error} If the configuration is invalid or missing required fields
   */
  connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection>;
}
