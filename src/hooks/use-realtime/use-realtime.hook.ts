/**
 * @fileoverview useRealtime React hook for connection status and manager access.
 * @module @stackra/ts-realtime
 * @category Hooks
 */

import { useState, useEffect, useRef } from "react";
import { useInject } from "@stackra/ts-container/react";

import { REALTIME_MANAGER } from "@stackra/contracts";
import { ConnectionStatus } from "@stackra/contracts";
import type { RealtimeManager } from "@/services/realtime-manager.service";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { UseRealtimeReturn } from "@/interfaces/use-realtime-return.interface";
import { RealtimeError } from "@/errors";

/**
 * React hook for accessing the realtime connection status and manager.
 *
 * Resolves the default connection asynchronously and subscribes to
 * `onStatusChange()`, triggering a re-render whenever the connection
 * state transitions. Provides direct access to the `RealtimeManager`
 * instance for imperative operations.
 *
 * @returns An object containing `status`, `isConnected`, and `manager`
 *
 * @example
 * ```tsx
 * import { useRealtime, ConnectionStatus } from '@stackra/ts-realtime';
 *
 * function ConnectionIndicator() {
 *   const { status, isConnected, manager } = useRealtime();
 *
 *   return (
 *     <div>
 *       <span>Status: {status}</span>
 *       {!isConnected && (
 *         <button onClick={() => manager.connection()}>
 *           Reconnect
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealtime(): UseRealtimeReturn {
  const manager = useInject<RealtimeManager>(REALTIME_MANAGER);

  if (!manager) {
    throw new RealtimeError(
      "RealtimeManager not found. Import RealtimeModule.forRoot() in your app module.",
    );
  }

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.Disconnected);
  const connRef = useRef<RealtimeConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    manager
      .connection()
      .then((conn) => {
        if (cancelled) return;
        connRef.current = conn;
        setStatus(conn.getStatus());

        unsubscribe = conn.onStatusChange((newStatus) => {
          setStatus(newStatus);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(ConnectionStatus.Error);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [manager]);

  return {
    status,
    isConnected: status === ConnectionStatus.Connected,
    manager,
  };
}
