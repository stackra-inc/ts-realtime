/**
 * @fileoverview Realtime connection error.
 * @module @stackra/ts-realtime
 * @category Errors
 */

import { RealtimeError } from "./realtime.error";

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
export class RealtimeConnectionError extends RealtimeError {
  /** Error name for identification. */
  public override readonly name: string = "RealtimeConnectionError";

  /** Error code for programmatic handling. */
  public override readonly code: string = "REALTIME_CONNECTION_ERROR";
}
