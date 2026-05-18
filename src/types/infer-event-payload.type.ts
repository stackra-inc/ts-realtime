/**
 * @fileoverview Utility type for inferring event payloads from RealtimeEventPayloads.
 *
 * @module @stackra/ts-realtime
 * @category Types
 */

import type { RealtimeEventPayloads } from "@/interfaces/realtime-event-payloads.interface";

/**
 * Utility type that infers the event payload from `RealtimeEventPayloads`.
 *
 * If the event name matches a key in `RealtimeEventPayloads`, returns that
 * type. Otherwise falls back to `unknown`.
 *
 * @typeParam T - The event name string
 */
export type InferEventPayload<T extends string> = T extends keyof RealtimeEventPayloads
  ? RealtimeEventPayloads[T]
  : unknown;
