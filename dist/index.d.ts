import { IDynamicModule, OnModuleInit, OnModuleDestroy, IOnApplicationBootstrap } from '@stackra/ts-container';
import { MultipleInstanceManager } from '@stackra/ts-support';
import { ConnectionStatus } from '@stackra/contracts';
import { TabCoordinator } from '@stackra/ts-coordinator';
import { RedisManager } from '@stackra/ts-redis';
import { HttpMiddlewareInterface, HttpContext, HttpNextFunction, HttpResponse } from '@stackra/ts-http';

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
interface RealtimeConnectionConfig {
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

/**
 * @fileoverview Realtime configuration interface for multi-connection setup.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

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
interface RealtimeModuleOptions {
    /** Default connection name. */
    default: string;
    /** Named connections map. */
    connections: Record<string, RealtimeConnectionConfig>;
}

/**
 * @fileoverview RealtimeModule — DI module for real-time WebSocket services.
 * @module @stackra/ts-realtime
 * @category Module
 */

/**
 * DI module for the `@stackra/ts-realtime` package.
 *
 * Provides:
 * - The {@link RealtimeManager} singleton and its config token.
 * - The {@link LaravelEchoConnector} that creates connections.
 * - One factory provider per configured connection so consumers can
 *   write `@InjectRealtime('main')`.
 * - {@link RealtimeEventsBridgeListener} which forwards channel events
 *   into `@stackra/ts-events` when that package is also registered.
 * - {@link SocketIdMiddleware} which the `@stackra/ts-http` pipeline
 *   auto-discovers and uses to add the `X-Socket-Id` header to outgoing
 *   requests.
 *
 * Both the bridge listener and the socket-id middleware are no-ops
 * when their respective peer packages aren't in the graph.
 */
declare class RealtimeModule {
    /**
     * Logger instance scoped to the RealtimeModule context.
     */
    private static readonly logger;
    /**
     * Check if Realtime credentials are configured.
     *
     * Returns `true` only when non-empty key AND host are set for at least
     * one driver (Pusher or Reverb). Empty strings from env vars are treated
     * as unconfigured.
     */
    static hasCredentials(): boolean;
    /**
     * Configure the realtime WebSocket connections.
     *
     * @param config - The realtime module configuration.
     * @returns A dynamic module.
     */
    static forRoot(config: RealtimeModuleOptions): IDynamicModule;
}

/**
 * @fileoverview Global interface for type-safe realtime event payloads.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */
/**
 * Global interface for type-safe realtime event payloads.
 *
 * Users augment this interface via module declaration merging to define
 * their event payload types. When a `listen()` call uses an event name
 * that matches a key in this interface, the callback payload is
 * automatically typed.
 *
 * Renamed from `RealtimeEvents` to `RealtimeEventPayloads` to avoid
 * collision with the `RealtimeEvents` const exported from
 * `@stackra/contracts`, which holds canonical event-name strings.
 *
 * @example
 * ```typescript
 * // Augment in your app:
 * declare module '@stackra/ts-realtime' {
 *   interface RealtimeEventPayloads {
 *     '.order.created': { id: number; total: number };
 *     '.order.updated': { id: number; status: string };
 *   }
 * }
 * ```
 */
interface RealtimeEventPayloads {
}

/**
 * @fileoverview Utility type for inferring event payloads from RealtimeEventPayloads.
 *
 * @module @stackra/ts-realtime
 * @category Types
 */

/**
 * Utility type that infers the event payload from `RealtimeEventPayloads`.
 *
 * If the event name matches a key in `RealtimeEventPayloads`, returns that
 * type. Otherwise falls back to `unknown`.
 *
 * @typeParam T - The event name string
 */
type InferEventPayload<T extends string> = T extends keyof RealtimeEventPayloads ? RealtimeEventPayloads[T] : unknown;

/**
 * @fileoverview ChannelWrapper service for typed Laravel Echo channel subscriptions.
 * @module @stackra/ts-realtime
 * @category Services
 */

/**
 * Typed wrapper around a Laravel Echo channel subscription.
 *
 * Provides a fluent API for listening to broadcast events with generic type
 * parameters, error handling, and automatic cleanup via `leave()`. When
 * `leave()` is called, the wrapper notifies the `RealtimeManager` to remove
 * the channel from its internal tracking map.
 *
 * @description
 * Created internally by `RealtimeManager.channel()` and
 * `RealtimeManager.private()`. Consumers interact with this class through
 * the manager or via React hooks — direct instantiation is not typical.
 *
 * @example
 * ```typescript
 * import { realtime } from '@stackra/ts-realtime';
 *
 * const channel = realtime.channel('orders');
 *
 * channel
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     this.logger.info('New order:', data.id);
 *   })
 *   .onError((error) => {
 *     this.logger.error('Channel error:', error.message);
 *   });
 *
 * // Later, unsubscribe from the channel entirely
 * channel.leave();
 * ```
 */
