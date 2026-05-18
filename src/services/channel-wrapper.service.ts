/**
 * @fileoverview ChannelWrapper service for typed Laravel Echo channel subscriptions.
 * @module @stackra/ts-realtime
 * @category Services
 */

import type { InferEventPayload } from "@/types/infer-event-payload.type";
import { RealtimeChannelError } from "@/errors";

/**
 * Typed wrapper around a Laravel Echo channel subscription.
 *
 * Provides a fluent API for listening to broadcast events with generic type
 * parameters, error handling, and automatic cleanup via `leave()`. When
 * `leave()` is called, the wrapper notifies the `RealtimeManager` to remove
 * the channel from its internal tracking map.
 *
 * @description
 * Created internally by `RealtimeManager.channel()` and
 * `RealtimeManager.private()`. Consumers interact with this class through
 * the manager or via React hooks — direct instantiation is not typical.
 *
 * @example
 * ```typescript
 * import { realtime } from '@stackra/ts-realtime';
 *
 * const channel = realtime.channel('orders');
 *
 * channel
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     this.logger.info('New order:', data.id);
 *   })
 *   .onError((error) => {
 *     this.logger.error('Channel error:', error.message);
 *   });
 *
 * // Later, unsubscribe from the channel entirely
 * channel.leave();
 * ```
 */
export class ChannelWrapper {
  /** Whether this channel has been left. */
  private _left = false;

  /** Registered error callbacks. */
  private readonly _errorCallbacks = new Set<(error: Error) => void>();

  /**
   * Creates a new ChannelWrapper.
   *
   * @param echoChannel - The underlying Laravel Echo channel object
   * @param channelName - The name of the channel
   * @param onLeave - Callback invoked when `leave()` is called, used by the manager to remove tracking
   */
  constructor(
    private readonly echoChannel: any,
    private readonly channelName: string,
    private readonly onLeave: (name: string) => void,
  ) {}

  /**
   * Register a typed event listener on this channel.
   *
   * Delegates to the underlying Echo channel's `listen()` method. Throws
   * if the channel has already been left.
   *
   * When the event name matches a key in the global `RealtimeEventPayloads` interface,
   * the payload type is automatically inferred. Otherwise, provide an explicit
   * type parameter or it defaults to `unknown`.
   *
   * @template E - The event name string
   * @template T - The expected event payload type (inferred from RealtimeEventPayloads if possible)
   * @param event - The broadcast event name (e.g., `'.order.created'`)
   * @param callback - Handler invoked with the typed event data
   * @returns This wrapper for method chaining
   * @throws {Error} If the channel has been left
   *
   * @example
   * ```typescript
   * // With RealtimeEventPayloads augmentation — type is inferred:
   * channel.listen('.order.created', (data) => {
   *   this.logger.info(data.id); // typed!
   * });
   *
   * // With explicit type parameter:
   * channel.listen<OrderEvent>('.order.created', (data) => {
   *   this.logger.info(data.id);
   * });
   * ```
   */
  listen<E extends string = string, T = InferEventPayload<E>>(
    event: E,
    callback: (data: T) => void,
  ): ChannelWrapper {
    if (this._left) {
      throw new RealtimeChannelError(
        `Cannot listen on channel "${this.channelName}" — it has been left.`,
      );
    }

    this.echoChannel.listen(event, callback);

    return this;
  }

  /**
   * Listen for ALL events on this channel.
   *
   * Uses Echo's `listenToAll()` which binds to the raw Pusher channel's
   * `bind_global`. This bypasses Echo's event name formatting and catches
   * every event regardless of naming convention.
   *
   * The callback receives the raw event name and data. Pusher internal
   * events (prefixed with `pusher:`) are automatically filtered out.
   *
   * @param callback - Handler invoked with event name and data
   * @returns This wrapper for method chaining
   * @throws {Error} If the channel has been left
   */
  listenToAll(callback: (event: string, data: unknown) => void): ChannelWrapper {
    if (this._left) {
      throw new RealtimeChannelError(
        `Cannot listen on channel "${this.channelName}" — it has been left.`,
      );
    }

    this.echoChannel.listenToAll((event: string, data: unknown) => {
      callback(event, data);
    });

    return this;
  }

  /**
   * Remove a specific event listener from this channel.
   *
   * Delegates to the underlying Echo channel's `stopListening()` method.
   *
   * @param event - The broadcast event name to stop listening to
   * @param callback - Optional specific callback to remove. If omitted, all listeners for the event are removed.
   * @returns This wrapper for method chaining
   *
   * @example
   * ```typescript
   * // Remove all listeners for an event
   * channel.stopListening('.order.created');
   *
   * // Remove a specific listener
   * channel.stopListening('.order.created', myCallback);
   * ```
   */
  stopListening(event: string, callback?: CallableFunction): ChannelWrapper {
    this.echoChannel.stopListening(event, callback);
    return this;
  }

