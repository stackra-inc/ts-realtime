/**
 * @fileoverview RealtimeManager — manages multiple named realtime connections.
 * @module @stackra/ts-realtime
 * @category Services
 */

import {
  Injectable,
  Inject,
  Optional,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@stackra/ts-container";
import { MultipleInstanceManager } from "@stackra/ts-support";

import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { RealtimeConnector } from "@/interfaces/realtime-connector.interface";
import type { RealtimeModuleOptions } from "@/interfaces/realtime-module-options.interface";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";
import {
  REALTIME_CONFIG,
  REALTIME_CONNECTOR,
  EVENT_EMITTER_MANAGER,
  TAB_COORDINATOR,
} from "@stackra/contracts";
import { RealtimeEvents } from "@stackra/contracts";
import type { TabCoordinator } from "@stackra/ts-coordinator";
import { Logger } from "@stackra/ts-logger";

/**
 * Minimal structural type for the EventEmitterManager from `@stackra/ts-events`.
 *
 * Avoids a hard import — we only need `connection().emit()` access.
 *
 * @internal
 */
interface EventEmitterManagerLike {
  connection(name?: string): { emit(event: string, ...args: any[]): boolean };
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
@Injectable()
export class RealtimeManager
  extends MultipleInstanceManager<RealtimeConnection>
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * @param config - Realtime configuration with named connections
   * @param connector - Connector used to create realtime connections
   * @param eventManager - Optional event manager for dispatching connection
   *   lifecycle events (`realtime.connected`, `realtime.disconnected`,
   *   `realtime.subscribed`, `realtime.reconnecting`). When
   *   `EventEmitterModule.forRoot()` is not in the app graph, this is
   *   `undefined` and `emit()` becomes a no-op.
   */
  constructor(
    @Inject(REALTIME_CONFIG) private readonly config: RealtimeModuleOptions,
    @Inject(REALTIME_CONNECTOR) private readonly connector: RealtimeConnector,
    @Optional()
    @Inject(EVENT_EMITTER_MANAGER)
    private readonly eventManager?: EventEmitterManagerLike,
    @Optional()
    @Inject(TAB_COORDINATOR)
    private readonly coordinator?: TabCoordinator,
  ) {
    super();
  }

  /**
   * Logger instance scoped to the RealtimeManager context.
   */
  private readonly logger = new Logger(RealtimeManager.name);

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
  public async onModuleInit(): Promise<void> {
    const defaultName = this.config.default;
    if (!this.config.connections[defaultName]) return;

    // If coordinator is available, only leader connects
    if (this.coordinator) {
      this.coordinator.role$.subscribe(async (role) => {
        if (role === "leader") {
          try {
            await this.connection();
            this.logger.info("[RealtimeManager] Leader tab connected WebSocket");
          } catch (err: Error | any) {
            this.logger.warn(
              `[RealtimeManager] Leader failed to connect '${defaultName}': ${(err as Error).message}`,
            );
          }
        } else {
          // Follower — disconnect if we were previously leader
          if (this.isConnectionActive(defaultName)) {
            await this.disconnect(defaultName);
            this.logger.info("[RealtimeManager] Follower tab disconnected WebSocket");
          }
        }
      });
    } else {
      // No coordinator — always connect (single-tab mode)
      try {
        await this.connection();
      } catch (err: Error | any) {
        this.logger.warn(
          `[RealtimeManager] Failed to warm default connection '${defaultName}': ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Disconnect all active connections on shutdown.
   */
  public async onModuleDestroy(): Promise<void> {
    await this.disconnectAll();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MultipleInstanceManager contract
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the default instance name from configuration.
   */
  public getDefaultInstance(): string {
    return this.config.default;
  }

  /**
   * Set the default instance name at runtime.
   */
  public setDefaultInstance(name: string): void {
    (this.config as any).default = name;
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
  public getInstanceConfig(name: string): Record<string, any> | undefined {
    const connectionConfig = this.config.connections[name];
    if (!connectionConfig) return undefined;

    return { ...connectionConfig };
  }

  /**
   * Sync driver creation — not used for realtime.
   *
   * Realtime always uses the async path via `createDriverAsync()`.
   *
   * @throws {Error} Always throws; use `connection()` for async resolution
   */
  protected createDriver(_driver: string, _config: Record<string, any>): RealtimeConnection {
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
  protected async createDriverAsync(
    _driver: string,
    config: Record<string, any>,
  ): Promise<RealtimeConnection> {
    const connectionName = (config as any).name ?? this.config.default;
    const conn = await this.connector.connect(config as RealtimeConnectionConfig);
    this.emit(RealtimeEvents.CONNECTED, { connection: connectionName });
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
  public async connection(name?: string): Promise<RealtimeConnection> {
    return await this.instanceAsync(name);
  }

  /**
   * Disconnect a specific connection and remove it from cache.
   *
   * @param name - Connection name. Uses default if omitted.
   */
  public async disconnect(name?: string): Promise<void> {
    const connectionName = name ?? this.config.default;

    if (this.hasInstance(connectionName)) {
      const conn = this.instance(connectionName);
      conn.disconnect();
      this.forgetInstance(connectionName);
      this.emit(RealtimeEvents.DISCONNECTED, { connection: connectionName, code: 1000 });
    }
  }

  /**
   * Disconnect all active connections and clear the cache.
   */
  public async disconnectAll(): Promise<void> {
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
  public async leaveAll(name?: string): Promise<void> {
    const conn = await this.connection(name);
    conn.leaveAll();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API — Introspection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all configured connection names (from config).
   */
  public getConnectionNames(): string[] {
    return Object.keys(this.config.connections);
  }

  /**
   * Get the default connection name.
   */
  public getDefaultConnectionName(): string {
    return this.config.default;
  }

  /**
   * Check if a connection has been resolved and is currently cached.
   *
   * @param name - Connection name. Uses default if omitted.
   */
  public isConnectionActive(name?: string): boolean {
    return this.hasInstance(name ?? this.config.default);
  }

  /**
   * Get all active (cached) connection names.
   */
  public getActiveConnectionNames(): string[] {
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
  private emit(event: string, payload?: unknown): void {
    if (!this.eventManager) return;
    try {
      this.eventManager.connection().emit(event, payload);
    } catch (error: Error | any) {
      this.logger.warn("Failed to emit event", { event, error });
    }
  }
}
