import { Injectable, Inject, Optional, Module, inject } from '@stackra/ts-container';
import { MultipleInstanceManager, Str, Env } from '@stackra/ts-support';
import { RealtimeEvents, REALTIME_CONFIG, REALTIME_CONNECTOR, EVENT_EMITTER_MANAGER, TAB_COORDINATOR, ConnectionStatus, REALTIME_MANAGER, REDIS_MANAGER } from '@stackra/contracts';
import { Logger } from '@stackra/ts-logger';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { HttpMiddleware } from '@stackra/ts-http';
import { useState, useRef, useEffect } from 'react';
import { useInject } from '@stackra/ts-container/react';

/**
 * @stackra/ts-realtime v1.0.1
 * (c) 2026 Unknown Author
 * @license UNLICENSED
 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
function _ts_decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate, "_ts_decorate");
function _ts_metadata(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
__name(_ts_metadata, "_ts_metadata");
function _ts_param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param, "_ts_param");
var RealtimeManager2 = class _RealtimeManager extends MultipleInstanceManager {
  static {
    __name(this, "RealtimeManager");
  }
  config;
  connector;
  eventManager;
  coordinator;
  /**
  * @param config - Realtime configuration with named connections
  * @param connector - Connector used to create realtime connections
  * @param eventManager - Optional event manager for dispatching connection
  *   lifecycle events (`realtime.connected`, `realtime.disconnected`,
  *   `realtime.subscribed`, `realtime.reconnecting`). When
  *   `EventEmitterModule.forRoot()` is not in the app graph, this is
  *   `undefined` and `emit()` becomes a no-op.
  */
  constructor(config, connector, eventManager, coordinator) {
    super(), this.config = config, this.connector = connector, this.eventManager = eventManager, this.coordinator = coordinator;
  }
  /**
  * Logger instance scoped to the RealtimeManager context.
  */
  logger = new Logger(_RealtimeManager.name);
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────
  /**
  * Eagerly warm the default connection on bootstrap.
  *
  * When a TabCoordinator is available, only the leader tab connects.
  * Follower tabs receive realtime events via the CoordinatorTransport
  * (cross-tab event relay from `@stackra/ts-coordinator`).
  *
  * Skips silently if no connections are defined.
  * Logs a warning if the default connection fails to warm.
  */
  async onModuleInit() {
    const defaultName = this.config.default;
    if (!this.config.connections[defaultName]) return;
    if (this.coordinator) {
      this.coordinator.role$.subscribe(async (role) => {
        if (role === "leader") {
          try {
            await this.connection();
            this.logger.info("[RealtimeManager] Leader tab connected WebSocket");
          } catch (err) {
            this.logger.warn(`[RealtimeManager] Leader failed to connect '${defaultName}': ${err.message}`);
          }
        } else {
          if (this.isConnectionActive(defaultName)) {
            await this.disconnect(defaultName);
            this.logger.info("[RealtimeManager] Follower tab disconnected WebSocket");
          }
        }
      });
    } else {
      try {
        await this.connection();
      } catch (err) {
        this.logger.warn(`[RealtimeManager] Failed to warm default connection '${defaultName}': ${err.message}`);
      }
    }
  }
  /**
  * Disconnect all active connections on shutdown.
  */
  async onModuleDestroy() {
    await this.disconnectAll();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // MultipleInstanceManager contract
  // ─────────────────────────────────────────────────────────────────────────
  /**
  * Get the default instance name from configuration.
  */
  getDefaultInstance() {
    return this.config.default;
  }
  /**
  * Set the default instance name at runtime.
  */
  setDefaultInstance(name) {
    this.config.default = name;
  }
  /**
  * Get the configuration for a specific connection.
  *
  * Ensures the returned config includes a `driver` field so the base
  * class's `resolveAsync()` can find it.
  *
  * @param name - The connection name
  * @returns The connection configuration, or undefined if not found
  */
  getInstanceConfig(name) {
    const connectionConfig = this.config.connections[name];
    if (!connectionConfig) return void 0;
    return {
      ...connectionConfig
    };
  }
  /**
  * Sync driver creation — not used for realtime.
  *
  * Realtime always uses the async path via `createDriverAsync()`.
  *
  * @throws {Error} Always throws; use `connection()` for async resolution
  */
  createDriver(_driver, _config) {
    throw new Error("RealtimeManager: use connection() for async resolution.");
  }
  /**
  * Async driver creation — creates a realtime connection via the connector.
  *
  * Called by the base class's `instanceAsync()` when no cached
  * instance exists.
  *
  * @param _driver - The driver name (unused, connector handles it)
  * @param config - The connection configuration
  * @returns A promise resolving to the created RealtimeConnection
  */
  async createDriverAsync(_driver, config) {
    const connectionName = config.name ?? this.config.default;
    const conn = await this.connector.connect(config);
    this.emit(RealtimeEvents.CONNECTED, {
      connection: connectionName
    });
    return conn;
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Public API — Connection management
  // ─────────────────────────────────────────────────────────────────────────
  /**
  * Get a realtime connection by name.
  *
  * Connections are lazily created and cached. The first call for a
  * given name creates the connection via the connector. Subsequent
  * calls return the cached connection instantly.
  *
  * @param name - Connection name from config. Uses default if omitted.
  * @returns A promise resolving to the RealtimeConnection
  */
  async connection(name) {
    return await this.instanceAsync(name);
  }
  /**
  * Disconnect a specific connection and remove it from cache.
  *
  * @param name - Connection name. Uses default if omitted.
  */
  async disconnect(name) {
    const connectionName = name ?? this.config.default;
    if (this.hasInstance(connectionName)) {
      const conn = this.instance(connectionName);
      conn.disconnect();
      this.forgetInstance(connectionName);
      this.emit(RealtimeEvents.DISCONNECTED, {
        connection: connectionName,
        code: 1e3
      });
    }
  }
  /**
  * Disconnect all active connections and clear the cache.
  */
  async disconnectAll() {
    const names = this.getResolvedInstances();
    await Promise.all(names.map((n) => this.disconnect(n)));
    this.purge();
  }
  /**
  * Leave all channels on a specific connection (or the default).
  *
  * Useful for cleanup on logout or navigation away from a section
  * that uses realtime features.
  *
  * @param name - Connection name. Uses default if omitted.
  */
  async leaveAll(name) {
    const conn = await this.connection(name);
    conn.leaveAll();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Public API — Introspection
  // ─────────────────────────────────────────────────────────────────────────
  /**
  * Get all configured connection names (from config).
  */
  getConnectionNames() {
    return Object.keys(this.config.connections);
  }
  /**
  * Get the default connection name.
  */
  getDefaultConnectionName() {
    return this.config.default;
  }
  /**
  * Check if a connection has been resolved and is currently cached.
  *
  * @param name - Connection name. Uses default if omitted.
  */
  isConnectionActive(name) {
    return this.hasInstance(name ?? this.config.default);
  }
  /**
  * Get all active (cached) connection names.
  */
  getActiveConnectionNames() {
    return this.getResolvedInstances();
  }
  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────
  /**
  * Dispatch a realtime lifecycle event through the optional event manager.
  *
  * No-ops silently when `EventEmitterModule` is not in the app graph
  * (the manager will be `undefined`). Event dispatch failures are
  * caught and ignored — they should never break realtime operations.
  *
  * @param event - The event name (use {@link RealtimeEvents}).
  * @param payload - Optional event payload.
  */
  emit(event, payload) {
    if (!this.eventManager) return;
    try {
      this.eventManager.connection().emit(event, payload);
    } catch (error) {
      this.logger.warn("Failed to emit event", {
        event,
        error
      });
    }
  }
};
RealtimeManager2 = _ts_decorate([
  Injectable(),
  _ts_param(0, Inject(REALTIME_CONFIG)),
  _ts_param(1, Inject(REALTIME_CONNECTOR)),
  _ts_param(2, Optional()),
  _ts_param(2, Inject(EVENT_EMITTER_MANAGER)),
  _ts_param(3, Optional()),
  _ts_param(3, Inject(TAB_COORDINATOR)),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof RealtimeModuleOptions === "undefined" ? Object : RealtimeModuleOptions,
    typeof RealtimeConnector === "undefined" ? Object : RealtimeConnector,
    typeof EventEmitterManagerLike === "undefined" ? Object : EventEmitterManagerLike,
    typeof TabCoordinator === "undefined" ? Object : TabCoordinator
  ])
], RealtimeManager2);

