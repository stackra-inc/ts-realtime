/**
 * @fileoverview Tests for ChannelWrapper notification() method
 *
 * This test suite verifies the notification() method on ChannelWrapper
 * which listens for Laravel notification broadcasts. Tests cover:
 *
 * - Delegating to Echo channel's notification method
 * - Throwing when channel has been left
 * - Throwing when channel does not support notifications
 * - Method chaining
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChannelWrapper } from "@/services/channel-wrapper.service";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEchoChannel(supportsNotification = true) {
  const channel: any = {
    listen: vi.fn().mockReturnThis(),
    listenToAll: vi.fn().mockReturnThis(),
    stopListening: vi.fn().mockReturnThis(),
    whisper: vi.fn().mockReturnThis(),
    listenForWhisper: vi.fn().mockReturnThis(),
    error: vi.fn(),
  };

  if (supportsNotification) {
    channel.notification = vi.fn().mockReturnThis();
  }

  return channel;
}

// ============================================================================
// Test Suite
// ============================================================================

describe("ChannelWrapper — notification()", () => {
  let echoChannel: ReturnType<typeof createMockEchoChannel>;
  let onLeave: ReturnType<typeof vi.fn>;
  let wrapper: ChannelWrapper;

  beforeEach(() => {
    echoChannel = createMockEchoChannel();
    onLeave = vi.fn();
    wrapper = new ChannelWrapper(echoChannel, "App.Models.User.1", onLeave);
  });

  it("should delegate to the Echo channel notification method", () => {
    const callback = vi.fn();
    wrapper.notification(callback);
    expect(echoChannel.notification).toHaveBeenCalledWith(callback);
  });

  it("should return this for method chaining", () => {
    const result = wrapper.notification(vi.fn());
    expect(result).toBe(wrapper);
  });

  it("should throw if channel has been left", () => {
    wrapper.leave();
    expect(() => wrapper.notification(vi.fn())).toThrow(/has been left/);
  });

  it("should throw if channel does not support notification", () => {
    const noNotificationChannel = createMockEchoChannel(false);
    const publicWrapper = new ChannelWrapper(noNotificationChannel, "public-channel", onLeave);

    expect(() => publicWrapper.notification(vi.fn())).toThrow(/does not support .notification/);
  });
});
