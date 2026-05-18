/**
 * @fileoverview EchoConnection — RealtimeConnection implementation using Laravel Echo.
 *
 * Laravel Echo is a JavaScript library that provides a unified API for WebSocket
 * communication across multiple broadcasters:
 * - Pusher (pusher.com)
 * - Laravel Reverb (Laravel's first-party WebSocket server)
 * - Soketi (open-source Pusher alternative)
 * - Socket.IO
 * - Ably
 *
 * Echo handles protocol differences, channel management, presence channels,
 * encrypted private channels, and HTTP interceptors for Laravel authentication.
 *
 * @module @stackra/ts-realtime
 * @category Connections
 */

import Echo from "laravel-echo";
import type { BroadcastDriver } from "laravel-echo";
import Pusher from "pusher-js";

import { ConnectionStatus } from "@stackra/contracts";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";
import { ChannelWrapper } from "@/services/channel-wrapper.service";
import { PresenceChannelWrapper } from "@/services/presence-channel-wrapper.service";
import { RealtimeConnectionError } from "@/errors";

import { Str } from "@stackra/ts-support";
/**
 * Concrete `RealtimeConnection` implementation using Laravel Echo.
 *
 * Laravel Echo provides a unified API for WebSocket communication, supporting
 * multiple broadcasters (Pusher, Reverb, Soketi, Socket.IO, Ably).
 *
 * This implementation encapsulates:
 * - Laravel Echo instance creation and configuration
 * - Connection status tracking with listener notification
 * - Exponential backoff reconnection strategy
 * - Channel subscriptions (public, private, presence) via wrappers
 * - Automatic channel re-subscription after reconnection
 * - Pusher connection event binding for state management
 *
 * @description
 * Created by `LaravelEchoConnector.connect()` and managed by `RealtimeManager`
 * via `MultipleInstanceManager`. Follows the same pattern as other @stackra packages.
 *
 * @example
 * ```typescript
 * // Works with Pusher
 * const config = { driver: 'pusher', key: 'pusher-key', wsHost: 'ws.pusher.com', ... };
 *
 * // Works with Reverb
 * const config = { driver: 'pusher', key: 'reverb-key', wsHost: 'reverb.laravel.cloud', ... };
 *
 * // Works with Soketi
 * const config = { driver: 'pusher', key: 'soketi-key', wsHost: 'localhost', wsPort: 6001, ... };
 *
 * const connection = new EchoConnection(config, 'main');
 * connection.connect();
 *
 * connection.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info('New order:', data.id);
 *   });
 * ```
 */
export class EchoConnection implements RealtimeConnection {
  /** The Laravel Echo instance, or null when disconnected. */
  private echo: Echo<BroadcastDriver> | null = null;

  /** Current connection status. */
  private status: ConnectionStatus = ConnectionStatus.Disconnected;

  /** Registered status change listeners. */
  private readonly listeners = new Set<(status: ConnectionStatus) => void>();

  /** Active public and private channel subscriptions. */
  private readonly channels = new Map<string, ChannelWrapper>();

  /** Active presence channel subscriptions. */
  private readonly presenceChannels = new Map<string, PresenceChannelWrapper>();

  /** Pending reconnection timer. */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Consecutive failed reconnection attempts since last successful connection. */
  private _reconnectAttempts = 0;