declare class ChannelWrapper {
    private readonly echoChannel;
    private readonly channelName;
    private readonly onLeave;
    /** Whether this channel has been left. */
    private _left;
    /** Registered error callbacks. */
    private readonly _errorCallbacks;
    /**
     * Creates a new ChannelWrapper.
     *
     * @param echoChannel - The underlying Laravel Echo channel object
     * @param channelName - The name of the channel
     * @param onLeave - Callback invoked when `leave()` is called, used by the manager to remove tracking
     */
    constructor(echoChannel: any, channelName: string, onLeave: (name: string) => void);
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
    listen<E extends string = string, T = InferEventPayload<E>>(event: E, callback: (data: T) => void): ChannelWrapper;
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
    listenToAll(callback: (event: string, data: unknown) => void): ChannelWrapper;
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
    stopListening(event: string, callback?: CallableFunction): ChannelWrapper;
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
    whisper(event: string, data: Record<string, any>): this;
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
    listenForWhisper<T>(event: string, callback: (data: T) => void): this;
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
    notification<T>(callback: (data: T) => void): ChannelWrapper;
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
    onError(callback: (error: Error) => void): ChannelWrapper;
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
    leave(): void;
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
    get name(): string;
    /**
     * Whether this channel has been left.
     *
     * @returns `true` if `leave()` has been called
     */
    get isLeft(): boolean;
    /**
     * Notify all registered error callbacks.
     *
     * @param error - The error to propagate
     * @internal
     */
    _notifyError(error: Error): void;
}

/**
 * @fileoverview PresenceChannelWrapper service for typed presence channel subscriptions.
 * @module @stackra/ts-realtime
 * @category Services
 */

/**
 * Typed wrapper around a Laravel Echo presence channel subscription.
 *
 * Extends {@link ChannelWrapper} with presence-specific member tracking:
 * `here()`, `joining()`, `leaving()`, and `getMembers()`. The internal
 * members list is always updated **before** invoking consumer callbacks,
 * ensuring that `getMembers()` returns the current state inside any callback.
 *
 * @description
 * Created internally by `RealtimeManager.join()`. Consumers interact with
 * this class through the manager or via the `usePresence` React hook —
 * direct instantiation is not typical.
 *
 * @example
 * ```typescript
 * import { realtime } from '@stackra/ts-realtime';
 *
 * interface User {
 *   id: number;
 *   name: string;
 * }
 *
 * const presence = realtime.join('chat-room.1');
 *
 * presence
 *   .here<User>((members) => {
 *     this.logger.info('Currently online:', members);
 *   })
 *   .joining<User>((member) => {
 *     this.logger.info(`${member.name} joined`);
 *   })
 *   .leaving<User>((member) => {
 *     this.logger.info(`${member.name} left`);
 *   });
 * ```
 */
declare class PresenceChannelWrapper extends ChannelWrapper {
    /** Current list of presence channel members. */
    private _members;
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
    here<T>(callback: (members: T[]) => void): PresenceChannelWrapper;
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
    joining<T>(callback: (member: T) => void): PresenceChannelWrapper;
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
    leaving<T>(callback: (member: T) => void): PresenceChannelWrapper;
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
    getMembers<T>(): T[];
}

/**
 * @fileoverview RealtimeConnection interface for transport-agnostic connection API.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

/**
 * Standard interface for a realtime transport connection.
 *
 * All realtime drivers (Echo, Socket.IO, Ably, Mock, etc.) implement this
 * interface to expose a uniform API for channels, presence, events, and
 * connection lifecycle.
 *
 * @example
 * ```typescript
 * const conn: RealtimeConnection = await manager.connection('main');
 *
 * conn.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info('New order:', data.id);
 *   });
 * ```
 */
interface RealtimeConnection {
    /** Get the connection name. */
    getName(): string;
    /** Get the current connection status. */
    getStatus(): ConnectionStatus;
    /** Whether the connection is currently active. */
    isConnected(): boolean;
    /** Initiate the transport connection. */
    connect(): void;
    /** Tear down the transport connection and release resources. */
    disconnect(): void;
    /** Subscribe to a public channel. */
    channel(name: string): ChannelWrapper;
    /** Subscribe to a private channel. */
    private(name: string): ChannelWrapper;
    /** Join a presence channel. */
    join(name: string): PresenceChannelWrapper;
    /** Register a listener for connection status changes. Returns an unsubscribe function. */
    onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
    /** Get the socket ID for the connection. Returns undefined if not connected. */
    socketId(): string | undefined;
    /** Leave all channels (public, private, and presence) on this connection. */
    leaveAll(): void;
    /** The number of consecutive failed reconnection attempts. */
    readonly reconnectAttempts: number;
}

/**
 * @fileoverview RealtimeConnector interface for pluggable driver factories.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

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
interface RealtimeConnector {
    /**
     * Create a realtime connection from configuration.
     *
     * @param config - The connection configuration
     * @returns A promise resolving to a connected RealtimeConnection
     * @throws {Error} If the configuration is invalid or missing required fields
     */
    connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection>;
}

/**
 * @fileoverview RealtimeManager — manages multiple named realtime connections.
 * @module @stackra/ts-realtime
 * @category Services
 */

/**
 * Minimal structural type for the EventEmitterManager from `@stackra/ts-events`.
 *
 * Avoids a hard import — we only need `connection().emit()` access.
 *
 * @internal
 */
