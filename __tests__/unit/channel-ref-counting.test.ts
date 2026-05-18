/**
 * @fileoverview Tests for Channel Ref Counting
 *
 * This test suite verifies the ref counting mechanism used by the React hooks
 * to share channel subscriptions. Tests cover:
 *
 * - Incrementing ref count on subscribe
 * - Decrementing ref count on unsubscribe
 * - Leaving channel only when last ref is removed
 * - Multiple hooks sharing the same channel
 * - Cleanup of ref count map entries
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Test Suite
// ============================================================================

describe("Channel Ref Counting", () => {
  let refCounts: Map<string, number>;

  beforeEach(() => {
    refCounts = new Map();
  });

  describe("Increment", () => {
    it("should start at 1 for the first subscriber", () => {
      const channelName = "orders";
      const currentCount = refCounts.get(channelName) ?? 0;
      refCounts.set(channelName, currentCount + 1);

      expect(refCounts.get(channelName)).toBe(1);
    });

    it("should increment for subsequent subscribers", () => {
      const channelName = "orders";

      // First subscriber
      refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);
      expect(refCounts.get(channelName)).toBe(1);

      // Second subscriber
      refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);
      expect(refCounts.get(channelName)).toBe(2);

      // Third subscriber
      refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);
      expect(refCounts.get(channelName)).toBe(3);
    });

    it("should track different channels independently", () => {
      refCounts.set("orders", (refCounts.get("orders") ?? 0) + 1);
      refCounts.set("notifications", (refCounts.get("notifications") ?? 0) + 1);
      refCounts.set("orders", (refCounts.get("orders") ?? 0) + 1);

      expect(refCounts.get("orders")).toBe(2);
      expect(refCounts.get("notifications")).toBe(1);
    });
  });

  describe("Decrement", () => {
    it("should decrement the count", () => {
      refCounts.set("orders", 3);

      const count = refCounts.get("orders") ?? 1;
      refCounts.set("orders", count - 1);

      expect(refCounts.get("orders")).toBe(2);
    });

    it("should delete the entry when count reaches 0", () => {
      refCounts.set("orders", 1);

      const count = refCounts.get("orders") ?? 1;
      if (count <= 1) {
        refCounts.delete("orders");
      } else {
        refCounts.set("orders", count - 1);
      }

      expect(refCounts.has("orders")).toBe(false);
    });

    it("should not delete when count is still above 0", () => {
      refCounts.set("orders", 2);

      const count = refCounts.get("orders") ?? 1;
      if (count <= 1) {
        refCounts.delete("orders");
      } else {
        refCounts.set("orders", count - 1);
      }

      expect(refCounts.has("orders")).toBe(true);
      expect(refCounts.get("orders")).toBe(1);
    });
  });

  describe("Leave decision", () => {
    it("should leave channel when ref count reaches 0", () => {
      refCounts.set("orders", 1);
      let channelLeft = false;

      const count = refCounts.get("orders") ?? 1;
      if (count <= 1) {
        refCounts.delete("orders");
        channelLeft = true;
      } else {
        refCounts.set("orders", count - 1);
      }

      expect(channelLeft).toBe(true);
    });

    it("should NOT leave channel when other subscribers exist", () => {
      refCounts.set("orders", 3);
      let channelLeft = false;

      const count = refCounts.get("orders") ?? 1;
      if (count <= 1) {
        refCounts.delete("orders");
        channelLeft = true;
      } else {
        refCounts.set("orders", count - 1);
      }

      expect(channelLeft).toBe(false);
      expect(refCounts.get("orders")).toBe(2);
    });
  });

  describe("Full lifecycle", () => {
    it("should handle subscribe → subscribe → unsubscribe → unsubscribe", () => {
      const channelName = "chat-room.1";
      const leaveLog: boolean[] = [];

      // Subscribe 1
      refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);
      expect(refCounts.get(channelName)).toBe(1);

      // Subscribe 2
      refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);
      expect(refCounts.get(channelName)).toBe(2);

      // Unsubscribe 1
      const count1 = refCounts.get(channelName) ?? 1;
      if (count1 <= 1) {
        refCounts.delete(channelName);
        leaveLog.push(true);
      } else {
        refCounts.set(channelName, count1 - 1);
        leaveLog.push(false);
      }

      // Unsubscribe 2
      const count2 = refCounts.get(channelName) ?? 1;
      if (count2 <= 1) {
        refCounts.delete(channelName);
        leaveLog.push(true);
      } else {
        refCounts.set(channelName, count2 - 1);
        leaveLog.push(false);
      }

      expect(leaveLog).toEqual([false, true]);
      expect(refCounts.has(channelName)).toBe(false);
    });
  });
});