  /**
   * Creates a new EchoConnection.
   *
   * @param config - The connection configuration
   * @param name - The connection name
   */
  constructor(
    private readonly config: RealtimeConnectionConfig,
    private readonly name: string,
    private readonly dispatchFn?: (event: string, data: unknown) => void,
  ) {}

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
   * Establish the WebSocket connection via Laravel Echo.
   *
   * Creates a new Echo instance with the provided configuration, sets the
   * status to `Connecting`, and binds to Pusher connection events to track
   * state transitions.
   */
  connect(): void {
    if (this.echo) {
      return;
    }

    this._setStatus(ConnectionStatus.Connecting);

    // Create Pusher instance first
    const pusherInstance = new Pusher(this.config.key!, {
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      disableStats: this.config.disableStats ?? true,
      enabledTransports: ["ws", "wss"],
      authEndpoint: this.config.authEndpoint,
    });

    const echoOptions: Record<string, any> = {
      broadcaster: this.config.driver === "echo" ? "reverb" : this.config.driver,
      key: this.config.key,
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      encrypted: this.config.encrypted ?? false,
      disableStats: this.config.disableStats ?? true,
      enabledTransports: ["ws", "wss"],
      auth: { headers: this.config.authHeaders ?? {} },
      authEndpoint: this.config.authEndpoint,
      client: pusherInstance,
    };

    this.echo = new Echo(echoOptions as any);
    this._bindConnectionEvents();
  }

  /**
   * Disconnect the WebSocket and release all resources.
   *
   * Calls `echo.disconnect()`, clears all channel tracking maps, cancels
   * any pending reconnection timer, and sets the status to `Disconnected`.
   */
  disconnect(): void {
    this._cancelReconnect();

    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
    }

