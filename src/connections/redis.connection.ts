/**
 * @fileoverview IRedisConnection — RealtimeConnection implementation using Redis pub/sub.
 *
 * Redis pub/sub provides a simple publish-subscribe messaging pattern for
 * real-time communication. This implementation uses Upstash Redis HTTP API
 * via `@stackra/ts-redis` for browser-compatible Redis operations.
 *
 * Since Upstash uses HTTP (not persistent TCP), native Redis SUBSCRIBE is not
 * available. This implementation uses a polling-based approach with Redis
 * sorted sets to simulate pub/sub behavior.
 *
 * @module @stackra/ts-realtime
 * @category Connections
 */

import { ConnectionStatus } from "@stackra/contracts";
import type { RedisConnection as UpstashRedisConnection } from "@stackra/contracts";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";
import { ChannelWrapper } from "@/services/channel-wrapper.service";
import { PresenceChannelWrapper } from "@/services/presence-channel-wrapper.service";
import { RealtimeConnectionError } from "@/errors";
import { Logger } from "@stackra/ts-logger";

/**
 * Concrete `RealtimeConnection` implementation using Redis pub/sub.
 *
 * Uses Redis sorted sets for message storage and polling for subscription
 * since Upstash HTTP API doesn't support persistent connections.
 *
 * @description
 * Created by `RedisConnector.connect()` and managed by `RealtimeManager`.
 * Follows the same pattern as `EchoConnection`.
 *
 * @example
 * ```typescript
 * const config = {
 *   driver: 'redis',
 *   redisConnection: await redisManager.connection('default'),
 *   pollInterval: 2000,
 * };
 *
 * const connection = new IRedisConnection(config, 'main');
 * connection.connect();
 *
 * connection.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.log('New order:', data.id);
 *   });
 * ```
 */
export class IRedisConnection implements RealtimeConnection {
  /**
   * Logger instance scoped to the IRedisConnection context.
   */
  private readonly logger = new Logger(IRedisConnection.name);

  /** The Redis connection instance. */
  private readonly redis: UpstashRedisConnection;

  /** Current connection status. */
  private status: ConnectionStatus = ConnectionStatus.Disconnected;

  /** Registered status change listeners. */
  private readonly listeners = new Set<(status: ConnectionStatus) => void>();

  /** Active public and private channel subscriptions. */
  private readonly channels = new Map<string, ChannelWrapper>();

  /** Active presence channel subscriptions. */
  private readonly presenceChannels = new Map<string, PresenceChannelWrapper>();

  /** Polling configuration. */
  private readonly pollInterval: number;
  private readonly keyPrefix: string;
  private readonly maxEvents: number;

  /** Polling state. */
  private readonly pollingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly channelCursors = new Map<string, number>();

  /** Reconnection state. */
  private _reconnectAttempts = 0;

  /**
   * Creates a new IRedisConnection.
   *
   * @param config - The Redis connection configuration
   * @param name - The connection name
   */
  constructor(
    config: RealtimeConnectionConfig,
    private readonly name: string,
  ) {
    this.redis = config.redisConnection;
    this.pollInterval = config.pollInterval ?? 2000;
    this.keyPrefix = config.keyPrefix ?? "realtime:";
    this.maxEvents = config.maxEventsPerChannel ?? 100;
  }

  // ---------------------------------------------------------------------------
  // RealtimeConnection interface
  // ---------------------------------------------------------------------------

  /**
   * Get the connection name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the current connection status.
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Whether the connection is currently active.
   */
  isConnected(): boolean {
    return this.status === ConnectionStatus.Connected;
  }

  /**
   * The number of consecutive failed reconnection attempts.
   */
  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  /**
   * Register a listener for connection status changes.
   * Returns an unsubscribe function.
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Establish the Redis connection.
   *
   * Sets the status to `Connected` immediately since Redis HTTP API
   * doesn't require persistent connection establishment.
   */
  connect(): void {
    if (this.status === ConnectionStatus.Connected) {
      return;
    }

    this._setStatus(ConnectionStatus.Connecting);

    // Redis HTTP API is connectionless, so we're immediately connected
    this._reconnectAttempts = 0;
    this._setStatus(ConnectionStatus.Connected);
  }

