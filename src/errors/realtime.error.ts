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
export class RealtimeError extends Error {
  /** Error name for identification. */
  public readonly name: string = "RealtimeError";

  /** Error code for programmatic handling. */
  public readonly code: string = "REALTIME_ERROR";

  /** Optional underlying cause. */
  public readonly cause?: Error;

  /**
   * Create a new RealtimeError.
   *
   * @param message - Human-readable error message
   * @param cause   - Optional underlying error that caused this failure
   */
  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;

    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}