// src/errors/realtime.error.ts
var RealtimeError = class extends Error {
  static {
    __name(this, "RealtimeError");
  }
  /** Error name for identification. */
  name = "RealtimeError";
  /** Error code for programmatic handling. */
  code = "REALTIME_ERROR";
  /** Optional underlying cause. */
  cause;
  /**
  * Create a new RealtimeError.
  *
  * @param message - Human-readable error message
  * @param cause   - Optional underlying error that caused this failure
  */
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};

// src/errors/realtime-connection.error.ts
var RealtimeConnectionError = class extends RealtimeError {
  static {
    __name(this, "RealtimeConnectionError");
  }
  /** Error name for identification. */
  name = "RealtimeConnectionError";
  /** Error code for programmatic handling. */
  code = "REALTIME_CONNECTION_ERROR";
};

// src/errors/realtime-channel.error.ts
var RealtimeChannelError = class extends RealtimeError {
  static {
    __name(this, "RealtimeChannelError");
  }
  /** Error name for identification. */
  name = "RealtimeChannelError";
  /** Error code for programmatic handling. */
  code = "REALTIME_CHANNEL_ERROR";
};

// src/services/channel-wrapper.service.ts
var ChannelWrapper = class {
  static {
    __name(this, "ChannelWrapper");
  }
  echoChannel;
  channelName;
  onLeave;
  /** Whether this channel has been left. */
  _left = false;
  /** Registered error callbacks. */
  _errorCallbacks = /* @__PURE__ */ new Set();
  /**
  * Creates a new ChannelWrapper.
  *
  * @param echoChannel - The underlying Laravel Echo channel object
  * @param channelName - The name of the channel
  * @param onLeave - Callback invoked when `leave()` is called, used by the manager to remove tracking
  */
  constructor(echoChannel, channelName, onLeave) {
    this.echoChannel = echoChannel;
    this.channelName = channelName;
    this.onLeave = onLeave;
  }
  /**
  * Register a typed event listener on this channel.
  *
  * Delegates to the underlying Echo channel's `listen()` method. Throws
  * if the channel has already been left.
  *
  * When the event name matches a key in the global `RealtimeEventPayloads` interface,
  * the payload type is automatically inferred. Otherwise, provide an explicit
  * type parameter or it defaults to `unknown`.
  *
  * @template E - The event name string
  * @template T - The expected event payload type (inferred from RealtimeEventPayloads if possible)
  * @param event - The broadcast event name (e.g., `'.order.created'`)
  * @param callback - Handler invoked with the typed event data
  * @returns This wrapper for method chaining
  * @throws {Error} If the channel has been left
  *
  * @example
  * ```typescript
  * // With RealtimeEventPayloads augmentation — type is inferred:
  * channel.listen('.order.created', (data) => {
  *   this.logger.info(data.id); // typed!
  * });
  *
  * // With explicit type parameter:
  * channel.listen<OrderEvent>('.order.created', (data) => {
  *   this.logger.info(data.id);
  * });
  * ```
  */
  listen(event, callback) {
    if (this._left) {
      throw new RealtimeChannelError(`Cannot listen on channel "${this.channelName}" \u2014 it has been left.`);
    }
    this.echoChannel.listen(event, callback);
    return this;
  }
  /**
  * Listen for ALL events on this channel.
  *
  * Uses Echo's `listenToAll()` which binds to the raw Pusher channel's
  * `bind_global`. This bypasses Echo's event name formatting and catches
  * every event regardless of naming convention.
  *
  * The callback receives the raw event name and data. Pusher internal
  * events (prefixed with `pusher:`) are automatically filtered out.
  *
  * @param callback - Handler invoked with event name and data
  * @returns This wrapper for method chaining
  * @throws {Error} If the channel has been left
  */
  listenToAll(callback) {
    if (this._left) {
      throw new RealtimeChannelError(`Cannot listen on channel "${this.channelName}" \u2014 it has been left.`);
    }
    this.echoChannel.listenToAll((event, data) => {
      callback(event, data);
    });
    return this;
  }
  /**
  * Remove a specific event listener from this channel.
  *
  * Delegates to the underlying Echo channel's `stopListening()` method.
  *
  * @param event - The broadcast event name to stop listening to
  * @param callback - Optional specific callback to remove. If omitted, all listeners for the event are removed.
  * @returns This wrapper for method chaining
  *
  * @example
  * ```typescript
  * // Remove all listeners for an event
  * channel.stopListening('.order.created');
  *
  * // Remove a specific listener
  * channel.stopListening('.order.created', myCallback);
  * ```
  */
  stopListening(event, callback) {
    this.echoChannel.stopListening(event, callback);
    return this;
  }
  /**
  * Send a client event (whisper) to other subscribers on this channel.
  *
  * Client events allow peer-to-peer communication without a server round-trip.
  * Only supported on private and presence channels — public channels do not
  * allow client events.
  *
  * @param event - The client event name (without the `client-` prefix)
  * @param data - The data to send to other subscribers
  * @returns This wrapper for method chaining
  * @throws {Error} If the channel has been left
  * @throws {Error} If the channel does not support whisper (public channels)
  *
  * @example
  * ```typescript
  * // Typing indicator
  * channel.whisper('typing', { user: 'John', typing: true });
  *
  * // Listen for whispers from others
  * channel.listenForWhisper('typing', (data) => {
  *   this.logger.info(`${data.user} is typing...`);
  * });
  * ```
  */
  whisper(event, data) {
    if (this._left) {
      throw new RealtimeChannelError(`Cannot whisper on channel "${this.channelName}" \u2014 it has been left.`);
    }
    if (typeof this.echoChannel.whisper !== "function") {
      throw new RealtimeChannelError(`Cannot whisper on channel "${this.channelName}" \u2014 client events are only supported on private and presence channels.`);
    }
    this.echoChannel.whisper(event, data);
    return this;
  }
  /**
  * Listen for a whisper event (client event) from other subscribers.
  *
  * Whisper events are prefixed with `client-` by the transport layer.
  * This method handles the prefix automatically.
  *
  * @template T - The expected whisper payload type
  * @param event - The whisper event name (without the `client-` prefix)
  * @param callback - Handler invoked with the whisper data
  * @returns This wrapper for method chaining
  * @throws {Error} If the channel has been left
  *
  * @example
  * ```typescript
  * channel.listenForWhisper<TypingEvent>('typing', (data) => {
  *   this.logger.info(`${data.user} is ${data.typing ? 'typing' : 'idle'}`);
  * });
  * ```
  */
  listenForWhisper(event, callback) {
    if (this._left) {
      throw new RealtimeChannelError(`Cannot listen on channel "${this.channelName}" \u2014 it has been left.`);
    }
    this.echoChannel.listenForWhisper(event, callback);
    return this;
  }
  /**
  * Listen for Laravel notification broadcasts on this channel.
  *
  * Delegates to the underlying Echo channel's `notification()` method,
  * which listens for `Illuminate\Notifications\Events\BroadcastNotificationCreated`.
  * Typically used on private user channels (e.g., `App.Models.User.{id}`).
  *
  * Throws if the channel has been left or if the underlying transport
  * does not support `.notification()` (e.g., public channels).
  *
  * @template T - The expected notification payload type
  * @param callback - Handler invoked with the typed notification data
  * @returns This wrapper for method chaining
  * @throws {Error} If the channel has been left
  * @throws {Error} If the underlying channel does not support notifications
  *
  * @example
  * ```typescript
  * const userChannel = manager.private('App.Models.User.1');
  *
  * userChannel.notification<IncomingNotification>((notification) => {
  *   this.logger.info(notification.type, notification.data);
  * });
  * ```
  */
  notification(callback) {
    if (this._left) {
      throw new RealtimeChannelError(`Cannot listen on channel "${this.channelName}" \u2014 it has been left.`);
    }
    if (typeof this.echoChannel.notification !== "function") {
      throw new RealtimeChannelError(`Channel "${this.channelName}" does not support .notification(). This method is only available on private and presence channels.`);
    }
    this.echoChannel.notification(callback);
    return this;
  }
  /**
  * Register an error callback for this channel.
  *
  * Error callbacks are invoked when the channel encounters an error,
  * such as an authentication failure on a private or presence channel.
  * The callback is also bound to the underlying Echo channel's error event
  * so that transport-level errors are surfaced automatically.
  *
  * @param callback - Handler invoked with the error
  * @returns This wrapper for method chaining
  *
  * @example
  * ```typescript
  * channel.onError((error) => {
  *   this.logger.error('Auth failed:', error.message);
  * });
  * ```
  */
  onError(callback) {
    this._errorCallbacks.add(callback);
    if (typeof this.echoChannel.error === "function") {
      this.echoChannel.error((error) => {
        const err = error instanceof Error ? error : new Error(error?.message ?? "Channel error");
        callback(err);
      });
    }
    return this;
  }
  /**
  * Leave this channel, unsubscribing from all events.
  *
  * Notifies the manager to remove this channel from its internal tracking
  * and marks the wrapper as left. Subsequent calls to `listen()` will throw.
  *
  * @example
  * ```typescript
  * channel.leave();
  * ```
  */
  leave() {
    if (this._left) return;
    this._left = true;
    this.onLeave(this.channelName);
  }
  /**
  * The name of this channel.
  *
  * @returns The channel name string
  *
  * @example
  * ```typescript
  * const channel = manager.channel('orders');
  * this.logger.info(channel.name); // 'orders'
  * ```
  */
  get name() {
    return this.channelName;
  }
  /**
  * Whether this channel has been left.
  *
  * @returns `true` if `leave()` has been called
  */
  get isLeft() {
    return this._left;
  }
  /**
  * Notify all registered error callbacks.
  *
  * @param error - The error to propagate
  * @internal
  */
  _notifyError(error) {
    for (const cb of this._errorCallbacks) {
      cb(error);
    }
  }
};

