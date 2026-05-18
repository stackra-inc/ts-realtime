/**
 * @fileoverview Barrel export for interface definitions.
 * @module @stackra/ts-realtime
 * @category Interfaces
 */

export type { RealtimeModuleOptions } from "./realtime-module-options.interface";
export type {
  RealtimeConnectionConfig,
  RealtimeConnectionConfig as RedisConnectionConfig,
  RealtimeConnectionConfig as RedisRealtimeConnectionConfig,
} from "./realtime-connection-config.interface";
export type { UseChannelReturn } from "./use-channel-return.interface";
export type { UsePresenceReturn } from "./use-presence-return.interface";
export type { UseRealtimeReturn } from "./use-realtime-return.interface";
