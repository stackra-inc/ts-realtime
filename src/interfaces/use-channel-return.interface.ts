/**
 * @fileoverview UseChannelReturn interface.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

/**
 * Return type for the `useChannel` hook.
 */
export interface UseChannelReturn<T> {
  /** The latest event payload, or `null` if no event has been received. */
  data: T | null;
  /** Whether the WebSocket connection is currently active. */
  connected: boolean;
  /** The latest error, or `null` if no error has occurred. */
  error: Error | null;
}
