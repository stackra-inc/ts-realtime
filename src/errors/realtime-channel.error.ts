/**
 * @fileoverview Realtime channel error.
 * @module @stackra/ts-realtime
 * @category Errors
 */

import { RealtimeError } from "./realtime.error";

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
export class RealtimeChannelError extends RealtimeError {
  /** Error name for identification. */
  public override readonly name: string = "RealtimeChannelError";

  /** Error code for programmatic handling. */
  public override readonly code: string = "REALTIME_CHANNEL_ERROR";
}
