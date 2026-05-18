/**
 * @stackra/ts-realtime
 *
 * Platform-agnostic realtime WebSocket framework with DI module, typed channels,
 * multi-connection support, reconnection, and React hooks for real-time
 * WebSocket communication.
 *
 * @example
 * ```typescript
 * import {
 *   RealtimeModule,
 *   realtime,
 *   useChannel,
 *   usePresence,
 *   useRealtime,
 *   ConnectionStatus,
 * } from '@stackra/ts-realtime';
 * ```
 *
 * @module @stackra/ts-realtime
 */

// ============================================================================
// Module
// ============================================================================
export { RealtimeModule } from "./realtime.module";

// ============================================================================
// Services
// ============================================================================
export { RealtimeManager, ChannelWrapper, PresenceChannelWrapper } from "./services";

// ============================================================================
// Connectors
// ============================================================================
export { LaravelEchoConnector, RedisConnector } from "./connectors";

// ============================================================================
// Connections
// ============================================================================
export { EchoConnection, RedisConnection } from "./connections";

// ============================================================================
// Listeners
// ============================================================================
export { RealtimeEventsBridgeListener } from "./listeners";

// ============================================================================
// Middleware
// ============================================================================
export { SocketIdMiddleware } from "./middleware";

// ============================================================================
// Facades
// ============================================================================
export { realtime } from "./facades";

// ============================================================================
// Hooks
// ============================================================================
export { useChannel, usePresence, useRealtime } from "./hooks";

// ============================================================================
// Decorators
// ============================================================================
export { InjectRealtime, getRealtimeConnectionToken, InjectRealtimeManager } from "./decorators";

// ============================================================================
// Utils
// ============================================================================
export { defineConfig } from "./utils";

// ============================================================================
// Errors
// ============================================================================
export { RealtimeError, RealtimeConnectionError, RealtimeChannelError } from "./errors";

// ============================================================================
// Interfaces
// ============================================================================
export type {
  RealtimeModuleOptions,
  RealtimeConnectionConfig,
  RealtimeConnectionConfig as RedisConnectionConfig,
  UseChannelReturn,
  UsePresenceReturn,
  UseRealtimeReturn,
} from "./interfaces";

// ============================================================================
// Types
// ============================================================================
export type { InferEventPayload } from "./types";
