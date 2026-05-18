/**
 * @fileoverview Tests for RealtimeEventsBridgeListener
 *
 * This test suite verifies the RealtimeEventsBridgeListener which bridges
 * WebSocket events into the @stackra/ts-events bus. Tests cover:
 *
 * - Wiring the dispatch function when event manager is available
 * - No-op behavior when event manager is not available
 * - Event dispatch through the bridge
 * - Error handling during event dispatch
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RealtimeEventsBridgeListener } from "@/listeners/realtime-events-bridge.listener";

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
  Injectable: () => (target: any) => target,
  Inject: () => () => {},
  Optional: () => () => {},
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockConnector() {
  return {
    setDispatchFn: vi.fn(),
  };
}

function createMockEventManager(shouldThrow = false) {
  const emitFn = shouldThrow
    ? vi.fn(() => {
        throw new Error("Emit failed");
      })
    : vi.fn(() => true);

  return {
    connection: vi.fn(() => ({
      emit: emitFn,
    })),
    _emitFn: emitFn,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("RealtimeEventsBridgeListener", () => {
  let connector: ReturnType<typeof createMockConnector>;

  beforeEach(() => {
    connector = createMockConnector();
  });

  describe("onApplicationBootstrap()", () => {
    it("should wire the dispatch function when event manager is available", () => {
      const eventManager = createMockEventManager();
      const listener = new RealtimeEventsBridgeListener(connector as any, eventManager as any);

      listener.onApplicationBootstrap();

      expect(connector.setDispatchFn).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should not wire dispatch function when event manager is not available", () => {
      const listener = new RealtimeEventsBridgeListener(connector as any, undefined);

      listener.onApplicationBootstrap();

      expect(connector.setDispatchFn).not.toHaveBeenCalled();
    });

    it("should dispatch events through the event manager", () => {
      const eventManager = createMockEventManager();
      const listener = new RealtimeEventsBridgeListener(connector as any, eventManager as any);

      listener.onApplicationBootstrap();

      // Get the dispatch function that was passed to the connector
      const dispatchFn = connector.setDispatchFn.mock.calls[0][0];

      // Call it with an event
      dispatchFn("realtime:orders.order.created", { id: 1 });

      expect(eventManager.connection).toHaveBeenCalled();
      expect(eventManager._emitFn).toHaveBeenCalledWith("realtime:orders.order.created", { id: 1 });
    });

    it("should swallow errors during event dispatch", () => {
      const eventManager = createMockEventManager(true);
      const listener = new RealtimeEventsBridgeListener(connector as any, eventManager as any);

      listener.onApplicationBootstrap();

      const dispatchFn = connector.setDispatchFn.mock.calls[0][0];

      // Should not throw
      expect(() => dispatchFn("realtime:test.event", {})).not.toThrow();
    });
  });
});