interface EventEmitterManagerLike$1 {
    connection(name?: string): {
        emit(event: string, ...args: any[]): boolean;
    };
}
/**
 * RealtimeManager — the single entry point for realtime connections in your app.
 *
 * Manages multiple named realtime connections. Each connection is lazily
 * resolved via the configured connector, cached, and reused.
 *
 * Extends `MultipleInstanceManager<RealtimeConnection>` and uses the
 * async resolution path (`instanceAsync` / `createDriverAsync`) since
 * WebSocket connections require async initialization.
 *
 * Lifecycle:
 * - `OnModuleInit` — eagerly warms the default connection
 * - `OnModuleDestroy` — disconnects all active connections
 *
 * @example
 * ```typescript
 * @Injectable()
 * class ChatService {
 *   constructor(@Inject(RealtimeManager) private realtime: RealtimeManager) {}
 *
 *   async subscribeToMessages() {
 *     const conn = await this.realtime.connection('main');
 *     conn.channel('messages')
 *       .listen<MessageEvent>('.message.sent', (data) => {
 *         this.logger.log('New message:', data.text);
 *       });
 *   }
 * }
 * ```
 */
declare class RealtimeManager extends MultipleInstanceManager<RealtimeConnection> implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly connector;
    private readonly eventManager?;
    private readonly coordinator?;
    /**
     * @param config - Realtime configuration with named connections
     * @param connector - Connector used to create realtime connections
     * @param eventManager - Optional event manager for dispatching connection
     *   lifecycle events (`realtime.connected`, `realtime.disconnected`,
     *   `realtime.subscribed`, `realtime.reconnecting`). When
     *   `EventEmitterModule.forRoot()` is not in the app graph, this is
     *   `undefined` and `emit()` becomes a no-op.
     */
    constructor(config: RealtimeModuleOptions, connector: RealtimeConnector, eventManager?: EventEmitterManagerLike$1 | undefined, coordinator?: TabCoordinator | undefined);
    /**
     * Logger instance scoped to the RealtimeManager context.
     */
    private readonly logger;
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
    onModuleInit(): Promise<void>;
    /**
     * Disconnect all active connections on shutdown.
     */
    onModuleDestroy(): Promise<void>;
    /**
     * Get the default instance name from configuration.
     */
    getDefaultInstance(): string;
    /**
     * Set the default instance name at runtime.
     */
    setDefaultInstance(name: string): void;
    /**
     * Get the configuration for a specific connection.
     *
     * Ensures the returned config includes a `driver` field so the base
     * class's `resolveAsync()` can find it.
     *
     * @param name - The connection name
     * @returns The connection configuration, or undefined if not found
     */
    getInstanceConfig(name: string): Record<string, any> | undefined;
    /**
     * Sync driver creation — not used for realtime.
     *
     * Realtime always uses the async path via `createDriverAsync()`.
     *
     * @throws {Error} Always throws; use `connection()` for async resolution
     */
    protected createDriver(_driver: string, _config: Record<string, any>): RealtimeConnection;
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
    protected createDriverAsync(_driver: string, config: Record<string, any>): Promise<RealtimeConnection>;
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
    connection(name?: string): Promise<RealtimeConnection>;
    /**
     * Disconnect a specific connection and remove it from cache.
     *
     * @param name - Connection name. Uses default if omitted.
     */
    disconnect(name?: string): Promise<void>;
    /**
     * Disconnect all active connections and clear the cache.
     */
    disconnectAll(): Promise<void>;
    /**
     * Leave all channels on a specific connection (or the default).
     *
     * Useful for cleanup on logout or navigation away from a section
     * that uses realtime features.
     *
     * @param name - Connection name. Uses default if omitted.
     */
    leaveAll(name?: string): Promise<void>;
    /**
     * Get all configured connection names (from config).
     */
    getConnectionNames(): string[];
    /**
     * Get the default connection name.
     */
    getDefaultConnectionName(): string;
    /**
     * Check if a connection has been resolved and is currently cached.
     *
     * @param name - Connection name. Uses default if omitted.
     */
    isConnectionActive(name?: string): boolean;
    /**
     * Get all active (cached) connection names.
     */
    getActiveConnectionNames(): string[];
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
    private emit;
}

/**
 * @fileoverview LaravelEchoConnector — creates EchoConnection instances from config.
 *
 * Factory connector that creates `EchoConnection` instances using Laravel Echo.
 * Laravel Echo is a JavaScript library that provides a unified API for WebSocket
 * communication across multiple broadcasters:
 * - Pusher (pusher.com)
 * - Laravel Reverb (Laravel's first-party WebSocket server)
 * - Soketi (open-source Pusher alternative)
 * - Socket.IO (future support)
 * - Ably (future support)
 *
 * @module @stackra/ts-realtime
 * @category Connectors
 */

/**
 * Connector factory that creates `EchoConnection` instances backed by Laravel Echo.
 *
 * The optional `dispatchFn` is set by `RealtimeModule` after initialization
 * to bridge WebSocket events into `@stackra/ts-events` without creating
 * a circular dependency.
 */