    this.channels.clear();
    this.presenceChannels.clear();
    this._reconnectAttempts = 0;
    this._setStatus(ConnectionStatus.Disconnected);
  }

  // ---------------------------------------------------------------------------
  // Channel subscriptions
  // ---------------------------------------------------------------------------

  /**
   * Get the socket ID for the current connection.
   *
   * The socket ID is used by Laravel to exclude the sender from receiving
   * their own broadcast events. It's sent as the `X-Socket-Id` header.
   *
   * @returns The socket ID string, or undefined if not connected
   */
  socketId(): string | undefined {
    if (!this.echo) return undefined;
    return this.echo.socketId();
  }

  /**
   * Leave all channels (public, private, and presence) on this connection.
   *
   * Iterates all tracked channel and presence channel wrappers, calls `leave()`
   * on each, and clears the internal tracking maps.
   */
  leaveAll(): void {
    for (const wrapper of this.channels.values()) {
      if (!wrapper.isLeft) {
        wrapper.leave();
      }
    }
    for (const wrapper of this.presenceChannels.values()) {
      if (!wrapper.isLeft) {
        wrapper.leave();
      }
    }
    this.channels.clear();
    this.presenceChannels.clear();
  }

  /**
   * Subscribe to a public Laravel Broadcasting channel.
   *
   * @param name - The channel name
   * @returns A ChannelWrapper for the channel
   * @throws {Error} If the connection is not connected
   */
  channel(name: string): ChannelWrapper {
    this._assertConnected();

    const existing = this.channels.get(name);
    if (existing) return existing;

    const echoChannel = this.echo!.channel(name);
    const wrapper = new ChannelWrapper(echoChannel, name, (n) => this._removeChannel(n));

    // Auto-bridge: dispatch all channel events through ts-events
    this._autoBridge(wrapper);

    this.channels.set(name, wrapper);
    return wrapper;
  }

  /**
   * Subscribe to a private Laravel Broadcasting channel.
   *
   * @param name - The channel name (without the `private-` prefix)
   * @returns A ChannelWrapper for the private channel
   * @throws {Error} If the connection is not connected
   */
  private(name: string): ChannelWrapper {
    this._assertConnected();

    const existing = this.channels.get(`private:${name}`);
    if (existing) return existing;

    const echoChannel = this.echo!.private(name);
    const wrapper = new ChannelWrapper(echoChannel, `private:${name}`, (n) =>
      this._removeChannel(n),
    );

    // Auto-bridge: dispatch all channel events through ts-events
    this._autoBridge(wrapper);
    this.channels.set(`private:${name}`, wrapper);
    return wrapper;
  }

  /**
   * Join a presence Laravel Broadcasting channel.
   *
   * @param name - The channel name (without the `presence-` prefix)
   * @returns A PresenceChannelWrapper for the presence channel
   * @throws {Error} If the connection is not connected
   */
  join(name: string): PresenceChannelWrapper {
    this._assertConnected();

    const existing = this.presenceChannels.get(name);
    if (existing) return existing;

    const echoChannel = this.echo!.join(name);
    const wrapper = new PresenceChannelWrapper(echoChannel, name, (n) =>
      this._removePresenceChannel(n),
    );

    // Auto-bridge: dispatch all channel events through ts-events
    this._autoBridge(wrapper);

    this.presenceChannels.set(name, wrapper);
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Auto-bridge a channel's events into ts-events.
   *
   * Every event received on the channel is automatically dispatched as:
   *   `realtime:{channelName}.{eventName}`
   *
   * This enables @OnEvent decorators and event.listen() to handle
   * WebSocket events without any manual bridge setup.
   *
   * Uses dynamic import to keep @stackra/ts-events as an optional dependency.
   *
   * @internal
   */
  private _autoBridge(wrapper: ChannelWrapper): void {
    if (!this.dispatchFn) return;

    const dispatch = this.dispatchFn;
    wrapper.listenToAll((event: string, data: unknown) => {
      dispatch(`realtime:${wrapper.name}.${event}`, data);
    });
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
    if (!this.echo || this.status !== ConnectionStatus.Connected) {
      throw new RealtimeConnectionError(
        "EchoConnection is not connected. Check isConnected() or getStatus() before subscribing to channels.",
      );
    }
  }

  /**
   * Remove a public/private channel from tracking.
   * @internal
   */
  private _removeChannel(name: string): void {
    this.channels.delete(name);
    // Only try to leave if echo exists and connection is still active
    if (this.echo && this.status === ConnectionStatus.Connected) {
      try {
        this.echo.leave(name);
      } catch (error: Error | any) {
        // Ignore errors when leaving channels (connection might be closing)
      }
    }
  }

  /**
   * Remove a presence channel from tracking.
   * @internal
   */
  private _removePresenceChannel(name: string): void {
    this.presenceChannels.delete(name);
    // Only try to leave if echo exists and connection is still active
    if (this.echo && this.status === ConnectionStatus.Connected) {
      try {
        this.echo.leave(name);
      } catch (error: Error | any) {
        // Ignore errors when leaving channels (connection might be closing)
      }
    }
  }

  /**
   * Bind to Pusher connection events for state tracking and reconnection.
   * @internal
   */
  private _bindConnectionEvents(): void {
    if (!this.echo) {
      return;
    }

    const connector = (this.echo as any).connector;
    let pusherInstance = connector?.pusher;

    // If pusher is the class (function), find the actual instance
    if (typeof pusherInstance === "function") {
      if (connector.socket) {
        pusherInstance = connector.socket;
      } else if (
        connector.pusher &&
        connector.pusher.instances &&
        connector.pusher.instances.length > 0
      ) {
        pusherInstance = connector.pusher.instances[connector.pusher.instances.length - 1];
      } else {
        return;
      }
    }

    if (!pusherInstance) {
      return;
    }

    // Check if pusher has a connection property
    if (typeof pusherInstance.connection !== "undefined") {
      this._bindPusherEvents(pusherInstance);
    } else {
      // Wait for pusher.connection to be available
      const waitForConnection = (attempt = 0, maxAttempts = 50) => {
        if (!pusherInstance.connection) {
          if (attempt < maxAttempts) {
            setTimeout(() => waitForConnection(attempt + 1, maxAttempts), 100);
          }
          return;
        }

        this._bindPusherEvents(pusherInstance);
      };

      waitForConnection();
    }
  }

  /**
   * Bind to Pusher connection events.
   * @internal
   */
  private _bindPusherEvents(pusher: any): void {
    // Bind to Pusher's state_change event
    pusher.connection.bind("state_change", (states: any) => {
      switch (states.current) {
        case "connected":
          this._reconnectAttempts = 0;
          this._setStatus(ConnectionStatus.Connected);
          this._resubscribeChannels();
          break;

        case "connecting":
        case "unavailable":
          if (
            this.status !== ConnectionStatus.Connecting &&
            this.status !== ConnectionStatus.Reconnecting
          ) {
            this._setStatus(ConnectionStatus.Connecting);
          }
          break;

        case "disconnected":
          if (this.status === ConnectionStatus.Disconnected) return;
          this._startReconnect();
          break;

        case "failed":
          if (this.status === ConnectionStatus.Disconnected) return;
          this._startReconnect();
          break;
      }
    });

    // Bind to error events
    pusher.connection.bind("error", (error: any) => {
      const err = error instanceof Error ? error : new Error(error?.message ?? "Connection error");

      for (const wrapper of this.channels.values()) {
        wrapper._notifyError(err);
      }
      for (const wrapper of this.presenceChannels.values()) {
        wrapper._notifyError(err);
      }
    });
  }

  /**
   * Start the exponential backoff reconnection sequence.
   * @internal
   */
  private _startReconnect(): void {
    if (this.status === ConnectionStatus.Disconnected) return;

    this._setStatus(ConnectionStatus.Reconnecting);
    this._scheduleReconnect();
  }

  /**
   * Schedule a single reconnection attempt with exponential backoff.
   * @internal
   */
  private _scheduleReconnect(): void {
    const initialDelay = this.config.reconnectInitialDelay ?? 1000;
    const multiplier = this.config.reconnectMultiplier ?? 2;
    const maxDelay = this.config.reconnectMaxDelay ?? 30000;

    const delay = Math.min(initialDelay * Math.pow(multiplier, this._reconnectAttempts), maxDelay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._reconnectAttempts++;
      this._attemptReconnect();
    }, delay);
  }

  /**
   * Attempt a single reconnection by tearing down and re-creating Echo.
   * @internal
   */
  private _attemptReconnect(): void {
    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
    }

    this._setStatus(ConnectionStatus.Connecting);

    // Create Pusher instance first
    const pusherInstance = new Pusher(this.config.key!, {
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      disableStats: this.config.disableStats ?? true,
      enabledTransports: ["ws", "wss"],
      authEndpoint: this.config.authEndpoint,
    });

    const echoOptions: Record<string, any> = {
      broadcaster: this.config.driver === "echo" ? "reverb" : this.config.driver,
      key: this.config.key,
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      encrypted: this.config.encrypted ?? false,
      disableStats: this.config.disableStats ?? true,
      enabledTransports: ["ws", "wss"],
      auth: { headers: this.config.authHeaders ?? {} },
      authEndpoint: this.config.authEndpoint,
      client: pusherInstance, // Pass the instance, not the class
    };

    this.echo = new Echo(echoOptions as any);
    this._bindConnectionEvents();
  }

  /**
   * Cancel any pending reconnection timer.
   * @internal
   */
  private _cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Re-subscribe all tracked channels after a successful reconnection.
   * @internal
   */
  private _resubscribeChannels(): void {
    if (!this.echo) return;

    for (const [name, wrapper] of this.channels.entries()) {
      if (wrapper.isLeft) {
        this.channels.delete(name);
        continue;
      }

      if (Str.startsWith(name, "private:")) {
        const channelName = name.slice("private:".length);
        const echoChannel = this.echo.private(channelName);
        (wrapper as any).echoChannel = echoChannel;
      } else {
        const echoChannel = this.echo.channel(name);
        (wrapper as any).echoChannel = echoChannel;
      }
    }

    for (const [name, wrapper] of this.presenceChannels.entries()) {
      if (wrapper.isLeft) {
        this.presenceChannels.delete(name);
        continue;
      }

      const echoChannel = this.echo.join(name);
      (wrapper as any).echoChannel = echoChannel;
    }
  }
}
