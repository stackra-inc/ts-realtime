/**
 * Define Config Utility
 *
 * Helper function to define realtime module options with type safety.
 * Follows the `defineConfig()` pattern popularized by Vite, Vitest,
 * and similar tools.
 *
 * @module utils/define-config
 */

import type { RealtimeModuleOptions } from "@/interfaces/realtime-module-options.interface";

/**
 * Helper function to define realtime module options with type safety.
 *
 * Provides IDE autocomplete and type checking for configuration objects.
 *
 * @param config - The realtime module configuration object
 * @returns The same configuration object with proper typing
 *
 * @example
 * ```typescript
 * // realtime.config.ts
 * import { defineConfig } from '@stackra/ts-realtime';
 *
 * export default defineConfig({
 *   default: env('VITE_REALTIME_DEFAULT_CONNECTION', 'main'),
 *   connections: {
 *     main: {
 *       driver: 'echo',
 *       key: env('VITE_PUSHER_APP_KEY', ''),
 *       wsHost: env('VITE_PUSHER_HOST', ''),
 *     },
 *   },
 * });
 * ```
 */
export function defineConfig(config: RealtimeModuleOptions): RealtimeModuleOptions {
  return config;
}