declare class LaravelEchoConnector implements RealtimeConnector {
    /**
     * Logger instance scoped to the LaravelEchoConnector context.
     */
    private readonly logger;
    /** Optional event dispatch function — set by RealtimeModule to bridge WS → ts-events. */
    private emitFn?;
    /**
     * Sets the event dispatch function for auto-bridging WS events into ts-events.
     *
     * Called by RealtimeModule during initialization when @stackra/ts-events
     * is available. This avoids a direct dependency on ts-events.
     *
     * @param fn - A function that dispatches events (typically eventEmitterManager.emit)
     */
    setDispatchFn(fn: (event: string, data: unknown) => void): void;
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
    connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection>;
    /**
     * Creates a no-op connection stub when credentials are missing.
     *
     * All lifecycle methods are safe to call but do nothing. Channel
     * subscription methods throw a descriptive error at usage time so
     * developers know credentials are needed.
     *
     * @returns A RealtimeConnection stub.
     */
    private createNoOpConnection;
}

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
declare class IRedisConnector implements RealtimeConnector {
    private readonly redisManager;
    constructor(redisManager: RedisManager);
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
    connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection>;
}

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
declare class EchoConnection implements RealtimeConnection {
    private readonly config;
    private readonly name;
    private readonly dispatchFn?;
    /** The Laravel Echo instance, or null when disconnected. */
    private echo;
    /** Current connection status. */
    private status;
    /** Registered status change listeners. */
    private readonly listeners;
    /** Active public and private channel subscriptions. */
    private readonly channels;
    /** Active presence channel subscriptions. */
    private readonly presenceChannels;
    /** Pending reconnection timer. */
    private reconnectTimer;
    /** Consecutive failed reconnection attempts since last successful connection. */
    private _reconnectAttempts;
    /**
     * Creates a new EchoConnection.
     *
     * @param config - The connection configuration
     * @param name - The connection name
     */
    constructor(config: RealtimeConnectionConfig, name: string, dispatchFn?: ((event: string, data: unknown) => void) | undefined);
    /**
     * Get the connection name.
     */
    getName(): string;
    /**
     * Get the current connection status.
     */
    getStatus(): ConnectionStatus;
    /**
     * Whether the connection is currently active.
     */
    isConnected(): boolean;
    /**
     * The number of consecutive failed reconnection attempts.
     */
    get reconnectAttempts(): number;
    /**
     * Register a listener for connection status changes.
     * Returns an unsubscribe function.
     */
    onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
    /**
     * Establish the WebSocket connection via Laravel Echo.
     *
     * Creates a new Echo instance with the provided configuration, sets the
     * status to `Connecting`, and binds to Pusher connection events to track
     * state transitions.
     */
    connect(): void;
    /**
     * Disconnect the WebSocket and release all resources.
     *
     * Calls `echo.disconnect()`, clears all channel tracking maps, cancels
     * any pending reconnection timer, and sets the status to `Disconnected`.
     */
    disconnect(): void;
    /**
     * Get the socket ID for the current connection.
     *
     * The socket ID is used by Laravel to exclude the sender from receiving
     * their own broadcast events. It's sent as the `X-Socket-Id` header.
     *
     * @returns The socket ID string, or undefined if not connected
     */
    socketId(): string | undefined;
    /**
     * Leave all channels (public, private, and presence) on this connection.
     *
     * Iterates all tracked channel and presence channel wrappers, calls `leave()`
     * on each, and clears the internal tracking maps.
     */
    leaveAll(): void;
    /**
     * Subscribe to a public Laravel Broadcasting channel.
     *
     * @param name - The channel name
     * @returns A ChannelWrapper for the channel
     * @throws {Error} If the connection is not connected
     */
    channel(name: string): ChannelWrapper;
    /**
     * Subscribe to a private Laravel Broadcasting channel.
     *
     * @param name - The channel name (without the `private-` prefix)
     * @returns A ChannelWrapper for the private channel
     * @throws {Error} If the connection is not connected
     */
    private(name: string): ChannelWrapper;
    /**
     * Join a presence Laravel Broadcasting channel.
     *
     * @param name - The channel name (without the `presence-` prefix)
     * @returns A PresenceChannelWrapper for the presence channel
     * @throws {Error} If the connection is not connected
     */
    join(name: string): PresenceChannelWrapper;
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
    private _autoBridge;
    /**
     * Update the connection status and notify all listeners.
     * @internal
     */
    private _setStatus;
    /**
     * Assert that the connection is connected before channel operations.
     * @internal
     */
    private _assertConnected;
    /**
     * Remove a public/private channel from tracking.
     * @internal
     */
    private _removeChannel;
    /**
     * Remove a presence channel from tracking.
     * @internal
     */
    private _removePresenceChannel;
    /**
     * Bind to Pusher connection events for state tracking and reconnection.
     * @internal
     */
    private _bindConnectionEvents;
    /**
     * Bind to Pusher connection events.
     * @internal
     */
    private _bindPusherEvents;
    /**
     * Start the exponential backoff reconnection sequence.
     * @internal
     */
    private _startReconnect;
    /**
     * Schedule a single reconnection attempt with exponential backoff.
     * @internal
     */
    private _scheduleReconnect;
    /**
     * Attempt a single reconnection by tearing down and re-creating Echo.
     * @internal
     */
    private _attemptReconnect;
    /**
     * Cancel any pending reconnection timer.
     * @internal
     */
    private _cancelReconnect;
    /**
     * Re-subscribe all tracked channels after a successful reconnection.
     * @internal
     */
    private _resubscribeChannels;
}

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
declare class IRedisConnection implements RealtimeConnection {
    private readonly name;
    /**
     * Logger instance scoped to the IRedisConnection context.
     */
    private readonly logger;
    /** The Redis connection instance. */
    private readonly redis;
    /** Current connection status. */
    private status;
    /** Registered status change listeners. */
    private readonly listeners;
    /** Active public and private channel subscriptions. */
    private readonly channels;
    /** Active presence channel subscriptions. */
    private readonly presenceChannels;
    /** Polling configuration. */
    private readonly pollInterval;
    private readonly keyPrefix;
    private readonly maxEvents;
    /** Polling state. */
    private readonly pollingTimers;
    private readonly channelCursors;
    /** Reconnection state. */
    private _reconnectAttempts;
    /**
     * Creates a new IRedisConnection.
     *
     * @param config - The Redis connection configuration
     * @param name - The connection name
     */
    constructor(config: RealtimeConnectionConfig, name: string);
    /**
     * Get the connection name.
     */
    getName(): string;
    /**
     * Get the current connection status.
     */
    getStatus(): ConnectionStatus;
    /**
     * Whether the connection is currently active.
     */
    isConnected(): boolean;
    /**
     * The number of consecutive failed reconnection attempts.
     */
    get reconnectAttempts(): number;
    /**
     * Register a listener for connection status changes.
     * Returns an unsubscribe function.
     */
    onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
    /**
     * Establish the Redis connection.
     *
     * Sets the status to `Connected` immediately since Redis HTTP API
     * doesn't require persistent connection establishment.
     */
    connect(): void;
    /**
     * Disconnect and release all resources.
     *
     * Stops all polling timers, clears channel tracking, and sets status
     * to `Disconnected`.
     */
    disconnect(): void;
    /**
     * Get the socket ID for the connection.
     *
     * Redis polling has no concept of a per-client socket identifier — the
     * transport is connectionless, so this always returns `undefined`. Kept
     * to satisfy the {@link RealtimeConnection} contract for parity with
     * WebSocket-backed drivers (Echo, Pusher).
     */
    socketId(): string | undefined;
    /**
     * Leave all subscribed channels — public, private, and presence.
     *
     * Stops every active polling timer and clears the in-memory channel
     * registries. The connection itself remains in {@link ConnectionStatus.Connected}
     * (Redis is connectionless), so new subscriptions are still possible.
     */
    leaveAll(): void;
    /**
     * Subscribe to a public channel.
     *
     * @param name - The channel name
     * @returns A ChannelWrapper for the channel
     * @throws {Error} If the connection is not connected
     */
    channel(name: string): ChannelWrapper;
    /**
     * Subscribe to a private channel.
     *
     * @param name - The channel name (without the `private-` prefix)
     * @returns A ChannelWrapper for the private channel
     * @throws {Error} If the connection is not connected
     */
    private(name: string): ChannelWrapper;
    /**
     * Join a presence channel.
     *
     * @param name - The channel name (without the `presence-` prefix)
     * @returns A PresenceChannelWrapper for the presence channel
     * @throws {Error} If the connection is not connected
     */
    join(name: string): PresenceChannelWrapper;
    /**
     * Publish an event to a channel.
     *
     * @param channel - The channel name
     * @param event - The event name
     * @param data - The event data
     */
    publish(channel: string, event: string, data: any): Promise<void>;
    /**
     * Build the Redis list key for a channel.
     */
    private _listKey;
    /**
     * Create a mock Echo channel object for ChannelWrapper compatibility.
     */
    private _createMockEchoChannel;
    /**
     * Start polling for a channel.
     */
    private _startPolling;
    /**
     * Stop polling for a channel.
     */
    private _stopPolling;
    /**
     * Update the connection status and notify all listeners.
     * @internal
     */
    private _setStatus;
    /**
     * Assert that the connection is connected before channel operations.
     * @internal
     */
    private _assertConnected;
    /**
     * Remove a public/private channel from tracking.
     * @internal
     */
    private _removeChannel;
    /**
     * Remove a presence channel from tracking.
     * @internal
     */
    private _removePresenceChannel;
}

