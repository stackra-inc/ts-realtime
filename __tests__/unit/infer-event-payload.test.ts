/**
 * @fileoverview Tests for InferEventPayload type utility
 *
 * This test suite verifies the InferEventPayload type at runtime by
 * testing the type inference behavior through the ChannelWrapper's
 * listen() method. Tests cover:
 *
 * - Default payload type (unknown) for unregistered events
 * - Explicit type parameter override
 * - Type safety with generic event names
 *
 * Note: These are runtime behavior tests. Full type-level testing
 * would require tsd or expect-type.
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, vi } from "vitest";
import { ChannelWrapper } from "@/services/channel-wrapper.service";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEchoChannel() {
  return {
    listen: vi.fn().mockReturnThis(),
    listenToAll: vi.fn().mockReturnThis(),
    stopListening: vi.fn().mockReturnThis(),
    whisper: vi.fn().mockReturnThis(),
    listenForWhisper: vi.fn().mockReturnThis(),
    notification: vi.fn().mockReturnThis(),
    error: vi.fn(),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("InferEventPayload — Runtime Behavior", () => {
  it("should accept any callback shape for untyped events", () => {
    const echoChannel = createMockEchoChannel();
    const wrapper = new ChannelWrapper(echoChannel, "test", vi.fn());

    // Should not throw — callback receives unknown by default
    expect(() => {
      wrapper.listen(".some.event", (data) => {
        // data is unknown at type level
      });
    }).not.toThrow();
  });

  it("should accept explicit type parameter", () => {
    const echoChannel = createMockEchoChannel();
    const wrapper = new ChannelWrapper(echoChannel, "test", vi.fn());

    interface OrderEvent {
      id: number;
      status: string;
    }

    // Should not throw — explicit type parameter
    expect(() => {
      wrapper.listen<string, OrderEvent>(".order.created", (data) => {
        // data is OrderEvent at type level
      });
    }).not.toThrow();
  });

  it("should pass the callback to the underlying Echo channel", () => {
    const echoChannel = createMockEchoChannel();
    const wrapper = new ChannelWrapper(echoChannel, "test", vi.fn());

    const callback = vi.fn();
    wrapper.listen(".event", callback);

    expect(echoChannel.listen).toHaveBeenCalledWith(".event", callback);
  });

  it("should support event names with dots", () => {
    const echoChannel = createMockEchoChannel();
    const wrapper = new ChannelWrapper(echoChannel, "test", vi.fn());

    wrapper.listen(".App\\Events\\OrderCreated", vi.fn());

    expect(echoChannel.listen).toHaveBeenCalledWith(
      ".App\\Events\\OrderCreated",
      expect.any(Function),
    );
  });

  it("should support event names without leading dot", () => {
    const echoChannel = createMockEchoChannel();
    const wrapper = new ChannelWrapper(echoChannel, "test", vi.fn());

    wrapper.listen("OrderCreated", vi.fn());

    expect(echoChannel.listen).toHaveBeenCalledWith("OrderCreated", expect.any(Function));
  });
});
