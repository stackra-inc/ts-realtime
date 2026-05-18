/**
 * @fileoverview UseRealtimeReturn interface.
 *
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

import type { ConnectionStatus } from "@stackra/contracts";
import type { RealtimeManager } from "@/services/realtime-manager.service";

/**
 * Return type for the `useRealtime` hook.
 */
export interface UseRealtimeReturn {
  /** The current connection status. */
  status: ConnectionStatus;
  /** Whether the WebSocket connection is currently active. */
  isConnected: boolean;
  /** The `RealtimeManager` instance for imperative operations. */
  manager: RealtimeManager;
}