// src/services/presence-channel-wrapper.service.ts
var PresenceChannelWrapper = class extends ChannelWrapper {
  static {
    __name(this, "PresenceChannelWrapper");
  }
  /** Current list of presence channel members. */
  _members = [];
  /**
  * Register a callback for the initial member list.
  *
  * Delegates to the underlying Echo channel's `here()` method. The internal
  * members list is updated **before** the callback is invoked.
  *
  * @template T - The member type
  * @param callback - Handler invoked with the full list of current members
  * @returns This wrapper for method chaining
  *
  * @example
  * ```typescript
  * presence.here<User>((members) => {
  *   this.logger.info('Online:', members.length);
  * });
  * ```
  */
  here(callback) {
    this.echoChannel.here((members) => {
      this._members = [
        ...members
      ];
      callback(members);
    });
    return this;
  }
  /**
  * Register a callback for member join events.
  *
  * Delegates to the underlying Echo channel's `joining()` method. The new
  * member is added to the internal list **before** the callback is invoked.
  *
  * @template T - The member type
  * @param callback - Handler invoked with the joining member
  * @returns This wrapper for method chaining
  *
  * @example
  * ```typescript
  * presence.joining<User>((member) => {
  *   this.logger.info(`${member.name} joined`);
  * });
  * ```
  */
  joining(callback) {
    this.echoChannel.joining((member) => {
      this._members = [
        ...this._members,
        member
      ];
      callback(member);
    });
    return this;
  }
  /**
  * Register a callback for member leave events.
  *
  * Delegates to the underlying Echo channel's `leaving()` method. The
  * departing member is removed from the internal list **before** the
  * callback is invoked.
  *
  * @template T - The member type
  * @param callback - Handler invoked with the leaving member
  * @returns This wrapper for method chaining
  *
  * @example
  * ```typescript
  * presence.leaving<User>((member) => {
  *   this.logger.info(`${member.name} left`);
  * });
  * ```
  */
  leaving(callback) {
    this.echoChannel.leaving((member) => {
      this._members = this._members.filter((m) => m !== member);
      callback(member);
    });
    return this;
  }
  /**
  * Get the current list of members in this presence channel.
  *
  * Returns a shallow copy of the internal members array to prevent
  * external mutation.
  *
  * @template T - The member type
  * @returns A copy of the current members array
  *
  * @example
  * ```typescript
  * const members = presence.getMembers<User>();
  * this.logger.info(`${members.length} users online`);
  * ```
  */
  getMembers() {
    return [
      ...this._members
    ];
  }
};
var EchoConnection = class {
  static {
    __name(this, "EchoConnection");
  }
  config;
  name;
  dispatchFn;
  /** The Laravel Echo instance, or null when disconnected. */
  echo = null;
  /** Current connection status. */
  status = ConnectionStatus.Disconnected;
  /** Registered status change listeners. */
  listeners = /* @__PURE__ */ new Set();
  /** Active public and private channel subscriptions. */
  channels = /* @__PURE__ */ new Map();
  /** Active presence channel subscriptions. */
  presenceChannels = /* @__PURE__ */ new Map();
  /** Pending reconnection timer. */
  reconnectTimer = null;
  /** Consecutive failed reconnection attempts since last successful connection. */
  _reconnectAttempts = 0;
  /**
  * Creates a new EchoConnection.
  *
  * @param config - The connection configuration
  * @param name - The connection name
  */
  constructor(config, name, dispatchFn) {
    this.config = config;
    this.name = name;
    this.dispatchFn = dispatchFn;
  }
  // ---------------------------------------------------------------------------
  // RealtimeConnection interface
  // ---------------------------------------------------------------------------
  /**
  * Get the connection name.
  */
  getName() {
    return this.name;
  }
  /**
  * Get the current connection status.
  */
  getStatus() {
    return this.status;
  }
  /**
  * Whether the connection is currently active.
  */
  isConnected() {
    return this.status === ConnectionStatus.Connected;
  }
  /**
  * The number of consecutive failed reconnection attempts.
  */
  get reconnectAttempts() {
    return this._reconnectAttempts;
  }
  /**
  * Register a listener for connection status changes.
  * Returns an unsubscribe function.
  */
  onStatusChange(callback) {
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
  connect() {
    if (this.echo) {
      return;
    }
    this._setStatus(ConnectionStatus.Connecting);
    const pusherInstance = new Pusher(this.config.key, {
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      disableStats: this.config.disableStats ?? true,
      enabledTransports: [
        "ws",
        "wss"
      ],
      authEndpoint: this.config.authEndpoint
    });
    const echoOptions = {
      broadcaster: this.config.driver === "echo" ? "reverb" : this.config.driver,
      key: this.config.key,
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      encrypted: this.config.encrypted ?? false,
      disableStats: this.config.disableStats ?? true,
      enabledTransports: [
        "ws",
        "wss"
      ],
      auth: {
        headers: this.config.authHeaders ?? {}
      },
      authEndpoint: this.config.authEndpoint,
      client: pusherInstance
    };
    this.echo = new Echo(echoOptions);
    this._bindConnectionEvents();
  }
  /**
  * Disconnect the WebSocket and release all resources.
  *
  * Calls `echo.disconnect()`, clears all channel tracking maps, cancels
  * any pending reconnection timer, and sets the status to `Disconnected`.
  */
  disconnect() {
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
  socketId() {
    if (!this.echo) return void 0;
    return this.echo.socketId();
  }
  /**
  * Leave all channels (public, private, and presence) on this connection.
  *
  * Iterates all tracked channel and presence channel wrappers, calls `leave()`
  * on each, and clears the internal tracking maps.
  */
  leaveAll() {
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
  channel(name) {
    this._assertConnected();
    const existing = this.channels.get(name);
    if (existing) return existing;
    const echoChannel = this.echo.channel(name);
    const wrapper = new ChannelWrapper(echoChannel, name, (n) => this._removeChannel(n));
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
  private(name) {
    this._assertConnected();
    const existing = this.channels.get(`private:${name}`);
    if (existing) return existing;
    const echoChannel = this.echo.private(name);
    const wrapper = new ChannelWrapper(echoChannel, `private:${name}`, (n) => this._removeChannel(n));
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
  join(name) {
    this._assertConnected();
    const existing = this.presenceChannels.get(name);
    if (existing) return existing;
    const echoChannel = this.echo.join(name);
    const wrapper = new PresenceChannelWrapper(echoChannel, name, (n) => this._removePresenceChannel(n));
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
  _autoBridge(wrapper) {
    if (!this.dispatchFn) return;
    const dispatch = this.dispatchFn;
    wrapper.listenToAll((event, data) => {
      dispatch(`realtime:${wrapper.name}.${event}`, data);
    });
  }
  /**
  * Update the connection status and notify all listeners.
  * @internal
  */
  _setStatus(newStatus) {
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
  _assertConnected() {
    if (!this.echo || this.status !== ConnectionStatus.Connected) {
      throw new RealtimeConnectionError("EchoConnection is not connected. Check isConnected() or getStatus() before subscribing to channels.");
    }
  }
  /**
  * Remove a public/private channel from tracking.
  * @internal
  */
  _removeChannel(name) {
    this.channels.delete(name);
    if (this.echo && this.status === ConnectionStatus.Connected) {
      try {
        this.echo.leave(name);
      } catch (error) {
      }
    }
  }
  /**
  * Remove a presence channel from tracking.
  * @internal
  */
  _removePresenceChannel(name) {
    this.presenceChannels.delete(name);
    if (this.echo && this.status === ConnectionStatus.Connected) {
      try {
        this.echo.leave(name);
      } catch (error) {
      }
    }
  }
  /**
  * Bind to Pusher connection events for state tracking and reconnection.
  * @internal
  */
  _bindConnectionEvents() {
    if (!this.echo) {
      return;
    }
    const connector = this.echo.connector;
    let pusherInstance = connector?.pusher;
    if (typeof pusherInstance === "function") {
      if (connector.socket) {
        pusherInstance = connector.socket;
      } else if (connector.pusher && connector.pusher.instances && connector.pusher.instances.length > 0) {
        pusherInstance = connector.pusher.instances[connector.pusher.instances.length - 1];
      } else {
        return;
      }
    }
    if (!pusherInstance) {
      return;
    }
    if (typeof pusherInstance.connection !== "undefined") {
      this._bindPusherEvents(pusherInstance);
    } else {
      const waitForConnection = /* @__PURE__ */ __name((attempt = 0, maxAttempts = 50) => {
        if (!pusherInstance.connection) {
          if (attempt < maxAttempts) {
            setTimeout(() => waitForConnection(attempt + 1, maxAttempts), 100);
          }
          return;
        }
        this._bindPusherEvents(pusherInstance);
      }, "waitForConnection");
      waitForConnection();
    }
  }
  /**
  * Bind to Pusher connection events.
  * @internal
  */
  _bindPusherEvents(pusher) {
    pusher.connection.bind("state_change", (states) => {
      switch (states.current) {
        case "connected":
          this._reconnectAttempts = 0;
          this._setStatus(ConnectionStatus.Connected);
          this._resubscribeChannels();
          break;
        case "connecting":
        case "unavailable":
          if (this.status !== ConnectionStatus.Connecting && this.status !== ConnectionStatus.Reconnecting) {
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
    pusher.connection.bind("error", (error) => {
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
  _startReconnect() {
    if (this.status === ConnectionStatus.Disconnected) return;
    this._setStatus(ConnectionStatus.Reconnecting);
    this._scheduleReconnect();
  }
  /**
  * Schedule a single reconnection attempt with exponential backoff.
  * @internal
  */
  _scheduleReconnect() {
    const initialDelay = this.config.reconnectInitialDelay ?? 1e3;
    const multiplier = this.config.reconnectMultiplier ?? 2;
    const maxDelay = this.config.reconnectMaxDelay ?? 3e4;
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
  _attemptReconnect() {
    if (this.echo) {
      this.echo.disconnect();
      this.echo = null;
    }
    this._setStatus(ConnectionStatus.Connecting);
    const pusherInstance = new Pusher(this.config.key, {
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      disableStats: this.config.disableStats ?? true,
      enabledTransports: [
        "ws",
        "wss"
      ],
      authEndpoint: this.config.authEndpoint
    });
    const echoOptions = {
      broadcaster: this.config.driver === "echo" ? "reverb" : this.config.driver,
      key: this.config.key,
      wsHost: this.config.wsHost,
      wsPort: this.config.wsPort,
      forceTLS: this.config.forceTLS ?? false,
      cluster: this.config.cluster ?? "mt1",
      encrypted: this.config.encrypted ?? false,
      disableStats: this.config.disableStats ?? true,
      enabledTransports: [
        "ws",
        "wss"
      ],
      auth: {
        headers: this.config.authHeaders ?? {}
      },
      authEndpoint: this.config.authEndpoint,
      client: pusherInstance
    };
    this.echo = new Echo(echoOptions);
    this._bindConnectionEvents();
  }
  /**
  * Cancel any pending reconnection timer.
  * @internal
  */
  _cancelReconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  /**
  * Re-subscribe all tracked channels after a successful reconnection.
  * @internal
  */
  _resubscribeChannels() {
    if (!this.echo) return;
    for (const [name, wrapper] of this.channels.entries()) {
      if (wrapper.isLeft) {
        this.channels.delete(name);
        continue;
      }
      if (Str.startsWith(name, "private:")) {
        const channelName = name.slice("private:".length);
        const echoChannel = this.echo.private(channelName);
        wrapper.echoChannel = echoChannel;
      } else {
        const echoChannel = this.echo.channel(name);
        wrapper.echoChannel = echoChannel;
      }
    }
    for (const [name, wrapper] of this.presenceChannels.entries()) {
      if (wrapper.isLeft) {
        this.presenceChannels.delete(name);
        continue;
      }
      const echoChannel = this.echo.join(name);
      wrapper.echoChannel = echoChannel;
    }
  }
};
function _ts_decorate2(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate2, "_ts_decorate");
var LaravelEchoConnector2 = class _LaravelEchoConnector {
  static {
    __name(this, "LaravelEchoConnector");
  }
  /**
  * Logger instance scoped to the LaravelEchoConnector context.
  */
  logger = new Logger(_LaravelEchoConnector.name);
  /** Optional event dispatch function — set by RealtimeModule to bridge WS → ts-events. */
  emitFn;
  /**
  * Sets the event dispatch function for auto-bridging WS events into ts-events.
  *
  * Called by RealtimeModule during initialization when @stackra/ts-events
  * is available. This avoids a direct dependency on ts-events.
  *
  * @param fn - A function that dispatches events (typically eventEmitterManager.emit)
  */
  setDispatchFn(fn) {
    this.emitFn = fn;
  }
  /**
  * Create a realtime connection from the given config.
  *
  * When credentials (key/host) are missing, returns a no-op connection
  * stub instead of throwing. This allows the application to boot without
  * WebSocket credentials — channel/private/join calls will throw at
  * usage time with a clear message.
  *
  * @param config - The connection configuration.
  * @returns A live EchoConnection or a no-op stub.
  */
  async connect(config) {
    if (!config.key) {
      this.logger.warn("Returning no-op connection: Pusher application key is not configured. Set VITE_REVERB_APP_KEY or VITE_PUSHER_APP_KEY in your .env file.");
      return this.createNoOpConnection();
    }
    if (!config.wsHost) {
      this.logger.warn("Returning no-op connection: WebSocket host is not configured. Set VITE_REVERB_HOST or VITE_PUSHER_HOST in your .env file.");
      return this.createNoOpConnection();
    }
    const connection = new EchoConnection(config, config.driver, this.emitFn);
    connection.connect();
    return connection;
  }
  // ── No-Op Connection ────────────────────────────────────────────────────
  /**
  * Creates a no-op connection stub when credentials are missing.
  *
  * All lifecycle methods are safe to call but do nothing. Channel
  * subscription methods throw a descriptive error at usage time so
  * developers know credentials are needed.
  *
  * @returns A RealtimeConnection stub.
  */
  createNoOpConnection() {
    const notConfigured = /* @__PURE__ */ __name((method) => new RealtimeConnectionError(`Cannot call ${method}() \u2014 realtime is not configured. Set VITE_REVERB_APP_KEY + VITE_REVERB_HOST in your .env file.`), "notConfigured");
    return {
      getName: /* @__PURE__ */ __name(() => "no-op", "getName"),
      getStatus: /* @__PURE__ */ __name(() => ConnectionStatus.Disconnected, "getStatus"),
      isConnected: /* @__PURE__ */ __name(() => false, "isConnected"),
      connect: /* @__PURE__ */ __name(() => {
      }, "connect"),
      disconnect: /* @__PURE__ */ __name(() => {
      }, "disconnect"),
      channel: /* @__PURE__ */ __name(() => {
        throw notConfigured("channel");
      }, "channel"),
      private: /* @__PURE__ */ __name(() => {
        throw notConfigured("private");
      }, "private"),
      join: /* @__PURE__ */ __name(() => {
        throw notConfigured("join");
      }, "join"),
      onStatusChange: /* @__PURE__ */ __name(() => () => {
      }, "onStatusChange"),
      socketId: /* @__PURE__ */ __name(() => void 0, "socketId"),
      leaveAll: /* @__PURE__ */ __name(() => {
      }, "leaveAll"),
      reconnectAttempts: 0
    };
  }
};
LaravelEchoConnector2 = _ts_decorate2([
  Injectable()
], LaravelEchoConnector2);
function _ts_decorate3(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate3, "_ts_decorate");
function _ts_metadata2(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
__name(_ts_metadata2, "_ts_metadata");
function _ts_param2(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param2, "_ts_param");
var RealtimeEventsBridgeListener = class _RealtimeEventsBridgeListener {
  static {
    __name(this, "RealtimeEventsBridgeListener");
  }
  connector;
  eventManager;
  /**
  * Logger scoped to the bridge listener.
  */
  logger = new Logger(_RealtimeEventsBridgeListener.name);
  /**
  * @param connector - The realtime connector. Required (always present
  *   because `RealtimeModule` registers it).
  * @param eventManager - Optional events manager. Resolved via DI when
  *   `@stackra/ts-events` is in the application graph.
  */
  constructor(connector, eventManager) {
    this.connector = connector;
    this.eventManager = eventManager;
  }
  /**
  * Wire the connector's dispatch function so every channel subscription
  * auto-bridges its events into the events bus.
  *
  * Runs after every provider is initialised so the events manager (if
  * any) is fully ready.
  */
  onApplicationBootstrap() {
    if (!this.eventManager) {
      this.logger.debug("Skipping bridge: @stackra/ts-events is not registered. Realtime events will not be dispatched into the events bus.");
      return;
    }
    const eventManager = this.eventManager;
    this.connector.setDispatchFn((event, data) => {
      try {
        eventManager.connection().emit(event, data);
      } catch (err) {
        this.logger.warn("Failed to dispatch realtime event into events bus", {
          event,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });
    this.logger.debug("Bridge wired: realtime channel events will dispatch into the events bus.");
  }
};
RealtimeEventsBridgeListener = _ts_decorate3([
  Injectable(),
  _ts_param2(0, Inject(REALTIME_CONNECTOR)),
  _ts_param2(1, Optional()),
  _ts_param2(1, Inject(EVENT_EMITTER_MANAGER)),
  _ts_metadata2("design:type", Function),
  _ts_metadata2("design:paramtypes", [
    typeof LaravelEchoConnector === "undefined" ? Object : LaravelEchoConnector,
    typeof EventEmitterManagerLike === "undefined" ? Object : EventEmitterManagerLike
  ])
], RealtimeEventsBridgeListener);
function _ts_decorate4(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate4, "_ts_decorate");
function _ts_metadata3(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
__name(_ts_metadata3, "_ts_metadata");
function _ts_param3(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param3, "_ts_param");
var SocketIdMiddleware = class _SocketIdMiddleware {
  static {
    __name(this, "SocketIdMiddleware");
  }
  realtime;
  /**
  * Logger scoped to the middleware.
  */
  logger = new Logger(_SocketIdMiddleware.name);
  /**
  * @param realtime - The realtime manager. Required — the middleware
  *   only ships when `RealtimeModule.forRoot()` is in the graph.
  */
  constructor(realtime2) {
    this.realtime = realtime2;
  }
  /**
  * Inject the `X-Socket-Id` header from the active realtime connection.
  *
  * Failures here are logged and swallowed — the http request must
  * never break because realtime isn't ready yet.
  *
  * @param context - The HTTP context flowing through the pipeline.
  * @param next - The next middleware in the chain.
  * @returns The HTTP response from downstream.
  */
  async handle(context, next) {
    try {
      const conn = await this.realtime.connection();
      const socketId = conn.socketId();
      if (socketId) {
        context.request.headers = {
          ...context.request.headers,
          "X-Socket-Id": socketId
        };
      }
    } catch (err) {
      this.logger.debug("Skipping X-Socket-Id header: realtime not ready", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
    return next(context);
  }
};
SocketIdMiddleware = _ts_decorate4([
  HttpMiddleware({
    priority: 25,
    name: "realtime:socket-id"
  }),
  _ts_param3(0, Inject(REALTIME_MANAGER)),
  _ts_metadata3("design:type", Function),
  _ts_metadata3("design:paramtypes", [
    typeof RealtimeManager === "undefined" ? Object : RealtimeManager
  ])
], SocketIdMiddleware);
var getRealtimeConnectionToken = /* @__PURE__ */ __name((connectionName = "default") => `RealtimeConnection:${connectionName}`, "getRealtimeConnectionToken");
var InjectRealtime = /* @__PURE__ */ __name((connectionName) => Inject(getRealtimeConnectionToken(connectionName)), "InjectRealtime");
function _ts_decorate5(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate5, "_ts_decorate");
var RealtimeModule = class _RealtimeModule {
  static {
    __name(this, "RealtimeModule");
  }
  /**
  * Logger instance scoped to the RealtimeModule context.
  */
  static logger = new Logger(_RealtimeModule.name);
  /**
  * Check if Realtime credentials are configured.
  *
  * Returns `true` only when non-empty key AND host are set for at least
  * one driver (Pusher or Reverb). Empty strings from env vars are treated
  * as unconfigured.
  */
  static hasCredentials() {
    try {
      const pusherKey = String(Env.get("VITE_PUSHER_APP_KEY", "") ?? "").trim();
      const pusherHost = String(Env.get("VITE_PUSHER_HOST", "") ?? "").trim();
      const reverbKey = String(Env.get("VITE_REVERB_APP_KEY", "") ?? "").trim();
      const reverbHost = String(Env.get("VITE_REVERB_HOST", "") ?? "").trim();
      const hasPusher = pusherKey.length > 0 && pusherHost.length > 0;
      const hasReverb = reverbKey.length > 0 && reverbHost.length > 0;
      return hasPusher || hasReverb;
    } catch {
      return false;
    }
  }
  /**
  * Configure the realtime WebSocket connections.
  *
  * @param config - The realtime module configuration.
  * @returns A dynamic module.
  */
  static forRoot(config) {
    if (!_RealtimeModule.hasCredentials()) {
      _RealtimeModule.logger.warn("Skipping registration: Either (VITE_PUSHER_APP_KEY + VITE_PUSHER_HOST) or (VITE_REVERB_APP_KEY + VITE_REVERB_HOST) are required.");
      return {
        module: _RealtimeModule,
        providers: [],
        exports: []
      };
    }
    const connectionProviders = Object.keys(config.connections).map((connectionName) => ({
      provide: getRealtimeConnectionToken(connectionName),
      useFactory: /* @__PURE__ */ __name(async (manager) => manager.connection(connectionName), "useFactory"),
      inject: [
        RealtimeManager2
      ]
    }));
    const defaultConnectionProvider = {
      provide: getRealtimeConnectionToken(),
      useFactory: /* @__PURE__ */ __name(async (manager) => manager.connection(), "useFactory"),
      inject: [
        RealtimeManager2
      ]
    };
    const connectionTokens = [
      getRealtimeConnectionToken(),
      ...Object.keys(config.connections).map(getRealtimeConnectionToken)
    ];
    return {
      module: _RealtimeModule,
      global: true,
      providers: [
        {
          provide: REALTIME_CONFIG,
          useValue: config
        },
        {
          provide: RealtimeManager2,
          useClass: RealtimeManager2
        },
        {
          provide: REALTIME_MANAGER,
          useExisting: RealtimeManager2
        },
        {
          provide: REALTIME_CONNECTOR,
          useClass: LaravelEchoConnector2
        },
        defaultConnectionProvider,
        ...connectionProviders,
        // Bridges WebSocket events into @stackra/ts-events when present.
        RealtimeEventsBridgeListener,
        // Auto-discovered by the @stackra/ts-http middleware pipeline.
        SocketIdMiddleware
      ],
      exports: [
        RealtimeManager2,
        REALTIME_MANAGER,
        ...connectionTokens
      ]
    };
  }
};
RealtimeModule = _ts_decorate5([
  Module({})
], RealtimeModule);
var IRedisConnection = class _IRedisConnection {
  static {
    __name(this, "IRedisConnection");
  }
  name;
  /**
  * Logger instance scoped to the IRedisConnection context.
  */
  logger = new Logger(_IRedisConnection.name);
  /** The Redis connection instance. */
  redis;
  /** Current connection status. */
  status = ConnectionStatus.Disconnected;
  /** Registered status change listeners. */
  listeners = /* @__PURE__ */ new Set();
  /** Active public and private channel subscriptions. */
  channels = /* @__PURE__ */ new Map();
  /** Active presence channel subscriptions. */
  presenceChannels = /* @__PURE__ */ new Map();
  /** Polling configuration. */
  pollInterval;
  keyPrefix;
  maxEvents;
  /** Polling state. */
  pollingTimers = /* @__PURE__ */ new Map();
  channelCursors = /* @__PURE__ */ new Map();
  /** Reconnection state. */
  _reconnectAttempts = 0;
  /**
  * Creates a new IRedisConnection.
  *
  * @param config - The Redis connection configuration
  * @param name - The connection name
  */
  constructor(config, name) {
    this.name = name;
    this.redis = config.redisConnection;
    this.pollInterval = config.pollInterval ?? 2e3;
    this.keyPrefix = config.keyPrefix ?? "realtime:";
    this.maxEvents = config.maxEventsPerChannel ?? 100;
  }
  // ---------------------------------------------------------------------------
  // RealtimeConnection interface
  // ---------------------------------------------------------------------------
  /**
  * Get the connection name.
  */
  getName() {
    return this.name;
  }
  /**
  * Get the current connection status.
  */
  getStatus() {
    return this.status;
  }
  /**
  * Whether the connection is currently active.
  */
  isConnected() {
    return this.status === ConnectionStatus.Connected;
  }
  /**
  * The number of consecutive failed reconnection attempts.
  */
  get reconnectAttempts() {
    return this._reconnectAttempts;
  }
  /**
  * Register a listener for connection status changes.
  * Returns an unsubscribe function.
  */
  onStatusChange(callback) {
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
  connect() {
    if (this.status === ConnectionStatus.Connected) {
      return;
    }
    this._setStatus(ConnectionStatus.Connecting);
    this._reconnectAttempts = 0;
    this._setStatus(ConnectionStatus.Connected);
  }
  /**
  * Disconnect and release all resources.
  *
  * Stops all polling timers, clears channel tracking, and sets status
  * to `Disconnected`.
  */
  disconnect() {
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
  socketId() {
    return void 0;
  }
  /**
  * Leave all subscribed channels — public, private, and presence.
  *
  * Stops every active polling timer and clears the in-memory channel
  * registries. The connection itself remains in {@link ConnectionStatus.Connected}
  * (Redis is connectionless), so new subscriptions are still possible.
  */
  leaveAll() {
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
  channel(name) {
    this._assertConnected();
    const existing = this.channels.get(name);
    if (existing) return existing;
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
  private(name) {
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
  join(name) {
    this._assertConnected();
    const existing = this.presenceChannels.get(name);
    if (existing) return existing;
    const mockEchoChannel = this._createMockEchoChannel(`presence:${name}`);
    const wrapper = new PresenceChannelWrapper(mockEchoChannel, name, (n) => this._removePresenceChannel(n));
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
  async publish(channel, event, data) {
    const key = this._listKey(channel);
    const score = Date.now();
    const payload = {
      channel,
      event,
      data,
      timestamp: score,
      _idx: score
    };
    const serialized = JSON.stringify(payload);
    await this.redis.zadd(key, score, serialized);
    const total = await this.redis.zrange(key, 0, -1);
    if (total.length > this.maxEvents) {
      await this.redis.zremrangebyscore(key, 0, score - this.maxEvents);
    }
    await this.redis.publish(channel, serialized);
  }
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------
  /**
  * Build the Redis list key for a channel.
  */
  _listKey(channel) {
    return `${this.keyPrefix}${channel}`;
  }
  /**
  * Create a mock Echo channel object for ChannelWrapper compatibility.
  */
  _createMockEchoChannel(channelName) {
    const listeners = /* @__PURE__ */ new Map();
    return {
      listen: /* @__PURE__ */ __name((event, callback) => {
        if (!listeners.has(event)) {
          listeners.set(event, /* @__PURE__ */ new Set());
        }
        listeners.get(event).add(callback);
        return this._createMockEchoChannel(channelName);
      }, "listen"),
      notification: /* @__PURE__ */ __name((callback) => {
        return this._createMockEchoChannel(channelName).listen(".notification", callback);
      }, "notification"),
      listenForWhisper: /* @__PURE__ */ __name((event, callback) => {
        return this._createMockEchoChannel(channelName).listen(`.whisper:${event}`, callback);
      }, "listenForWhisper"),
      whisper: /* @__PURE__ */ __name(async (event, data) => {
        await this.publish(channelName, `.whisper:${event}`, data);
      }, "whisper"),
      stopListening: /* @__PURE__ */ __name((event, callback) => {
        if (callback) {
          listeners.get(event)?.delete(callback);
        } else {
          listeners.delete(event);
        }
        return this._createMockEchoChannel(channelName);
      }, "stopListening"),
      _trigger: /* @__PURE__ */ __name((event, data) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          for (const callback of eventListeners) {
            try {
              callback(data);
            } catch (error) {
              this.logger.error(`Error in channel listener for ${event}:`, {
                error: String(error)
              });
            }
          }
        }
      }, "_trigger"),
      _listeners: listeners
    };
  }
  /**
  * Start polling for a channel.
  */
  _startPolling(channelName) {
    if (this.pollingTimers.has(channelName)) {
      return;
    }
    this.channelCursors.set(channelName, 0);
    const poll = /* @__PURE__ */ __name(async () => {
      if (!this.pollingTimers.has(channelName)) {
        return;
      }
      try {
        const key = this._listKey(channelName);
        const cursor = this.channelCursors.get(channelName) ?? 0;
        const raw = await this.redis.zrange(key, cursor, -1);
        for (const entry of raw) {
          try {
            const event = JSON.parse(entry);
            const idx = event._idx ?? 0;
            if (idx > cursor) {
              this.channelCursors.set(channelName, idx);
            }
            const wrapper = this.channels.get(channelName) ?? this.presenceChannels.get(channelName);
            if (wrapper) {
              const mockChannel = wrapper.echoChannel;
              if (mockChannel && mockChannel._trigger) {
                mockChannel._trigger(event.event, event.data);
              }
            }
          } catch (error) {
            this.logger.error("Error parsing Redis event:", {
              error: String(error)
            });
          }
        }
      } catch (error) {
        this.logger.error("Error polling Redis channel:", {
          error: String(error)
        });
      }
      if (this.pollingTimers.has(channelName)) {
        const timer2 = setTimeout(poll, this.pollInterval);
        this.pollingTimers.set(channelName, timer2);
      }
    }, "poll");
    const timer = setTimeout(poll, this.pollInterval);
    this.pollingTimers.set(channelName, timer);
  }
  /**
  * Stop polling for a channel.
  */
  _stopPolling(channelName) {
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
  _setStatus(newStatus) {
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
  _assertConnected() {
    if (this.status !== ConnectionStatus.Connected) {
      throw new RealtimeConnectionError("IRedisConnection is not connected. Check isConnected() or getStatus() before subscribing to channels.");
    }
  }
  /**
  * Remove a public/private channel from tracking.
  * @internal
  */
  _removeChannel(name) {
    this._stopPolling(name);
    this.channels.delete(name);
  }
  /**
  * Remove a presence channel from tracking.
  * @internal
  */
  _removePresenceChannel(name) {
    this._stopPolling(`presence:${name}`);
    this.presenceChannels.delete(name);
  }
};

// src/connectors/redis.connector.ts
function _ts_decorate6(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate6, "_ts_decorate");
function _ts_metadata4(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
__name(_ts_metadata4, "_ts_metadata");
function _ts_param4(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param4, "_ts_param");
var IRedisConnector = class {
  static {
    __name(this, "IRedisConnector");
  }
  redisManager;
  constructor(redisManager) {
    this.redisManager = redisManager;
  }
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
  async connect(config) {
    const redisConfig = config;
    let redisConnection = redisConfig.redisConnection;
    if (!redisConnection) {
      const connectionName = redisConfig.redisConnectionName;
      if (!connectionName) {
        throw new RealtimeConnectionError("IRedisConnector: Either redisConnection or redisConnectionName is required.");
      }
      try {
        redisConnection = await this.redisManager.connection(connectionName);
      } catch (error) {
        throw new RealtimeConnectionError(`IRedisConnector: Failed to get Redis connection "${connectionName}": ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : void 0);
      }
    }
    const fullConfig = {
      ...config,
      redisConnection,
      pollInterval: redisConfig.pollInterval,
      keyPrefix: redisConfig.keyPrefix,
      maxEventsPerChannel: redisConfig.maxEventsPerChannel
    };
    const connection = new IRedisConnection(fullConfig, config.driver);
    connection.connect();
    return connection;
  }
};
IRedisConnector = _ts_decorate6([
  Injectable(),
  _ts_param4(0, Inject(REDIS_MANAGER)),
  _ts_metadata4("design:type", Function),
  _ts_metadata4("design:paramtypes", [
    typeof RedisManager === "undefined" ? Object : RedisManager
  ])
], IRedisConnector);
var realtime = inject(REALTIME_MANAGER);
var channelRefCounts = /* @__PURE__ */ new Map();
function useChannel(channelName, eventName, options) {
  const manager = useInject(REALTIME_MANAGER);
  if (!manager) {
    throw new RealtimeError("RealtimeManager not found. Import RealtimeModule.forRoot() in your app module.");
  }
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const connRef = useRef(null);
  const channelRef = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let unsubscribe;
    const resolve = /* @__PURE__ */ __name(async () => {
      try {
        const conn = await manager.connection();
        if (cancelled) return;
        connRef.current = conn;
        setConnected(conn.isConnected());
        unsubscribe = conn.onStatusChange(() => {
          setConnected(conn.isConnected());
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to resolve connection"));
        }
      }
    }, "resolve");
    resolve();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    manager,
    enabled
  ]);
  useEffect(() => {
    if (!enabled || !connected || !connRef.current) return;
    const conn = connRef.current;
    let wrapper;
    try {
      wrapper = conn.channel(channelName);
      channelRef.current = wrapper;
      const currentCount = channelRefCounts.get(channelName) ?? 0;
      channelRefCounts.set(channelName, currentCount + 1);
      wrapper.listen(eventName, (eventData) => {
        setData(eventData);
      }).onError((err) => {
        setError(err);
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to subscribe"));
      return;
    }
    return () => {
      try {
        wrapper.stopListening(eventName);
      } catch {
      }
      const count = channelRefCounts.get(channelName) ?? 1;
      if (count <= 1) {
        channelRefCounts.delete(channelName);
        try {
          wrapper.leave();
        } catch {
        }
      } else {
        channelRefCounts.set(channelName, count - 1);
      }
      channelRef.current = null;
    };
  }, [
    channelName,
    eventName,
    enabled,
    connected
  ]);
  return {
    data,
    connected,
    error
  };
}
__name(useChannel, "useChannel");
var presenceRefCounts = /* @__PURE__ */ new Map();
function usePresence(channelName) {
  const manager = useInject(REALTIME_MANAGER);
  if (!manager) {
    throw new RealtimeError("RealtimeManager not found. Import RealtimeModule.forRoot() in your app module.");
  }
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const connRef = useRef(null);
  const channelRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    manager.connection().then((conn) => {
      if (cancelled) return;
      connRef.current = conn;
      setConnected(conn.isConnected());
      unsubscribe = conn.onStatusChange(() => {
        setConnected(conn.isConnected());
      });
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err : new Error("Failed to resolve connection"));
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    manager
  ]);
  useEffect(() => {
    if (!connected || !connRef.current) return;
    const conn = connRef.current;
    let wrapper;
    try {
      wrapper = conn.join(channelName);
      channelRef.current = wrapper;
      const currentCount = presenceRefCounts.get(channelName) ?? 0;
      presenceRefCounts.set(channelName, currentCount + 1);
      wrapper.here((currentMembers) => {
        setMembers([
          ...currentMembers
        ]);
      }).joining((member) => {
        setMembers((prev) => [
          ...prev,
          member
        ]);
      }).leaving((member) => {
        setMembers((prev) => prev.filter((m) => m !== member));
      }).onError((err) => {
        setError(err);
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to join presence channel"));
      return;
    }
    return () => {
      const count = presenceRefCounts.get(channelName) ?? 1;
      if (count <= 1) {
        presenceRefCounts.delete(channelName);
        try {
          wrapper.leave();
        } catch {
        }
      } else {
        presenceRefCounts.set(channelName, count - 1);
      }
      channelRef.current = null;
      setMembers([]);
    };
  }, [
    channelName,
    connected
  ]);
  return {
    members,
    connected,
    error
  };
}
__name(usePresence, "usePresence");
function useRealtime() {
  const manager = useInject(REALTIME_MANAGER);
  if (!manager) {
    throw new RealtimeError("RealtimeManager not found. Import RealtimeModule.forRoot() in your app module.");
  }
  const [status, setStatus] = useState(ConnectionStatus.Disconnected);
  const connRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    manager.connection().then((conn) => {
      if (cancelled) return;
      connRef.current = conn;
      setStatus(conn.getStatus());
      unsubscribe = conn.onStatusChange((newStatus) => {
        setStatus(newStatus);
      });
    }).catch(() => {
      if (!cancelled) {
        setStatus(ConnectionStatus.Error);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    manager
  ]);
  return {
    status,
    isConnected: status === ConnectionStatus.Connected,
    manager
  };
}
__name(useRealtime, "useRealtime");
var InjectRealtimeManager = /* @__PURE__ */ __name(() => Inject(REALTIME_MANAGER), "InjectRealtimeManager");

// src/utils/define-config.util.ts
function defineConfig(config) {
  return config;
}
__name(defineConfig, "defineConfig");

export { ChannelWrapper, EchoConnection, InjectRealtime, InjectRealtimeManager, LaravelEchoConnector2 as LaravelEchoConnector, PresenceChannelWrapper, RealtimeChannelError, RealtimeConnectionError, RealtimeError, RealtimeEventsBridgeListener, RealtimeManager2 as RealtimeManager, RealtimeModule, IRedisConnection as RedisConnection, IRedisConnector as RedisConnector, SocketIdMiddleware, defineConfig, getRealtimeConnectionToken, realtime, useChannel, usePresence, useRealtime };
