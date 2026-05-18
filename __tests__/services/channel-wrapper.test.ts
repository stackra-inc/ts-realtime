/**
 * @fileoverview Tests for ChannelWrapper
 *
 * This test suite verifies the ChannelWrapper service which provides a typed
 * wrapper around Laravel Echo channel subscriptions. Tests cover:
 *
 * - `listen()` — registering typed event listeners
 * - `listenToAll()` — listening to all events
 * - `stopListening()` — removing event listeners
 * - `whisper()` — sending client events
 * - `listenForWhisper()` — receiving client events
 * - `onError()` — error callback registration
 * - `leave()` — unsubscribing from the channel
 * - Error handling — operations after leave() throw
 * - Method chaining — fluent API
 *
 * @module @stackra/ts-realtime
 * @category Tests / Services
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChannelWrapper } from "@/services/channel-wrapper.service";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock Echo channel for testing.
 */
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

describe("ChannelWrapper", () => {
  let echoChannel: ReturnType<typeof createMockEchoChannel>;
  let onLeave: ReturnType<typeof vi.fn>;
  let wrapper: ChannelWrapper;

  beforeEach(() => {
    echoChannel = createMockEchoChannel();
    onLeave = vi.fn();
    wrapper = new ChannelWrapper(echoChannel, "orders", onLeave);
  });

  describe("listen()", () => {
    it("should delegate to the Echo channel listen method", () => {
      const callback = vi.fn();
      wrapper.listen(".order.created", callback);
      expect(echoChannel.listen).toHaveBeenCalledWith(".order.created", callback);
    });

    it("should return this for method chaining", () => {
      const result = wrapper.listen(".event", vi.fn());
      expect(result).toBe(wrapper);
    });

    it("should throw if channel has been left", () => {
      wrapper.leave();
      expect(() => wrapper.listen(".event", vi.fn())).toThrow(/has been left/);
    });
  });

  describe("listenToAll()", () => {
    it("should delegate to the Echo channel listenToAll method", () => {
      const callback = vi.fn();
      wrapper.listenToAll(callback);
      expect(echoChannel.listenToAll).toHaveBeenCalled();
    });

    it("should throw if channel has been left", () => {
      wrapper.leave();
      expect(() => wrapper.listenToAll(vi.fn())).toThrow(/has been left/);
    });
  });

  describe("stopListening()", () => {
    it("should delegate to the Echo channel stopListening method", () => {
      wrapper.stopListening(".order.created");
      expect(echoChannel.stopListening).toHaveBeenCalledWith(".order.created", undefined);
    });

    it("should pass specific callback when provided", () => {
      const callback = vi.fn();
      wrapper.stopListening(".event", callback);
      expect(echoChannel.stopListening).toHaveBeenCalledWith(".event", callback);
    });
  });

  describe("whisper()", () => {
    it("should delegate to the Echo channel whisper method", () => {
      wrapper.whisper("typing", { user: "John" });
      expect(echoChannel.whisper).toHaveBeenCalledWith("typing", { user: "John" });
    });

    it("should throw if channel has been left", () => {
      wrapper.leave();
      expect(() => wrapper.whisper("typing", {})).toThrow(/has been left/);
    });

    it("should throw if channel does not support whisper", () => {
      const noWhisper = { ...echoChannel, whisper: undefined };
      const publicWrapper = new ChannelWrapper(noWhisper, "public", onLeave);
      expect(() => publicWrapper.whisper("event", {})).toThrow(/only supported on private/);
    });
  });

  describe("listenForWhisper()", () => {
    it("should delegate to the Echo channel listenForWhisper method", () => {
      const callback = vi.fn();
      wrapper.listenForWhisper("typing", callback);
      expect(echoChannel.listenForWhisper).toHaveBeenCalledWith("typing", callback);
    });

    it("should throw if channel has been left", () => {
      wrapper.leave();
      expect(() => wrapper.listenForWhisper("event", vi.fn())).toThrow(/has been left/);
    });
  });

  describe("onError()", () => {
    it("should register error callback", () => {
      const callback = vi.fn();
      wrapper.onError(callback);
      expect(echoChannel.error).toHaveBeenCalled();
    });

    it("should return this for method chaining", () => {
      const result = wrapper.onError(vi.fn());
      expect(result).toBe(wrapper);
    });
  });

  describe("leave()", () => {
    it("should call onLeave callback with channel name", () => {
      wrapper.leave();
      expect(onLeave).toHaveBeenCalledWith("orders");
    });

    it("should mark the channel as left", () => {
      expect(wrapper.isLeft).toBe(false);
      wrapper.leave();
      expect(wrapper.isLeft).toBe(true);
    });

    it("should be idempotent (calling twice does not call onLeave twice)", () => {
      wrapper.leave();
      wrapper.leave();
      expect(onLeave).toHaveBeenCalledTimes(1);
    });
  });

  describe("Properties", () => {
    it("should return the channel name", () => {
      expect(wrapper.name).toBe("orders");
    });

    it("should return isLeft status", () => {
      expect(wrapper.isLeft).toBe(false);
      wrapper.leave();
      expect(wrapper.isLeft).toBe(true);
    });
  });
});