  /**
   * Send a client event (whisper) to other subscribers on this channel.
   *
   * Client events allow peer-to-peer communication without a server round-trip.
   * Only supported on private and presence channels — public channels do not
   * allow client events.
   *
   * @param event - The client event name (without the `client-` prefix)
   * @param data - The data to send to other subscribers
   * @returns This wrapper for method chaining
   * @throws {Error} If the channel has been left
   * @throws {Error} If the channel does not support whisper (public channels)
   *
   * @example
   * ```typescript
   * // Typing indicator
   * channel.whisper('typing', { user: 'John', typing: true });
   *
   * // Listen for whispers from others
   * channel.listenForWhisper('typing', (data) => {
   *   this.logger.info(`${data.user} is typing...`);
   * });
   * ```
   */
  whisper(event: string, data: Record<string, any>): this {
    if (this._left) {
      throw new RealtimeChannelError(
        `Cannot whisper on channel "${this.channelName}" — it has been left.`,
      );
    }

    if (typeof this.echoChannel.whisper !== "function") {
      throw new RealtimeChannelError(
        `Cannot whisper on channel "${this.channelName}" — client events are only supported on private and presence channels.`,
      );
    }

    this.echoChannel.whisper(event, data);
    return this;
  }

  /**
   * Listen for a whisper event (client event) from other subscribers.
   *
   * Whisper events are prefixed with `client-` by the transport layer.
   * This method handles the prefix automatically.
   *
   * @template T - The expected whisper payload type
   * @param event - The whisper event name (without the `client-` prefix)
   * @param callback - Handler invoked with the whisper data
   * @returns This wrapper for method chaining
   * @throws {Error} If the channel has been left
   *
   * @example
   * ```typescript
   * channel.listenForWhisper<TypingEvent>('typing', (data) => {
   *   this.logger.info(`${data.user} is ${data.typing ? 'typing' : 'idle'}`);
   * });
   * ```
   */
  listenForWhisper<T>(event: string, callback: (data: T) => void): this {
    if (this._left) {
      throw new RealtimeChannelError(
        `Cannot listen on channel "${this.channelName}" — it has been left.`,
      );
    }

    this.echoChannel.listenForWhisper(event, callback);
    return this;
  }

  /**
   * Listen for Laravel notification broadcasts on this channel.
   *
   * Delegates to the underlying Echo channel's `notification()` method,
   * which listens for `Illuminate\Notifications\Events\BroadcastNotificationCreated`.
   * Typically used on private user channels (e.g., `App.Models.User.{id}`).
   *
   * Throws if the channel has been left or if the underlying transport
   * does not support `.notification()` (e.g., public channels).
   *
   * @template T - The expected notification payload type
   * @param callback - Handler invoked with the typed notification data
   * @returns This wrapper for method chaining
   * @throws {Error} If the channel has been left
   * @throws {Error} If the underlying channel does not support notifications
   *
   * @example
   * ```typescript
   * const userChannel = manager.private('App.Models.User.1');
   *
   * userChannel.notification<IncomingNotification>((notification) => {
   *   this.logger.info(notification.type, notification.data);
   * });
   * ```
   */
  notification<T>(callback: (data: T) => void): ChannelWrapper {
    if (this._left) {
      throw new RealtimeChannelError(
        `Cannot listen on channel "${this.channelName}" — it has been left.`,
      );
    }

    if (typeof this.echoChannel.notification !== "function") {
      throw new RealtimeChannelError(
        `Channel "${this.channelName}" does not support .notification(). ` +
          "This method is only available on private and presence channels.",
      );
    }

    this.echoChannel.notification(callback);
    return this;
  }

  /**
   * Register an error callback for this channel.
   *
   * Error callbacks are invoked when the channel encounters an error,
   * such as an authentication failure on a private or presence channel.
   * The callback is also bound to the underlying Echo channel's error event
   * so that transport-level errors are surfaced automatically.
   *
   * @param callback - Handler invoked with the error
   * @returns This wrapper for method chaining
   *
   * @example
   * ```typescript
   * channel.onError((error) => {
   *   this.logger.error('Auth failed:', error.message);
   * });
   * ```
   */
  onError(callback: (error: Error) => void): ChannelWrapper {
    this._errorCallbacks.add(callback);

    // Bind to the underlying Echo channel error event if available
    if (typeof this.echoChannel.error === "function") {
      this.echoChannel.error((error: any) => {
        const err = error instanceof Error ? error : new Error(error?.message ?? "Channel error");
        callback(err);
      });
    }

    return this;
  }

  /**
   * Leave this channel, unsubscribing from all events.
   *
   * Notifies the manager to remove this channel from its internal tracking
   * and marks the wrapper as left. Subsequent calls to `listen()` will throw.
   *
   * @example
   * ```typescript
   * channel.leave();
   * ```
   */
  leave(): void {
    if (this._left) return;
    this._left = true;
    this.onLeave(this.channelName);
  }

  /**
   * The name of this channel.
   *
   * @returns The channel name string
   *
   * @example
   * ```typescript
   * const channel = manager.channel('orders');
   * this.logger.info(channel.name); // 'orders'
   * ```
   */
  get name(): string {
    return this.channelName;
  }

  /**
   * Whether this channel has been left.
   *
   * @returns `true` if `leave()` has been called
   */
  get isLeft(): boolean {
    return this._left;
  }

  /**
   * Notify all registered error callbacks.
   *
   * @param error - The error to propagate
   * @internal
   */
  _notifyError(error: Error): void {
    for (const cb of this._errorCallbacks) {
      cb(error);
    }
  }
}