  /**
   * Disconnect and release all resources.
   *
   * Stops all polling timers, clears channel tracking, and sets status
   * to `Disconnected`.
   */
  disconnect(): void {
    // Stop all polling timers
    for (const timer of this.pollingTimers.values()) {
      clearTimeout(timer);
    }
    this.pollingTimers.clear();
    this.channelCursors.clear();

    this.channels.clear();
    this.presenceChannels.clear();
    this._reconnectAttempts = 0;
    this._setStatus(ConnectionStatus.Disconnected);
  }

  /**
   * Get the socket ID for the connection.
   *
   * Redis polling has no concept of a per-client socket identifier — the
   * transport is connectionless, so this always returns `undefined`. Kept
   * to satisfy the {@link RealtimeConnection} contract for parity with
   * WebSocket-backed drivers (Echo, Pusher).
   */
  socketId(): string | undefined {
    return undefined;
  }

  /**
   * Leave all subscribed channels — public, private, and presence.
   *
   * Stops every active polling timer and clears the in-memory channel
   * registries. The connection itself remains in {@link ConnectionStatus.Connected}
   * (Redis is connectionless), so new subscriptions are still possible.
   */
  leaveAll(): void {
    for (const timer of this.pollingTimers.values()) {
      clearTimeout(timer);
    }
    this.pollingTimers.clear();
    this.channelCursors.clear();
    this.channels.clear();
    this.presenceChannels.clear();
  }

  // ---------------------------------------------------------------------------
  // Channel subscriptions
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to a public channel.
   *
   * @param name - The channel name
   * @returns A ChannelWrapper for the channel
   * @throws {Error} If the connection is not connected
   */
  channel(name: string): ChannelWrapper {
    this._assertConnected();

    const existing = this.channels.get(name);
    if (existing) return existing;

    // Create a mock Echo channel object that ChannelWrapper expects
    const mockEchoChannel = this._createMockEchoChannel(name);
    const wrapper = new ChannelWrapper(mockEchoChannel, name, (n) => this._removeChannel(n));

    this.channels.set(name, wrapper);
    this._startPolling(name);

    return wrapper;
  }

  /**
   * Subscribe to a private channel.
   *
   * @param name - The channel name (without the `private-` prefix)
   * @returns A ChannelWrapper for the private channel
   * @throws {Error} If the connection is not connected
   */
  private(name: string): ChannelWrapper {
    this._assertConnected();

    const channelKey = `private:${name}`;
    const existing = this.channels.get(channelKey);
    if (existing) return existing;

    const mockEchoChannel = this._createMockEchoChannel(channelKey);
    const wrapper = new ChannelWrapper(mockEchoChannel, channelKey, (n) => this._removeChannel(n));

    this.channels.set(channelKey, wrapper);
    this._startPolling(channelKey);

    return wrapper;
  }

  /**
   * Join a presence channel.
   *
   * @param name - The channel name (without the `presence-` prefix)
   * @returns A PresenceChannelWrapper for the presence channel
   * @throws {Error} If the connection is not connected
   */
  join(name: string): PresenceChannelWrapper {
    this._assertConnected();

    const existing = this.presenceChannels.get(name);
    if (existing) return existing;

    const mockEchoChannel = this._createMockEchoChannel(`presence:${name}`);
    const wrapper = new PresenceChannelWrapper(mockEchoChannel, name, (n) =>
      this._removePresenceChannel(n),
    );

    this.presenceChannels.set(name, wrapper);
    this._startPolling(`presence:${name}`);

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Publishing (for internal use or external API)
  // ---------------------------------------------------------------------------

  /**
   * Publish an event to a channel.
   *
   * @param channel - The channel name
   * @param event - The event name
   * @param data - The event data
   */
  async publish(channel: string, event: string, data: any): Promise<void> {
    const key = this._listKey(channel);
    const score = Date.now();

    const payload = {
      channel,
      event,
      data,
      timestamp: score,
      _idx: score,
    };

    const serialized = JSON.stringify(payload);

    // Add to sorted set
    await this.redis.zadd(key, score, serialized);

    // Trim old events
    const total = await this.redis.zrange(key, 0, -1);
    if (total.length > this.maxEvents) {
      await this.redis.zremrangebyscore(key, 0, score - this.maxEvents);
    }

    // Also publish via Redis pub/sub for native subscribers
    await this.redis.publish(channel, serialized);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Build the Redis list key for a channel.
   */
  private _listKey(channel: string): string {
    return `${this.keyPrefix}${channel}`;
  }

  /**
   * Create a mock Echo channel object for ChannelWrapper compatibility.
   */
  private _createMockEchoChannel(channelName: string): any {
    const listeners = new Map<string, Set<(data: any) => void>>();

    return {
      listen: (event: string, callback: (data: any) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(callback);
        return this._createMockEchoChannel(channelName);
      },
      notification: (callback: (data: any) => void) => {
        return this._createMockEchoChannel(channelName).listen(".notification", callback);
      },
      listenForWhisper: (event: string, callback: (data: any) => void) => {
        return this._createMockEchoChannel(channelName).listen(`.whisper:${event}`, callback);
      },
      whisper: async (event: string, data: any) => {
        await this.publish(channelName, `.whisper:${event}`, data);
      },
      stopListening: (event: string, callback?: (data: any) => void) => {
        if (callback) {
          listeners.get(event)?.delete(callback);
        } else {
          listeners.delete(event);
        }
        return this._createMockEchoChannel(channelName);
      },
      _trigger: (event: string, data: any) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          for (const callback of eventListeners) {
            try {
              callback(data);
            } catch (error: Error | any) {
              this.logger.error(`Error in channel listener for ${event}:`, {
                error: String(error),
              });
            }
          }
        }
      },
      _listeners: listeners,
    };
  }

