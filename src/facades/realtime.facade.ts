/**
 * Realtime inject proxy
 *
 * Typed proxy for {@link RealtimeManager} from `@stackra/ts-realtime`.
 *
 * Core singleton managing the Laravel Echo WebSocket connection, channel
 * subscriptions, reconnection, and observable connection state.
 *
 * The facade is a module-level constant typed as `RealtimeManager`.
 * It lazily resolves the service from the DI container on first property
 * access — safe to use at module scope before bootstrap completes.
 *
 * ## Setup (once, in main.tsx)
 *
 * ```typescript
 * import { Application } from '@stackra/ts-container';
 * import { inject } from "@stackra/ts-container";
 *
 * const app = await Application.create(AppModule);
 * Application.create(AppModule); // wires all facades
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { Realtimeinject proxy } from '@stackra/ts-realtime';
 *
 * // Subscribe to a public channel
 * Realtimeinject proxy.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info('New order:', data.id);
 *   });
 *
 * // Join a presence channel
 * Realtimeinject proxy.join('chat-room.1')
 *   .here<User>((members) => logger.info('Online:', members));
 *
 * // Check connection status
 * if (Realtimeinject proxy.isConnected()) {
 *   logger.info('WebSocket is active');
 * }
 * ```
 *
 * ## Available methods (from {@link RealtimeManager})
 *
 * - `connect(): void`
 * - `disconnect(): void`
 * - `channel(name: string): ChannelWrapper`
 * - `private(name: string): ChannelWrapper`
 * - `join(name: string): PresenceChannelWrapper`
 * - `getStatus(): ConnectionStatus`
 * - `onStatusChange(cb): () => void`
 * - `isConnected(): boolean`
 *
 * ## Testing — swap in a mock
 *
 * ```typescript
 * import { inject } from "@stackra/ts-container";
 * import { REALTIME_MANAGER } from '@stackra/ts-realtime';
 *
 * // Before test — replace the resolved instance
 * inject.swap(REALTIME_MANAGER, mockInstance);
 *
 * // After test — restore
 * inject.clearAll();
 * ```
 *
 * @module facades/realtime
 * @see {@link RealtimeManager} — the underlying service
 * @see {@link inject} — the lazy DI resolution function
 */

import { inject } from "@stackra/ts-container";
import { RealtimeManager } from "@/services/realtime-manager.service";
import { REALTIME_MANAGER } from "@stackra/contracts";

/**
 * Realtimeinject proxy — typed proxy for {@link RealtimeManager}.
 *
 * Resolves `RealtimeManager` from the DI container via the `REALTIME_MANAGER` token.
 * All property and method access is forwarded to the resolved instance
 * with correct `this` binding.
 *
 * Call `Application.create(AppModule)` once during bootstrap before using this.
 *
 * @example
 * ```typescript
 * Realtimeinject proxy.channel('orders')
 *   .listen<OrderEvent>('.order.created', (data) => {
 *     logger.info(data);
 *   });
 * ```
 */
export const realtime: RealtimeManager = inject<RealtimeManager>(REALTIME_MANAGER);
