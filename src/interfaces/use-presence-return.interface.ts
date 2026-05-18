/**
 * @fileoverview UsePresenceReturn interface.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

/**
 * Return type for the `usePresence` hook.
 */
export interface UsePresenceReturn<TMember> {
  /** The current list of members in the presence channel. */
  members: TMember[];
  /** Whether the WebSocket connection is currently active. */
  connected: boolean;
  /** The latest error, or `null` if no error has occurred. */
  error: Error | null;
}
