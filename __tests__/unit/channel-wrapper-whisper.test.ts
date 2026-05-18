/**
 * @fileoverview Tests for ChannelWrapper whisper and listenForWhisper
 *
 * This test suite provides additional coverage for the client event
 * (whisper) functionality of ChannelWrapper. Tests cover:
 *
 * - Sending whisper events with various data shapes
 * - Listening for whisper events
 * - Error cases (left channel, public channel)
 * - Typing indicator pattern
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChannelWrapper } from "@/services/channel-wrapper.service";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEchoChannel(supportsWhisper = true) {
  const channel: any = {
    listen: vi.fn().mockReturnThis(),
    listenToAll: vi.fn().mockReturnThis(),
    stopListening: vi.fn().mockReturnThis(),
    listenForWhisper: vi.fn().mockReturnThis(),
    notification: vi.fn().mockReturnThis(),
    error: vi.fn(),
  };

  if (supportsWhisper) {
    channel.whisper = vi.fn().mockReturnThis();
  }

  return channel;
}

// ============================================================================
// Test Suite
// ============================================================================

describe("ChannelWrapper — Whisper (Client Events)", () => {
  let echoChannel: ReturnType<typeof createMockEchoChannel>;
  let wrapper: ChannelWrapper;

  beforeEach(() => {
    echoChannel = createMockEchoChannel();
    wrapper = new ChannelWrapper(echoChannel, "private:chat.1", vi.fn());
  });

  describe("whisper()", () => {
    it("should send a typing indicator", () => {
      wrapper.whisper("typing", { user: "Alice", typing: true });

      expect(echoChannel.whisper).toHaveBeenCalledWith("typing", {
        user: "Alice",
        typing: true,
      });
    });

    it("should send arbitrary data", () => {
      const data = { cursor: { x: 100, y: 200 }, userId: 42 };
      wrapper.whisper("cursor-move", data);

      expect(echoChannel.whisper).toHaveBeenCalledWith("cursor-move", data);
    });

    it("should return this for method chaining", () => {
      const result = wrapper.whisper("event", { data: true });
      expect(result).toBe(wrapper);
    });

    it("should throw RealtimeChannelError when channel is left", () => {
      wrapper.leave();

      expect(() => wrapper.whisper("typing", {})).toThrow(/has been left/);
    });

    it("should throw RealtimeChannelError on public channels", () => {
      const publicChannel = createMockEchoChannel(false);
      const publicWrapper = new ChannelWrapper(publicChannel, "public-channel", vi.fn());

      expect(() => publicWrapper.whisper("event", {})).toThrow(
        /only supported on private and presence/,
      );
    });

    it("should handle empty data object", () => {
      wrapper.whisper("ping", {});
      expect(echoChannel.whisper).toHaveBeenCalledWith("ping", {});
    });

    it("should handle complex nested data", () => {
      const data = {
        action: "draw",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 20 },
        ],
        color: "#ff0000",
        thickness: 2,
      };

      wrapper.whisper("canvas-draw", data);
      expect(echoChannel.whisper).toHaveBeenCalledWith("canvas-draw", data);
    });
  });

  describe("listenForWhisper()", () => {
    it("should register a whisper listener", () => {
      const callback = vi.fn();
      wrapper.listenForWhisper("typing", callback);

      expect(echoChannel.listenForWhisper).toHaveBeenCalledWith("typing", callback);
    });

    it("should return this for method chaining", () => {
      const result = wrapper.listenForWhisper("event", vi.fn());
      expect(result).toBe(wrapper);
    });

    it("should throw when channel is left", () => {
      wrapper.leave();

      expect(() => wrapper.listenForWhisper("typing", vi.fn())).toThrow(/has been left/);
    });

    it("should support typed callbacks", () => {
      interface TypingEvent {
        user: string;
        typing: boolean;
      }

      const callback = vi.fn<[TypingEvent], void>();
      wrapper.listenForWhisper<TypingEvent>("typing", callback);

      expect(echoChannel.listenForWhisper).toHaveBeenCalledWith("typing", callback);
    });
  });

  describe("Typing indicator pattern", () => {
    it("should support the full typing indicator workflow", () => {
      // Send typing start
      wrapper.whisper("typing", { user: "Alice", typing: true });
      expect(echoChannel.whisper).toHaveBeenCalledWith("typing", {
        user: "Alice",
        typing: true,
      });

      // Listen for typing from others
      const onTyping = vi.fn();
      wrapper.listenForWhisper("typing", onTyping);
      expect(echoChannel.listenForWhisper).toHaveBeenCalledWith("typing", onTyping);

      // Send typing stop
      wrapper.whisper("typing", { user: "Alice", typing: false });
      expect(echoChannel.whisper).toHaveBeenCalledWith("typing", {
        user: "Alice",
        typing: false,
      });
    });
  });
});
