/**
 * @fileoverview SocketIdMiddleware — adds the X-Socket-Id header to outgoing HTTP requests.
 *
 * Replaces the previous `REALTIME_HTTP_INTERCEPTOR` factory that
 * monkey-patched `httpClient.request` via `require("@stackra/ts-container")`
 * and `globalThis.__APP__`. Now a proper `@HttpMiddleware`-decorated
 * class that the http package auto-discovers and registers in its
 * pipeline.
 *
 * Laravel uses the socket ID to exclude the broadcast sender from
 * receiving their own events. Adding the header is harmless when the
 * server doesn't use it.
 *
 * @module @stackra/ts-realtime
 * @category Middleware
 */

import { Inject } from "@stackra/ts-container";
import { HttpMiddleware } from "@stackra/ts-http";
import type {
  HttpContext,
  HttpMiddlewareInterface,
  HttpNextFunction,
  HttpResponse,
} from "@stackra/ts-http";

import { REALTIME_MANAGER } from "@stackra/contracts";
import type { RealtimeManager } from "@/services/realtime-manager.service";
import { Logger } from "@stackra/ts-logger";

/**
 * HTTP middleware that injects the realtime socket ID as `X-Socket-Id`
 * on every outgoing request.
 *
 * Auto-registered by the `@stackra/ts-http` middleware pipeline through
 * the `@HttpMiddleware` decorator — no manual registration is required.
 *
 * Priority `25` runs after auth (typically `10`) and locale (`15`), so
 * authentication and locale data are already on the request when this
 * middleware injects the socket ID.
 */
@HttpMiddleware({ priority: 25, name: "realtime:socket-id" })
export class SocketIdMiddleware implements HttpMiddlewareInterface {
  /**
   * Logger scoped to the middleware.
   */
  private readonly logger = new Logger(SocketIdMiddleware.name);

  /**
   * @param realtime - The realtime manager. Required — the middleware
   *   only ships when `RealtimeModule.forRoot()` is in the graph.
   */
  public constructor(@Inject(REALTIME_MANAGER) private readonly realtime: RealtimeManager) {}

  /**
   * Inject the `X-Socket-Id` header from the active realtime connection.
   *
   * Failures here are logged and swallowed — the http request must
   * never break because realtime isn't ready yet.
   *
   * @param context - The HTTP context flowing through the pipeline.
   * @param next - The next middleware in the chain.
   * @returns The HTTP response from downstream.
   */
  public async handle(context: HttpContext, next: HttpNextFunction): Promise<HttpResponse> {
    try {
      const conn = await this.realtime.connection();
      const socketId = conn.socketId();
      if (socketId) {
        context.request.headers = {
          ...context.request.headers,
          "X-Socket-Id": socketId,
        };
      }
    } catch (err: Error | unknown) {
      this.logger.debug("Skipping X-Socket-Id header: realtime not ready", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return next(context);
  }
}
