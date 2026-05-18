/**
 * @fileoverview PresenceChannelWrapper service for typed presence channel subscriptions.
 * @module @stackra/ts-realtime
 * @category Services
 */

import { ChannelWrapper } from "./channel-wrapper.service";

/**
 * Typed wrapper around a Laravel Echo presence channel subscription.
 *
 * Extends {@link ChannelWrapper} with presence-specific member tracking:
 * `here()`, `joining()`, `leaving()`, and `getMembers()`. The internal
 * members list is always updated **before** invoking consumer callbacks,
 * ensuring that `getMembers()` returns the current state inside any callback.
 *
 * @description
 * Created internally by `RealtimeManager.join()`. Consumers interact with
 * this class through the manager or via the `usePresence` React hook —
 * direct instantiation is not typical.
 *
 * @example
 * ```typescript
 * import { realtime } from '@stackra/ts-realtime';
 *
 * interface User {
 *   id: number;
 *   name: string;
 * }
 *
 * const presence = realtime.join('chat-room.1');
 *
 * presence
 *   .here<User>((members) => {
 *     this.logger.info('Currently online:', members);
 *   })
 *   .joining<User>((member) => {
 *     this.logger.info(`${member.name} joined`);
 *   })
 *   .leaving<User>((member) => {
 *     this.logger.info(`${member.name} left`);
 *   });
 * ```
 */
export class PresenceChannelWrapper extends ChannelWrapper {
  /** Current list of presence channel members. */
  private _members: any[] = [];

  /**
   * Register a callback for the initial member list.
   *
   * Delegates to the underlying Echo channel's `here()` method. The internal
   * members list is updated **before** the callback is invoked.
   *
   * @template T - The member type
   * @param callback - Handler invoked with the full list of current members
   * @returns This wrapper for method chaining
   *
   * @example
   * ```typescript
   * presence.here<User>((members) => {
   *   this.logger.info('Online:', members.length);
   * });
   * ```
   */
  here<T>(callback: (members: T[]) => void): PresenceChannelWrapper {
    (this as any).echoChannel.here((members: T[]) => {
      this._members = [...members];
      callback(members);
    });
    return this;
  }

  /**
   * Register a callback for member join events.
   *
   * Delegates to the underlying Echo channel's `joining()` method. The new
   * member is added to the internal list **before** the callback is invoked.
   *
   * @template T - The member type
   * @param callback - Handler invoked with the joining member
   * @returns This wrapper for method chaining
   *
   * @example
   * ```typescript
   * presence.joining<User>((member) => {
   *   this.logger.info(`${member.name} joined`);
   * });
   * ```
   */
  joining<T>(callback: (member: T) => void): PresenceChannelWrapper {
    (this as any).echoChannel.joining((member: T) => {
      this._members = [...this._members, member];
      callback(member);
    });
    return this;
  }

  /**
   * Register a callback for member leave events.
   *
   * Delegates to the underlying Echo channel's `leaving()` method. The
   * departing member is removed from the internal list **before** the
   * callback is invoked.
   *
   * @template T - The member type
   * @param callback - Handler invoked with the leaving member
   * @returns This wrapper for method chaining
   *
   * @example
   * ```typescript
   * presence.leaving<User>((member) => {
   *   this.logger.info(`${member.name} left`);
   * });
   * ```
   */
  leaving<T>(callback: (member: T) => void): PresenceChannelWrapper {
    (this as any).echoChannel.leaving((member: T) => {
      this._members = this._members.filter((m) => m !== member);
      callback(member);
    });
    return this;
  }

  /**
   * Get the current list of members in this presence channel.
   *
   * Returns a shallow copy of the internal members array to prevent
   * external mutation.
   *
   * @template T - The member type
   * @returns A copy of the current members array
   *
   * @example
   * ```typescript
   * const members = presence.getMembers<User>();
   * this.logger.info(`${members.length} users online`);
   * ```
   */
  getMembers<T>(): T[] {
    return [...this._members] as T[];
  }
}