/**
 * @fileoverview RealtimeEventsBridgeListener — bridges WebSocket events into `@stackra/ts-events`.
 *
 * Replaces the previous `REALTIME_AUTO_BRIDGE` factory that resolved the
 * event manager via `require()` and `globalThis.__APP__`. Now uses proper
 * DI with an `@Optional()` injection so the realtime package keeps
 * `@stackra/ts-events` as a soft dependency.
 *
 * Wires the connector's `dispatchFn` once at `onApplicationBootstrap`.
 * Each subsequent channel subscription auto-bridges every event into
 * the events bus as `realtime:{channel}.{event}`.
 *
 * @module @stackra/ts-realtime
 * @category Listeners
 */

/**
 * Minimal structural type for the EventEmitterManager from `@stackra/ts-events`.
 *
 * Avoids a hard import — we only need `connection().emit()` access.
 *
 * @internal
 */
interface EventEmitterManagerLike {
    connection(name?: string): {
        emit(event: string, ...args: unknown[]): boolean;
    };
}
/**
 * Bridges incoming WebSocket events into the events bus.
 *
 * When `@stackra/ts-events` is in the DI graph, every channel subscription
 * dispatches its events into the default event emitter connection as
 * `realtime:{channel}.{event}`. Consumers subscribe with `@OnEvent` /
 * `useOnEvent` on the events package — no manual bridge calls needed.
 *
 * When `@stackra/ts-events` is not registered, the bridge is a no-op.
 */
