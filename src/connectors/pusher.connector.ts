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

import { Injectable } from "@stackra/ts-container";

import type { RealtimeConnector } from "@/interfaces/realtime-connector.interface";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";
import { EchoConnection } from "@/connections/echo.connection";
import { RealtimeConnectionError } from "@/errors";
import { ConnectionStatus } from "@stackra/contracts";
import { Logger } from "@stackra/ts-logger";

/**
 * Connector factory that creates `EchoConnection` instances backed by Laravel Echo.
 *
 * The optional `dispatchFn` is set by `RealtimeModule` after initialization
 * to bridge WebSocket events into `@stackra/ts-events` without creating
 * a circular dependency.
 */
@Injectable()
export class LaravelEchoConnector implements RealtimeConnector {
  /**
   * Logger instance scoped to the LaravelEchoConnector context.
   */
  private readonly logger = new Logger(LaravelEchoConnector.name);

  /** Optional event dispatch function — set by RealtimeModule to bridge WS → ts-events. */
  private emitFn?: (event: string, data: unknown) => void;

  /**
   * Sets the event dispatch function for auto-bridging WS events into ts-events.
   *
   * Called by RealtimeModule during initialization when @stackra/ts-events
   * is available. This avoids a direct dependency on ts-events.
   *
   * @param fn - A function that dispatches events (typically eventEmitterManager.emit)
   */
  setDispatchFn(fn: (event: string, data: unknown) => void): void {
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
  async connect(config: RealtimeConnectionConfig): Promise<RealtimeConnection> {
    if (!config.key) {
      this.logger.warn(
        "Returning no-op connection: Pusher application key is not configured. " +
          "Set VITE_REVERB_APP_KEY or VITE_PUSHER_APP_KEY in your .env file.",
      );
      return this.createNoOpConnection();
    }
    if (!config.wsHost) {
      this.logger.warn(
        "Returning no-op connection: WebSocket host is not configured. " +
          "Set VITE_REVERB_HOST or VITE_PUSHER_HOST in your .env file.",
      );
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
  private createNoOpConnection(): RealtimeConnection {
    const notConfigured = (method: string) =>
      new RealtimeConnectionError(
        `Cannot call ${method}() — realtime is not configured. ` +
          "Set VITE_REVERB_APP_KEY + VITE_REVERB_HOST in your .env file.",
      );

    return {
      getName: () => "no-op",
      getStatus: () => ConnectionStatus.Disconnected,
      isConnected: () => false,
      connect: () => {},
      disconnect: () => {},
      channel: () => {
        throw notConfigured("channel");
      },
      private: () => {
        throw notConfigured("private");
      },
      join: () => {
        throw notConfigured("join");
      },
      onStatusChange: () => () => {},
      socketId: () => undefined,
      leaveAll: () => {},
      reconnectAttempts: 0,
    } as unknown as RealtimeConnection;
  }
}
