/**
 * @fileoverview Tests for Message Serialization/Deserialization
 *
 * This test suite verifies the message format used by the Redis connection
 * for event storage and retrieval. Tests cover:
 *
 * - Event payload serialization format
 * - Event payload deserialization
 * - Handling of various data types
 * - Timestamp and index fields
 * - Malformed message handling
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Serializes an event payload in the format used by RedisConnection.
 */
function serializeEvent(channel: string, event: string, data: any): string {
  const score = Date.now();
  const payload = {
    channel,
    event,
    data,
    timestamp: score,
    _idx: score,
  };
  return JSON.stringify(payload);
}

/**
 * Deserializes an event payload from Redis.
 */
function deserializeEvent(raw: string): {
  channel: string;
  event: string;
  data: any;
  timestamp: number;
  _idx: number;
} | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Message Serialization", () => {
  describe("serializeEvent()", () => {
    it("should produce valid JSON", () => {
      const serialized = serializeEvent("orders", ".order.created", { id: 1 });
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it("should include channel name", () => {
      const serialized = serializeEvent("orders", ".order.created", { id: 1 });
      const parsed = JSON.parse(serialized);
      expect(parsed.channel).toBe("orders");
    });

    it("should include event name", () => {
      const serialized = serializeEvent("orders", ".order.created", { id: 1 });
      const parsed = JSON.parse(serialized);
      expect(parsed.event).toBe(".order.created");
    });

    it("should include event data", () => {
      const data = { id: 1, status: "pending", items: [1, 2, 3] };
      const serialized = serializeEvent("orders", ".order.created", data);
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toEqual(data);
    });

    it("should include timestamp", () => {
      const before = Date.now();
      const serialized = serializeEvent("orders", ".event", {});
      const after = Date.now();
      const parsed = JSON.parse(serialized);

      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp).toBeLessThanOrEqual(after);
    });

    it("should include _idx field matching timestamp", () => {
      const serialized = serializeEvent("orders", ".event", {});
      const parsed = JSON.parse(serialized);
      expect(parsed._idx).toBe(parsed.timestamp);
    });

    it("should handle null data", () => {
      const serialized = serializeEvent("orders", ".event", null);
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toBeNull();
    });

    it("should handle nested objects", () => {
      const data = {
        user: { id: 1, profile: { name: "Alice", avatar: "url" } },
        metadata: { source: "api" },
      };
      const serialized = serializeEvent("orders", ".event", data);
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toEqual(data);
    });

    it("should handle arrays", () => {
      const data = [1, 2, 3, "four", { five: 5 }];
      const serialized = serializeEvent("orders", ".event", data);
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toEqual(data);
    });

    it("should handle empty string data", () => {
      const serialized = serializeEvent("orders", ".event", "");
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toBe("");
    });

    it("should handle boolean data", () => {
      const serialized = serializeEvent("orders", ".event", true);
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toBe(true);
    });

    it("should handle numeric data", () => {
      const serialized = serializeEvent("orders", ".event", 42.5);
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toBe(42.5);
    });
  });

  describe("deserializeEvent()", () => {
    it("should parse valid JSON event", () => {
      const raw = JSON.stringify({
        channel: "orders",
        event: ".order.created",
        data: { id: 1 },
        timestamp: 1234567890,
        _idx: 1234567890,
      });

      const result = deserializeEvent(raw);
      expect(result).not.toBeNull();
      expect(result!.channel).toBe("orders");
      expect(result!.event).toBe(".order.created");
      expect(result!.data).toEqual({ id: 1 });
    });

    it("should return null for invalid JSON", () => {
      const result = deserializeEvent("not-valid-json");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = deserializeEvent("");
      expect(result).toBeNull();
    });

    it("should handle truncated JSON", () => {
      const result = deserializeEvent('{"channel":"orders","event":');
      expect(result).toBeNull();
    });

    it("should parse events with special characters in data", () => {
      const raw = JSON.stringify({
        channel: "chat",
        event: ".message.sent",
        data: { text: 'Hello "world" & <friends>' },
        timestamp: 1234567890,
        _idx: 1234567890,
      });

      const result = deserializeEvent(raw);
      expect(result!.data.text).toBe('Hello "world" & <friends>');
    });

    it("should parse events with unicode data", () => {
      const raw = JSON.stringify({
        channel: "chat",
        event: ".message.sent",
        data: { text: "Hello 🌍 世界" },
        timestamp: 1234567890,
        _idx: 1234567890,
      });

      const result = deserializeEvent(raw);
      expect(result!.data.text).toBe("Hello 🌍 世界");
    });
  });

  describe("Round-trip serialization", () => {
    it("should preserve data through serialize → deserialize", () => {
      const originalData = {
        id: 42,
        name: "Test Order",
        items: [{ sku: "ABC", qty: 2 }],
        metadata: { source: "api", version: 3 },
      };

      const serialized = serializeEvent("orders", ".order.created", originalData);
      const deserialized = deserializeEvent(serialized);

      expect(deserialized!.data).toEqual(originalData);
      expect(deserialized!.channel).toBe("orders");
      expect(deserialized!.event).toBe(".order.created");
    });

    it("should handle large payloads", () => {
      const largeData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: "A".repeat(100),
        })),
      };

      const serialized = serializeEvent("bulk", ".batch.processed", largeData);
      const deserialized = deserializeEvent(serialized);

      expect(deserialized!.data.items).toHaveLength(100);
      expect(deserialized!.data.items[99].id).toBe(99);
    });
  });
});