declare class RealtimeEventsBridgeListener implements IOnApplicationBootstrap {
    private readonly connector;
    private readonly eventManager?;
    /**
     * Logger scoped to the bridge listener.
     */
    private readonly logger;
    /**
     * @param connector - The realtime connector. Required (always present
     *   because `RealtimeModule` registers it).
     * @param eventManager - Optional events manager. Resolved via DI when
     *   `@stackra/ts-events` is in the application graph.
     */
    constructor(connector: LaravelEchoConnector, eventManager?: EventEmitterManagerLike | undefined);
    /**
     * Wire the connector's dispatch function so every channel subscription
     * auto-bridges its events into the events bus.
     *
     * Runs after every provider is initialised so the events manager (if
     * any) is fully ready.
     */
    onApplicationBootstrap(): void;
}

/**
 * @fileoverview SocketIdMiddleware — adds the X-Socket-Id header to outgoing HTTP requests.
 *
 * Replaces the previous `REALTIME_HTTP_INTERCEPTOR` factory that
 * monkey-patched `httpClient.request` via `require("@stackra/ts-container")`
 * and `globalThis.__APP__`. Now a proper `@HttpMiddleware`-decorated
 * class that the http package auto-discovers and registers in its
 * pipeline.
 *
 * Laravel uses the socket ID to exclude the broadcast sender from
 * receiving their own events. Adding the header is harmless when the
 * server doesn't use it.
 *
 * @module @stackra/ts-realtime
 * @category Middleware
 */

/**
 * HTTP middleware that injects the realtime socket ID as `X-Socket-Id`
 * on every outgoing request.
 *
 * Auto-registered by the `@stackra/ts-http` middleware pipeline through
 * the `@HttpMiddleware` decorator — no manual registration is required.
 *
 * Priority `25` runs after auth (typically `10`) and locale (`15`), so
 * authentication and locale data are already on the request when this
 * middleware injects the socket ID.
 */
declare class SocketIdMiddleware implements HttpMiddlewareInterface {
    private readonly realtime;
    /**
     * Logger scoped to the middleware.
     */
    private readonly logger;
    /**
     * @param realtime - The realtime manager. Required — the middleware
     *   only ships when `RealtimeModule.forRoot()` is in the graph.
     */
    constructor(realtime: RealtimeManager);
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
    handle(context: HttpContext, next: HttpNextFunction): Promise<HttpResponse>;
}

/**
 * Realtime inject proxy
 *
 * Typed proxy for {@link RealtimeManager} from `@stackra/ts-realtime`.
 *
 * Core singleton managing the Laravel Echo WebSocket connection, channel
 * subscriptions, reconnection, and observable connection state.
 *
 * The facade is a module-level constant typed as `RealtimeManager`.
 * It lazily resolves the service from the DI container on first property
 * access — safe to use at module scope before bootstrap completes.
 *
 * ## Setup (once, in main.tsx)
 *
 * ```typescript
 * import { Application } from '@stackra/ts-container';
 * import { inject } from "@stackra/ts-container";
 *
 * const app = await Application.create(AppModule);
 * Application.create(AppModule); // wires all facades
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { Realtimeinject proxy } from '@stackra/ts-realtime';
 *
 * // Subscribe to a public channel
 * Realtimeinject proxy.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info('New order:', data.id);
 *   });
 *
 * // Join a presence channel
 * Realtimeinject proxy.join('chat-room.1')
 *   .here<User>((members) => logger.info('Online:', members));
 *
 * // Check connection status
 * if (Realtimeinject proxy.isConnected()) {
 *   logger.info('WebSocket is active');
 * }
 * ```
 *
 * ## Available methods (from {@link RealtimeManager})
 *
 * - `connect(): void`
 * - `disconnect(): void`
 * - `channel(name: string): ChannelWrapper`
 * - `private(name: string): ChannelWrapper`
 * - `join(name: string): PresenceChannelWrapper`
 * - `getStatus(): ConnectionStatus`
 * - `onStatusChange(cb): () => void`
 * - `isConnected(): boolean`
 *
 * ## Testing — swap in a mock
 *
 * ```typescript
 * import { inject } from "@stackra/ts-container";
 * import { REALTIME_MANAGER } from '@stackra/ts-realtime';
 *
 * // Before test — replace the resolved instance
 * inject.swap(REALTIME_MANAGER, mockInstance);
 *
 * // After test — restore
 * inject.clearAll();
 * ```
 *
 * @module facades/realtime
 * @see {@link RealtimeManager} — the underlying service
 * @see {@link inject} — the lazy DI resolution function
 */

