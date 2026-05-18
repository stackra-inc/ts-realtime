/**
 * @fileoverview RealtimeConnection interface for transport-agnostic connection API.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

import type { ConnectionStatus } from "@stackra/contracts";
import type { ChannelWrapper } from "@/services/channel-wrapper.service";
import type { PresenceChannelWrapper } from "@/services/presence-channel-wrapper.service";

/**
 * Standard interface for a realtime transport connection.
 *
 * All realtime drivers (Echo, Socket.IO, Ably, Mock, etc.) implement this
 * interface to expose a uniform API for channels, presence, events, and
 * connection lifecycle.
 *
 * @example
 * ```typescript
 * const conn: RealtimeConnection = await manager.connection('main');
 *
 * conn.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info('New order:', data.id);
 *   });
 * ```
 */
export interface RealtimeConnection {
  /** Get the connection name. */
  getName(): string;

  /** Get the current connection status. */
  getStatus(): ConnectionStatus;

  /** Whether the connection is currently active. */
  isConnected(): boolean;

  /** Initiate the transport connection. */
  connect(): void;

  /** Tear down the transport connection and release resources. */
  disconnect(): void;

  /** Subscribe to a public channel. */
  channel(name: string): ChannelWrapper;

  /** Subscribe to a private channel. */
  private(name: string): ChannelWrapper;

  /** Join a presence channel. */
  join(name: string): PresenceChannelWrapper;

  /** Register a listener for connection status changes. Returns an unsubscribe function. */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void;

  /** Get the socket ID for the connection. Returns undefined if not connected. */
  socketId(): string | undefined;

  /** Leave all channels (public, private, and presence) on this connection. */
  leaveAll(): void;

  /** The number of consecutive failed reconnection attempts. */
  readonly reconnectAttempts: number;
}
