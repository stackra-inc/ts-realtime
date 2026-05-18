/**
 * @fileoverview RealtimeEventsBridgeListener — bridges WebSocket events into `@stackra/ts-events`.
 *
 * Replaces the previous `REALTIME_AUTO_BRIDGE` factory that resolved the
 * event manager via `require()` and `globalThis.__APP__`. Now uses proper
 * DI with an `@Optional()` injection so the realtime package keeps
 * `@stackra/ts-events` as a soft dependency.
 *
 * Wires the connector's `dispatchFn` once at `onApplicationBootstrap`.
 * Each subsequent channel subscription auto-bridges every event into
 * the events bus as `realtime:{channel}.{event}`.
 *
 * @module @stackra/ts-realtime
 * @category Listeners
 */

import { Inject, Injectable, Optional, type IOnApplicationBootstrap } from "@stackra/ts-container";

import { EVENT_EMITTER_MANAGER, REALTIME_CONNECTOR } from "@stackra/contracts";
import type { LaravelEchoConnector } from "@/connectors/pusher.connector";
import { Logger } from "@stackra/ts-logger";

/**
 * Minimal structural type for the EventEmitterManager from `@stackra/ts-events`.
 *
 * Avoids a hard import — we only need `connection().emit()` access.
 *
 * @internal
 */
interface EventEmitterManagerLike {
  connection(name?: string): { emit(event: string, ...args: unknown[]): boolean };
}

/**
 * Bridges incoming WebSocket events into the events bus.
 *
 * When `@stackra/ts-events` is in the DI graph, every channel subscription
 * dispatches its events into the default event emitter connection as
 * `realtime:{channel}.{event}`. Consumers subscribe with `@OnEvent` /
 * `useOnEvent` on the events package — no manual bridge calls needed.
 *
 * When `@stackra/ts-events` is not registered, the bridge is a no-op.
 */
@Injectable()
export class RealtimeEventsBridgeListener implements IOnApplicationBootstrap {
  /**
   * Logger scoped to the bridge listener.
   */
  private readonly logger = new Logger(RealtimeEventsBridgeListener.name);

  /**
   * @param connector - The realtime connector. Required (always present
   *   because `RealtimeModule` registers it).
   * @param eventManager - Optional events manager. Resolved via DI when
   *   `@stackra/ts-events` is in the application graph.
   */
  public constructor(
    @Inject(REALTIME_CONNECTOR) private readonly connector: LaravelEchoConnector,
    @Optional()
    @Inject(EVENT_EMITTER_MANAGER)
    private readonly eventManager?: EventEmitterManagerLike,
  ) {}

  /**
   * Wire the connector's dispatch function so every channel subscription
   * auto-bridges its events into the events bus.
   *
   * Runs after every provider is initialised so the events manager (if
   * any) is fully ready.
   */
  public onApplicationBootstrap(): void {
    if (!this.eventManager) {
      this.logger.debug(
        "Skipping bridge: @stackra/ts-events is not registered. Realtime events will not be dispatched into the events bus.",
      );
      return;
    }

    const eventManager = this.eventManager;

    this.connector.setDispatchFn((event: string, data: unknown) => {
      try {
        eventManager.connection().emit(event, data);
      } catch (err: Error | unknown) {
        this.logger.warn("Failed to dispatch realtime event into events bus", {
          event,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.logger.debug("Bridge wired: realtime channel events will dispatch into the events bus.");
  }
}
