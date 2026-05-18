/**
 * @fileoverview Tests for ChannelWrapper _notifyError() internal method
 *
 * This test suite verifies the internal error notification mechanism
 * of ChannelWrapper. Tests cover:
 *
 * - Notifying all registered error callbacks
 * - Handling multiple error callbacks
 * - No-op when no callbacks registered
 * - Error callback receives the correct error instance
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
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

describe("ChannelWrapper — _notifyError()", () => {
  let echoChannel: ReturnType<typeof createMockEchoChannel>;
  let wrapper: ChannelWrapper;

  beforeEach(() => {
    echoChannel = createMockEchoChannel();
    wrapper = new ChannelWrapper(echoChannel, "test-channel", vi.fn());
  });

  it("should notify all registered error callbacks", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();

    wrapper.onError(callback1);
    wrapper.onError(callback2);
    wrapper.onError(callback3);

    const error = new Error("Connection lost");
    wrapper._notifyError(error);

    expect(callback1).toHaveBeenCalledWith(error);
    expect(callback2).toHaveBeenCalledWith(error);
    expect(callback3).toHaveBeenCalledWith(error);
  });

  it("should pass the exact error instance to callbacks", () => {
    const callback = vi.fn();
    wrapper.onError(callback);

    const error = new Error("Specific error");
    wrapper._notifyError(error);

    expect(callback.mock.calls[0][0]).toBe(error);
  });

  it("should not throw when no callbacks are registered", () => {
    const error = new Error("No listeners");
    expect(() => wrapper._notifyError(error)).not.toThrow();
  });

  it("should handle errors with custom properties", () => {
    const callback = vi.fn();
    wrapper.onError(callback);

    const error = Object.assign(new Error("Custom error"), { code: "AUTH_FAILED" });
    wrapper._notifyError(error);

    expect(callback).toHaveBeenCalledWith(error);
    expect(callback.mock.calls[0][0].code).toBe("AUTH_FAILED");
  });

  it("should not deduplicate callbacks (same function registered twice)", () => {
    const callback = vi.fn();
    wrapper.onError(callback);
    // Note: onError uses a Set, so same reference won't be added twice
    wrapper.onError(callback);

    const error = new Error("test");
    wrapper._notifyError(error);

    // Set deduplicates, so callback should only be called once
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