  /**
   * Start polling for a channel.
   */
  private _startPolling(channelName: string): void {
    if (this.pollingTimers.has(channelName)) {
      return;
    }

    this.channelCursors.set(channelName, 0);

    const poll = async () => {
      if (!this.pollingTimers.has(channelName)) {
        return;
      }

      try {
        const key = this._listKey(channelName);
        const cursor = this.channelCursors.get(channelName) ?? 0;

        // Read all events from cursor onwards
        const raw = await this.redis.zrange(key, cursor, -1);

        for (const entry of raw) {
          try {
            const event = JSON.parse(entry);
            const idx = event._idx ?? 0;

            // Only process events we haven't seen
            if (idx > cursor) {
              this.channelCursors.set(channelName, idx);
            }

            // Find the channel wrapper and trigger the event
            const wrapper =
              this.channels.get(channelName) ?? this.presenceChannels.get(channelName);
            if (wrapper) {
              const mockChannel = (wrapper as any).echoChannel;
              if (mockChannel && mockChannel._trigger) {
                mockChannel._trigger(event.event, event.data);
              }
            }
          } catch (error: Error | any) {
            // Skip malformed entries
            this.logger.error("Error parsing Redis event:", { error: String(error) });
          }
        }
      } catch (error: Error | any) {
        // Swallow polling errors
        this.logger.error("Error polling Redis channel:", { error: String(error) });
      }

      // Schedule next poll
      if (this.pollingTimers.has(channelName)) {
        const timer = setTimeout(poll, this.pollInterval);
        this.pollingTimers.set(channelName, timer);
      }
    };

    // Start polling
    const timer = setTimeout(poll, this.pollInterval);
    this.pollingTimers.set(channelName, timer);
  }

  /**
   * Stop polling for a channel.
   */
  private _stopPolling(channelName: string): void {
    const timer = this.pollingTimers.get(channelName);
    if (timer) {
      clearTimeout(timer);
      this.pollingTimers.delete(channelName);
      this.channelCursors.delete(channelName);
    }
  }

  /**
   * Update the connection status and notify all listeners.
   * @internal
   */
  private _setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) {
      return;
    }
    this.status = newStatus;
    for (const listener of this.listeners) {
      listener(newStatus);
    }
  }

  /**
   * Assert that the connection is connected before channel operations.
   * @internal
   */
  private _assertConnected(): void {
    if (this.status !== ConnectionStatus.Connected) {
      throw new RealtimeConnectionError(
        "IRedisConnection is not connected. Check isConnected() or getStatus() before subscribing to channels.",
      );
    }
  }

  /**
   * Remove a public/private channel from tracking.
   * @internal
   */
  private _removeChannel(name: string): void {
    this._stopPolling(name);
    this.channels.delete(name);
  }

  /**
   * Remove a presence channel from tracking.
   * @internal
   */
  private _removePresenceChannel(name: string): void {
    this._stopPolling(`presence:${name}`);
    this.presenceChannels.delete(name);
  }
}