/**
 * Realtimeinject proxy — typed proxy for {@link RealtimeManager}.
 *
 * Resolves `RealtimeManager` from the DI container via the `REALTIME_MANAGER` token.
 * All property and method access is forwarded to the resolved instance
 * with correct `this` binding.
 *
 * Call `Application.create(AppModule)` once during bootstrap before using this.
 *
 * @example
 * ```typescript
 * Realtimeinject proxy.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info(data);
 *   });
 * ```
 */
declare const realtime: RealtimeManager;

/**
 * @fileoverview UseChannelReturn interface.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */
/**
 * Return type for the `useChannel` hook.
 */
interface UseChannelReturn<T> {
    /** The latest event payload, or `null` if no event has been received. */
    data: T | null;
    /** Whether the WebSocket connection is currently active. */
    connected: boolean;
    /** The latest error, or `null` if no error has occurred. */
    error: Error | null;
}

/**
 * @fileoverview useChannel React hook for declarative channel subscriptions.
 * @module @stackra/ts-realtime
 * @category Hooks
 */

/**
 * React hook for subscribing to a Laravel Broadcasting channel event.
 *
 * Obtains the `RealtimeManager` from the DI container via `useInject`,
 * resolves the default connection asynchronously, subscribes to the specified
 * channel and event, and automatically cleans up on unmount. Re-subscribes
 * when `channelName` or `eventName` change.
 *
 * Uses internal ref counting so that multiple hooks subscribing to the same
 * channel share a single `ChannelWrapper`. The channel is only left when the
 * last hook unmounts.
 *
 * @template T - The expected event payload type
 * @param channelName - The channel name to subscribe to
 * @param eventName - The broadcast event name to listen for
 * @param options - Optional configuration
 * @param options.enabled - Whether the subscription is active (default: `true`)
 * @returns An object containing `data`, `connected`, and `error`
 *
 * @example
 * ```tsx
 * import { useChannel } from '@stackra/ts-realtime';
 *
 * interface OrderEvent {
 *   id: number;
 *   status: string;
 * }
 *
 * function OrderNotifications() {
 *   const { data, connected, error } = useChannel<OrderEvent>(
 *     'orders',
 *     '.order.created',
 *   );
 *
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!connected) return <div>Connecting...</div>;
 *   if (!data) return <div>Waiting for events...</div>;
 *
 *   return <div>New order: {data.id}</div>;
 * }
 * ```
 */
declare function useChannel<T>(channelName: string, eventName: string, options?: {
    enabled?: boolean;
}): UseChannelReturn<T>;

/**
 * @fileoverview UsePresenceReturn interface.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */
/**
 * Return type for the `usePresence` hook.
 */
interface UsePresenceReturn<TMember> {
    /** The current list of members in the presence channel. */
    members: TMember[];
    /** Whether the WebSocket connection is currently active. */
    connected: boolean;
    /** The latest error, or `null` if no error has occurred. */
    error: Error | null;
}

/**
 * @fileoverview usePresence React hook for presence channel member tracking.
 * @module @stackra/ts-realtime
 * @category Hooks
 */

/**
 * React hook for subscribing to a Laravel Broadcasting presence channel.
 *
 * Resolves the default connection asynchronously, joins the presence channel
 * on mount, and tracks members via `here()`, `joining()`, and `leaving()`
 * callbacks. Leaves the channel on unmount.
 *
 * Uses internal ref counting so that multiple hooks subscribing to the same
 * presence channel share a single `PresenceChannelWrapper`. The channel is
 * only left when the last hook unmounts.
 *
 * @template TMember - The member type
 * @param channelName - The presence channel name to join
 * @returns An object containing `members`, `connected`, and `error`
 *
 * @example
 * ```tsx
 * import { usePresence } from '@stackra/ts-realtime';
 *
 * interface User {
 *   id: number;
 *   name: string;
 * }
 *
 * function OnlineUsers() {
 *   const { members, connected, error } = usePresence<User>('chat-room.1');
 *
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!connected) return <div>Connecting...</div>;
 *
 *   return (
 *     <ul>
 *       {members.map((user) => (
 *         <li key={user.id}>{user.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
declare function usePresence<TMember>(channelName: string): UsePresenceReturn<TMember>;

/**
 * @fileoverview UseRealtimeReturn interface.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

/**
 * Return type for the `useRealtime` hook.
 */
interface UseRealtimeReturn {
    /** The current connection status. */
    status: ConnectionStatus;
    /** Whether the WebSocket connection is currently active. */
    isConnected: boolean;
    /** The `RealtimeManager` instance for imperative operations. */
    manager: RealtimeManager;
}

/**
 * @fileoverview useRealtime React hook for connection status and manager access.
 * @module @stackra/ts-realtime
 * @category Hooks
 */

