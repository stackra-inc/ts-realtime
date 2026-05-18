/**
 * @fileoverview RealtimeModule — DI module for real-time WebSocket services.
 * @module @stackra/ts-realtime
 * @category Module
 */

import { Module, type IDynamicModule } from "@stackra/ts-container";
import { Env } from "@stackra/ts-support";

import { REALTIME_CONFIG, REALTIME_MANAGER, REALTIME_CONNECTOR } from "@stackra/contracts";
import { RealtimeManager } from "@/services/realtime-manager.service";
import { LaravelEchoConnector } from "@/connectors/pusher.connector";
import { RealtimeEventsBridgeListener } from "@/listeners/realtime-events-bridge.listener";
import { SocketIdMiddleware } from "@/middleware/socket-id.middleware";
import type { RealtimeModuleOptions } from "@/interfaces/realtime-module-options.interface";
import { getRealtimeConnectionToken } from "@/decorators/inject-realtime.decorator";
import { Logger } from "@stackra/ts-logger";
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
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Module pattern
export class RealtimeModule {
  /**
   * Logger instance scoped to the RealtimeModule context.
   */
  private static readonly logger = new Logger(RealtimeModule.name);

  /**
   * Check if Realtime credentials are configured.
   *
   * Returns `true` only when non-empty key AND host are set for at least
   * one driver (Pusher or Reverb). Empty strings from env vars are treated
   * as unconfigured.
   */
  public static hasCredentials(): boolean {
    try {
      const pusherKey = String(Env.get("VITE_PUSHER_APP_KEY", "") ?? "").trim();
      const pusherHost = String(Env.get("VITE_PUSHER_HOST", "") ?? "").trim();
      const reverbKey = String(Env.get("VITE_REVERB_APP_KEY", "") ?? "").trim();
      const reverbHost = String(Env.get("VITE_REVERB_HOST", "") ?? "").trim();

      const hasPusher = pusherKey.length > 0 && pusherHost.length > 0;
      const hasReverb = reverbKey.length > 0 && reverbHost.length > 0;
      return hasPusher || hasReverb;
    } catch {
      // Env not available yet (e.g. during SSR or before vite env plugin boots)
      return false;
    }
  }

  /**
   * Configure the realtime WebSocket connections.
   *
   * @param config - The realtime module configuration.
   * @returns A dynamic module.
   */
  public static forRoot(config: RealtimeModuleOptions): IDynamicModule {
    if (!RealtimeModule.hasCredentials()) {
      RealtimeModule.logger.warn(
        "Skipping registration: Either (VITE_PUSHER_APP_KEY + VITE_PUSHER_HOST) or (VITE_REVERB_APP_KEY + VITE_REVERB_HOST) are required.",
      );

      return {
        module: RealtimeModule,
        providers: [],
        exports: [],
      };
    }

    // Per-connection providers so `@InjectRealtime('name')` resolves.
    const connectionProviders = Object.keys(config.connections).map((connectionName) => ({
      provide: getRealtimeConnectionToken(connectionName),
      useFactory: async (manager: RealtimeManager) => manager.connection(connectionName),
      inject: [RealtimeManager],
    }));

    // The "default" token always points at the configured default connection.
    const defaultConnectionProvider = {
      provide: getRealtimeConnectionToken(),
      useFactory: async (manager: RealtimeManager) => manager.connection(),
      inject: [RealtimeManager],
    };

    const connectionTokens = [
      getRealtimeConnectionToken(),
      ...Object.keys(config.connections).map(getRealtimeConnectionToken),
    ];

    return {
      module: RealtimeModule,
      global: true,
      providers: [
        { provide: REALTIME_CONFIG, useValue: config },
        { provide: RealtimeManager, useClass: RealtimeManager },
        { provide: REALTIME_MANAGER, useExisting: RealtimeManager },
        { provide: REALTIME_CONNECTOR, useClass: LaravelEchoConnector },

        defaultConnectionProvider,
        ...connectionProviders,

        // Bridges WebSocket events into @stackra/ts-events when present.
        RealtimeEventsBridgeListener,

        // Auto-discovered by the @stackra/ts-http middleware pipeline.
        SocketIdMiddleware,
      ],
      exports: [RealtimeManager, REALTIME_MANAGER, ...connectionTokens],
    };
  }
}
