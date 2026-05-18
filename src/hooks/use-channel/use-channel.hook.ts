/**
 * @fileoverview useChannel React hook for declarative channel subscriptions.
 * @module @stackra/ts-realtime
 * @category Hooks
 */

import { useState, useEffect, useRef } from "react";
import { useInject } from "@stackra/ts-container/react";

import { REALTIME_MANAGER } from "@stackra/contracts";
import type { RealtimeManager } from "@/services/realtime-manager.service";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";
import type { ChannelWrapper } from "@/services/channel-wrapper.service";
import type { UseChannelReturn } from "@/interfaces/use-channel-return.interface";
import { RealtimeError } from "@/errors";

/**
 * Module-level ref counting map for shared channel subscriptions.
 *
 * Multiple `useChannel` hooks subscribing to the same channel share a single
 * `ChannelWrapper`. The last hook to unmount calls `leave()`.
 */
const channelRefCounts = new Map<string, number>();

/**
 * React hook for subscribing to a Laravel Broadcasting channel event.
 *
 * Obtains the `RealtimeManager` from the DI container via `useInject`,
 * resolves the default connection asynchronously, subscribes to the specified
 * channel and event, and automatically cleans up on unmount. Re-subscribes
 * when `channelName` or `eventName` change.
 *
 * Uses internal ref counting so that multiple hooks subscribing to the same
 * channel share a single `ChannelWrapper`. The channel is only left when the
 * last hook unmounts.
 *
 * @template T - The expected event payload type
 * @param channelName - The channel name to subscribe to
 * @param eventName - The broadcast event name to listen for
 * @param options - Optional configuration
 * @param options.enabled - Whether the subscription is active (default: `true`)
 * @returns An object containing `data`, `connected`, and `error`
 *
 * @example
 * ```tsx
 * import { useChannel } from '@stackra/ts-realtime';
 *
 * interface OrderEvent {
 *   id: number;
 *   status: string;
 * }
 *
 * function OrderNotifications() {
 *   const { data, connected, error } = useChannel<OrderEvent>(
 *     'orders',
 *     '.order.created',
 *   );
 *
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!connected) return <div>Connecting...</div>;
 *   if (!data) return <div>Waiting for events...</div>;
 *
 *   return <div>New order: {data.id}</div>;
 * }
 * ```
 */
export function useChannel<T>(
  channelName: string,
  eventName: string,
  options?: { enabled?: boolean },
): UseChannelReturn<T> {
  const manager = useInject<RealtimeManager>(REALTIME_MANAGER);

  if (!manager) {
    throw new RealtimeError(
      "RealtimeManager not found. Import RealtimeModule.forRoot() in your app module.",
    );
  }

  const enabled = options?.enabled ?? true;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const connRef = useRef<RealtimeConnection | null>(null);
  const channelRef = useRef<ChannelWrapper | null>(null);

  // Resolve the default connection asynchronously
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const resolve = async () => {
      try {
        const conn = await manager.connection();
        if (cancelled) return;
        connRef.current = conn;
        setConnected(conn.isConnected());

        unsubscribe = conn.onStatusChange(() => {
          setConnected(conn.isConnected());
        });
      } catch (err: Error | any) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to resolve connection"));
        }
      }
    };

    resolve();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [manager, enabled]);

  // Subscribe to channel and event once connected
  useEffect(() => {
    if (!enabled || !connected || !connRef.current) return;

    const conn = connRef.current;
    let wrapper: ChannelWrapper;

    try {
      wrapper = conn.channel(channelName);
      channelRef.current = wrapper;

      // Increment ref count
      const currentCount = channelRefCounts.get(channelName) ?? 0;
      channelRefCounts.set(channelName, currentCount + 1);

      wrapper
        .listen<string, T>(eventName, (eventData) => {
          setData(eventData);
        })

        .onError((err) => {
          setError(err);
        });
    } catch (err: Error | any) {
      setError(err instanceof Error ? err : new Error("Failed to subscribe"));
      return;
    }

    return () => {
      // Stop listening to the specific event
      try {
        wrapper.stopListening(eventName);
      } catch {
        // Channel may already be left
      }

      // Decrement ref count and leave if last
      const count = channelRefCounts.get(channelName) ?? 1;
      if (count <= 1) {
        channelRefCounts.delete(channelName);
        try {
          wrapper.leave();
        } catch {
          // Already left
        }
      } else {
        channelRefCounts.set(channelName, count - 1);
      }

      channelRef.current = null;
    };
  }, [channelName, eventName, enabled, connected]);

  return { data, connected, error };
}
