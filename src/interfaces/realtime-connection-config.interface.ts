/**
 * @fileoverview Configuration interface for a single named realtime connection.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

/**
 * Configuration for a single named realtime connection.
 *
 * Defines the driver identifier and all optional transport-specific fields
 * (Echo/Pusher options, reconnection parameters, etc.). Each entry in
 * `RealtimeModuleOptions.connections` is a `RealtimeConnectionConfig`.
 *
 * @example
 * ```typescript
 * const config: RealtimeConnectionConfig = {
 *   driver: 'echo',
 *   key: 'my-app-key',
 *   wsHost: 'ws.example.com',
 *   wsPort: 6001,
 *   authEndpoint: '/broadcasting/auth',
 *   forceTLS: true,
 * };
 * ```
 */
export interface RealtimeConnectionConfig {
  /** Driver identifier: 'echo', 'socketio', 'mock', or custom. */
  driver: string;

  /** Pusher/Soketi application key. */
  key?: string;

  /** WebSocket host. */
  wsHost?: string;

  /** WebSocket port. */
  wsPort?: number;

  /** Auth endpoint for private/presence channels. */
  authEndpoint?: string;

  /** Force TLS. */
  forceTLS?: boolean;

  /** Pusher cluster. */
  cluster?: string;

  /** Enable encrypted connection. */
  encrypted?: boolean;

  /** Disable Pusher stats reporting. */
  disableStats?: boolean;

  /** Additional auth headers. */
  authHeaders?: Record<string, string>;

  /** Initial reconnect delay (ms). */
  reconnectInitialDelay?: number;

  /** Max reconnect delay (ms). */
  reconnectMaxDelay?: number;

  /** Reconnect delay multiplier. */
  reconnectMultiplier?: number;

  /** Pre-configured Pusher client instance. */
  client?: any;

  // ── Redis-specific options ──────────────────────────────────────────────

  /** Pre-configured Redis connection instance (for Redis driver). */
  redisConnection?: any;

  /** Redis connection name to use (for Redis driver). */
  redisConnectionName?: string;

  /** Polling interval in ms for Redis pub/sub simulation. @default 2000 */
  pollInterval?: number;

  /** Key prefix for Redis channels. @default "realtime:" */
  keyPrefix?: string;

  /** Max events to keep per channel in Redis sorted set. @default 100 */
  maxEventsPerChannel?: number;
}
