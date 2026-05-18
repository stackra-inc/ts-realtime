/**
 * Realtime Configuration
 *
 * Multi-connection WebSocket configuration following the same pattern
 * as @stackra/ts-redis. Each named connection maps to a driver
 * (currently 'echo' for Laravel Echo) with its own credentials and settings.
 *
 * Connections are resolved lazily at runtime. Each connection can point
 * to a different WebSocket server with its own auth endpoint, reconnection
 * policy, and transport settings.
 *
 * ## Environment Variables
 *
 * | Variable                            | Description                        | Default                  |
 * |-------------------------------------|------------------------------------|--------------------------|
 * | `VITE_REALTIME_DEFAULT_CONNECTION`  | Default connection name            | `'main'`                 |
 * | `VITE_PUSHER_APP_KEY`              | Pusher/Soketi application key      | `''`                     |
 * | `VITE_PUSHER_HOST`                 | WebSocket host                     | `''`                     |
 * | `VITE_PUSHER_PORT`                 | WebSocket port                     | `6001`                   |
 * | `VITE_PUSHER_AUTH_ENDPOINT`        | Auth endpoint for private channels | `'/broadcasting/auth'`   |
 * | `VITE_PUSHER_FORCE_TLS`           | Force TLS connections              | `false`                  |
 * | `VITE_PUSHER_CLUSTER`             | Pusher cluster                     | `'mt1'`                  |
 * | `VITE_PUSHER_ENCRYPTED`           | Enable encrypted transport         | `false`                  |
 * | `VITE_REALTIME_RECONNECT_DELAY`   | Initial reconnect delay (ms)       | `1000`                   |
 * | `VITE_REALTIME_RECONNECT_MAX`     | Max reconnect delay (ms)           | `30000`                  |
 *
 * @module config/realtime
 *
 * @example
 * ```typescript
 * import realtimeConfig from './config/realtime.config';
 * import { RealtimeModule } from '@stackra/ts-realtime';
 *
 * RealtimeModule.forRoot(realtimeConfig);
 * ```
 */

import { defineConfig } from "@stackra/ts-realtime";

/**
 * Realtime configuration.
 *
 * Adapts to your environment via `env()` globals.
 */
const realtimeConfig = defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Global Registration
  |--------------------------------------------------------------------------
  |
  | When true, the RealtimeManager is available to all modules without
  | explicit imports. Recommended for most applications.
  |
  */
  isGlobal: true,

  /*
  |--------------------------------------------------------------------------
  | Default Connection
  |--------------------------------------------------------------------------
  |
  | The connection used when no specific name is passed to
  | `realtime.connection()`. Must match one of the keys below.
  |
  */
  default: env("VITE_REALTIME_DEFAULT_CONNECTION", "main"),

  /*
  |--------------------------------------------------------------------------
  | Realtime Connections
  |--------------------------------------------------------------------------
  |
  | Each connection maps to a WebSocket server. You can define as many
  | connections as you need — main app, admin panel, notifications, etc.
  |
  | Currently supported drivers:
  |   - 'echo' — Laravel Echo with Pusher/Soketi
  |
  | Future drivers:
  |   - 'socketio' — Socket.IO
  |   - 'ably' — Ably Realtime
  |   - 'mock' — Mock driver for testing
  |
  */
  connections: {
    /**
     * Primary connection.
     *
     * Used as the default for general-purpose realtime operations.
     * Connects to your Laravel Broadcasting server via Pusher/Soketi.
     */
    main: {
      driver: "echo",
      key: env("VITE_PUSHER_APP_KEY", ""),
      wsHost: env("VITE_PUSHER_HOST", ""),
      wsPort: env("VITE_PUSHER_PORT", 6001),
      authEndpoint: env("VITE_PUSHER_AUTH_ENDPOINT", "/broadcasting/auth"),
      forceTLS: env("VITE_PUSHER_FORCE_TLS", false),
      cluster: env("VITE_PUSHER_CLUSTER", "mt1"),
      encrypted: env("VITE_PUSHER_ENCRYPTED", false),
      disableStats: true,

      /** Reconnection: exponential backoff 1s → 2s → 4s → ... → 30s max */
      reconnectInitialDelay: env("VITE_REALTIME_RECONNECT_DELAY", 1000),
      reconnectMaxDelay: env("VITE_REALTIME_RECONNECT_MAX", 30000),
      reconnectMultiplier: 2,
    },
  },
});

export default realtimeConfig;
