/**
 * @fileoverview IRedisConnector — creates IRedisConnection instances from config.
 *
 * Factory connector that creates `IRedisConnection` instances using Redis pub/sub
 * via `@stackra/ts-redis`. This connector enables real-time communication through
 * Redis sorted sets and polling, suitable for HTTP-based Redis clients like Upstash.
 *
 * @module @stackra/ts-realtime
 * @category Connectors
 */

import { Injectable, Inject } from "@stackra/ts-container";
import type { RedisManager } from "@stackra/ts-redis";

import { REDIS_MANAGER } from "@stackra/contracts";
import type { RealtimeConnector } from "@/interfaces/realtime-connector.interface";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";
import { IRedisConnection } from "@/connections/redis.connection";
import { RealtimeConnectionError } from "@/errors";

/**
 * Connector factory that creates `IRedisConnection` instances backed by Redis pub/sub.
 *
 * Validates that a Redis connection is available and creates a `IRedisConnection`
 * instance. Implements the `RealtimeConnector` interface following the same
 * pattern as `LaravelEchoConnector`.
 *
 * @description
 * Can be registered by `RealtimeModule.forRoot()` as an alternative connector
 * via the `REALTIME_CONNECTOR` token. Requires `@stackra/ts-redis` to be
 * configured and available in the DI container.
 *
 * @example
 * ```typescript
 * import { RedisModule } from '@stackra/ts-redis';
 * import { RealtimeModule, IRedisConnector } from '@stackra/ts-realtime';
 *
 * @Module({
 *   imports: [
 *     RedisModule.forRoot({
 *       default: 'default',
 *       connections: {
 *         default: {
 *           url: 'https://your-upstash-redis.upstash.io',
 *           token: 'your-token',
 *         },
 *       },
 *     }),
 *     RealtimeModule.forRootAsync({
 *       useFactory: (redisManager: RedisManager) => ({
 *         default: 'main',
 *         connections: {
 *           main: {
 *             driver: 'redis',
 *             redisConnectionName: 'default',
 *           },
 *         },
 *       }),
 *       inject: [REDIS_MANAGER],
 *       connector: IRedisConnector,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class IRedisConnector implements RealtimeConnector {
  constructor(@Inject(REDIS_MANAGER) private readonly redisManager: RedisManager) {}

  /**
   * Create a IRedisConnection from the provided configuration.
   *
   * Validates that a Redis connection name is provided and retrieves the
   * connection from RedisManager. Creates a connected `IRedisConnection`.
   *
   * @param config - The connection configuration
   * @returns A promise resolving to a connected IRedisConnection
   * @throws {Error} If `redisConnectionName` is missing
   * @throws {Error} If the Redis connection cannot be retrieved
   */
  async connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection> {
    const redisConfig = config as RealtimeConnectionConfig & { redisConnectionName?: string };

    // Allow either a pre-configured Redis connection or a connection name
    let redisConnection = redisConfig.redisConnection;

    if (!redisConnection) {
      const connectionName = redisConfig.redisConnectionName;
      if (!connectionName) {
        throw new RealtimeConnectionError(
          "IRedisConnector: Either redisConnection or redisConnectionName is required.",
        );
      }

      try {
        redisConnection = await this.redisManager.connection(connectionName);
      } catch (error: Error | any) {
        throw new RealtimeConnectionError(
          `IRedisConnector: Failed to get Redis connection "${connectionName}": ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined,
        );
      }
    }

    const fullConfig: RealtimeConnectionConfig = {
      ...config,
      redisConnection,
      pollInterval: redisConfig.pollInterval,
      keyPrefix: redisConfig.keyPrefix,
      maxEventsPerChannel: redisConfig.maxEventsPerChannel,
    };

    const connection = new IRedisConnection(fullConfig, config.driver);
    connection.connect();

    return connection;
  }
}