/**
 * React hook for accessing the realtime connection status and manager.
 *
 * Resolves the default connection asynchronously and subscribes to
 * `onStatusChange()`, triggering a re-render whenever the connection
 * state transitions. Provides direct access to the `RealtimeManager`
 * instance for imperative operations.
 *
 * @returns An object containing `status`, `isConnected`, and `manager`
 *
 * @example
 * ```tsx
 * import { useRealtime, ConnectionStatus } from '@stackra/ts-realtime';
 *
 * function ConnectionIndicator() {
 *   const { status, isConnected, manager } = useRealtime();
 *
 *   return (
 *     <div>
 *       <span>Status: {status}</span>
 *       {!isConnected && (
 *         <button onClick={() => manager.connection()}>
 *           Reconnect
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
declare function useRealtime(): UseRealtimeReturn;

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
declare const getRealtimeConnectionToken: (connectionName?: string) => string;
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
declare const InjectRealtime: (connectionName?: string) => PropertyDecorator & ParameterDecorator;

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
declare const InjectRealtimeManager: () => PropertyDecorator & ParameterDecorator;

/**
 * Define Config Utility
 *
 * Helper function to define realtime module options with type safety.
 * Follows the `defineConfig()` pattern popularized by Vite, Vitest,
 * and similar tools.
 *
 * @module utils/define-config
 */

/**
 * Helper function to define realtime module options with type safety.
 *
 * Provides IDE autocomplete and type checking for configuration objects.
 *
 * @param config - The realtime module configuration object
 * @returns The same configuration object with proper typing
 *
 * @example
 * ```typescript
 * // realtime.config.ts
 * import { defineConfig } from '@stackra/ts-realtime';
 *
 * export default defineConfig({
 *   default: env('VITE_REALTIME_DEFAULT_CONNECTION', 'main'),
 *   connections: {
 *     main: {
 *       driver: 'echo',
 *       key: env('VITE_PUSHER_APP_KEY', ''),
 *       wsHost: env('VITE_PUSHER_HOST', ''),
 *     },
 *   },
 * });
 * ```
 */
declare function defineConfig(config: RealtimeModuleOptions): RealtimeModuleOptions;

/**
 * @fileoverview Base error class for the realtime package.
 * @module @stackra/ts-realtime
 * @category Errors
 */
/**
 * Base error class for all errors thrown by the realtime package.
 *
 * All specific error classes extend this to provide a consistent
 * error shape with a typed `code` property for programmatic handling.
 *
 * @example
 * ```typescript
 * try {
 *   await manager.connection('main');
 * } catch (error: Error | any) {
 *   if (error instanceof RealtimeError) {
 *     logger.error('Realtime error:', error.code, error.message);
 *   }
 * }
 * ```
 */
declare class RealtimeError extends Error {
    /** Error name for identification. */
    readonly name: string;
    /** Error code for programmatic handling. */
    readonly code: string;
    /** Optional underlying cause. */
    readonly cause?: Error;
    /**
     * Create a new RealtimeError.
     *
     * @param message - Human-readable error message
     * @param cause   - Optional underlying error that caused this failure
     */
    constructor(message: string, cause?: Error);
}

/**
 * @fileoverview Realtime connection error.
 * @module @stackra/ts-realtime
 * @category Errors
 */

/**
 * Error thrown when a realtime connection cannot be established or used.
 *
 * Typical causes:
 * - Missing connector configuration (Pusher key, WebSocket host)
 * - Operating on a connection that is not connected
 * - Failure acquiring the backing transport (e.g. underlying Redis connection)
 *
 * @example
 * ```typescript
 * try {
 *   conn.channel('orders');
 * } catch (error: Error | any) {
 *   if (error instanceof RealtimeConnectionError) {
 *     logger.error('Connection problem:', error.message);
 *   }
 * }
 * ```
 */
declare class RealtimeConnectionError extends RealtimeError {
    /** Error name for identification. */
    readonly name: string;
    /** Error code for programmatic handling. */
    readonly code: string;
}

/**
 * @fileoverview Realtime channel error.
 * @module @stackra/ts-realtime
 * @category Errors
 */

/**
 * Error thrown when a channel operation fails or is not supported.
 *
 * Typical causes:
 * - Listening or whispering on a channel that has been left
 * - Calling whisper on a public channel (client events unsupported)
 * - Calling notification on a channel type that does not support it
 *
 * @example
 * ```typescript
 * try {
 *   channel.whisper('typing', {});
 * } catch (error: Error | any) {
 *   if (error instanceof RealtimeChannelError) {
 *     logger.error('Channel error:', error.message);
 *   }
 * }
 * ```
 */
declare class RealtimeChannelError extends RealtimeError {
    /** Error name for identification. */
    readonly name: string;
    /** Error code for programmatic handling. */
    readonly code: string;
}

export { ChannelWrapper, EchoConnection, type InferEventPayload, InjectRealtime, InjectRealtimeManager, LaravelEchoConnector, PresenceChannelWrapper, RealtimeChannelError, type RealtimeConnectionConfig, RealtimeConnectionError, RealtimeError, RealtimeEventsBridgeListener, RealtimeManager, RealtimeModule, type RealtimeModuleOptions, IRedisConnection as RedisConnection, type RealtimeConnectionConfig as RedisConnectionConfig, IRedisConnector as RedisConnector, SocketIdMiddleware, type UseChannelReturn, type UsePresenceReturn, type UseRealtimeReturn, defineConfig, getRealtimeConnectionToken, realtime, useChannel, usePresence, useRealtime };
