/**
 * @fileoverview Tests for SocketIdMiddleware
 *
 * This test suite verifies the SocketIdMiddleware which injects the
 * X-Socket-Id header into outgoing HTTP requests. Tests cover:
 *
 * - Adding X-Socket-Id header when connection is active
 * - Skipping header when socket ID is undefined
 * - Skipping header when connection resolution fails
 * - Preserving existing headers
 * - Calling next() in all cases
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SocketIdMiddleware } from "@/middleware/socket-id.middleware";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@stackra/ts-logger", () => ({
  Logger: class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    constructor(public context: string) {}
  },
}));

vi.mock("@stackra/ts-container", () => ({
  Inject: () => () => {},
  Injectable: () => (target: any) => target,
}));

vi.mock("@stackra/ts-http", () => ({
  HttpMiddleware: () => (target: any) => target,
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRealtimeManager(socketId?: string, shouldThrow = false) {
  return {
    connection: vi.fn(async () => {
      if (shouldThrow) throw new Error("Connection not ready");
      return {
        socketId: () => socketId,
      };
    }),
  };
}

function createMockContext(headers: Record<string, string> = {}) {
  return {
    request: {
      headers: { ...headers },
      url: "https://api.example.com/data",
      method: "GET",
    },
  };
}

function createMockNext() {
  return vi.fn(async (context: any) => ({
    status: 200,
    data: {},
    headers: {},
  }));
}

// ============================================================================
// Test Suite
// ============================================================================

describe("SocketIdMiddleware", () => {
  describe("handle()", () => {
    it("should add X-Socket-Id header when socket ID is available", async () => {
      const manager = createMockRealtimeManager("socket-123.456");
      const middleware = new SocketIdMiddleware(manager as any);
      const context = createMockContext();
      const next = createMockNext();

      await middleware.handle(context as any, next);

      expect(context.request.headers["X-Socket-Id"]).toBe("socket-123.456");
      expect(next).toHaveBeenCalledWith(context);
    });

    it("should not add header when socket ID is undefined", async () => {
      const manager = createMockRealtimeManager(undefined);
      const middleware = new SocketIdMiddleware(manager as any);
      const context = createMockContext();
      const next = createMockNext();

      await middleware.handle(context as any, next);

      expect(context.request.headers["X-Socket-Id"]).toBeUndefined();
      expect(next).toHaveBeenCalledWith(context);
    });

    it("should preserve existing headers", async () => {
      const manager = createMockRealtimeManager("socket-789");
      const middleware = new SocketIdMiddleware(manager as any);
      const context = createMockContext({
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      });
      const next = createMockNext();

      await middleware.handle(context as any, next);

      expect(context.request.headers["Authorization"]).toBe("Bearer token");
      expect(context.request.headers["Content-Type"]).toBe("application/json");
      expect(context.request.headers["X-Socket-Id"]).toBe("socket-789");
    });

    it("should not throw when connection resolution fails", async () => {
      const manager = createMockRealtimeManager(undefined, true);
      const middleware = new SocketIdMiddleware(manager as any);
      const context = createMockContext();
      const next = createMockNext();

      await expect(middleware.handle(context as any, next)).resolves.toBeDefined();
      expect(next).toHaveBeenCalledWith(context);
    });

    it("should still call next() when an error occurs", async () => {
      const manager = createMockRealtimeManager(undefined, true);
      const middleware = new SocketIdMiddleware(manager as any);
      const context = createMockContext();
      const next = createMockNext();

      await middleware.handle(context as any, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should return the response from next()", async () => {
      const manager = createMockRealtimeManager("socket-abc");
      const middleware = new SocketIdMiddleware(manager as any);
      const context = createMockContext();
      const expectedResponse = { status: 200, data: { success: true }, headers: {} };
      const next = vi.fn(async () => expectedResponse);

      const result = await middleware.handle(context as any, next);

      expect(result).toBe(expectedResponse);
    });
  });
});
