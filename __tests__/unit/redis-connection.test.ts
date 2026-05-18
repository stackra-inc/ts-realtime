/**
 * @fileoverview Tests for RedisConnection
 *
 * This test suite verifies the RedisConnection service which implements
 * the RealtimeConnection interface using Redis pub/sub polling. Tests cover:
 *
 * - Connection lifecycle: connect, disconnect, status tracking
 * - Channel subscriptions: public, private, presence
 * - Polling mechanism: start, stop, event delivery
 * - Publishing events to channels
 * - Status change listeners
 * - leaveAll() cleanup
 * - Error handling during polling
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RedisConnection } from "@/connections/redis.connection";
import type { RedisConnectionConfig } from "@/interfaces/redis-connection-config.interface";

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

/**
 * Creates a mock Redis connection (Upstash-style HTTP API).
 */
function createMockRedisConnection() {
  return {
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    publish: vi.fn().mockResolvedValue(1),
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

function createConfig(overrides: Partial<RedisConnectionConfig> = {}): RedisConnectionConfig {
  return {
    driver: "redis",
    redisConnection: createMockRedisConnection() as any,
    pollInterval: 100,
    keyPrefix: "test-realtime:",
    maxEventsPerChannel: 50,
    ...overrides,
  } as RedisConnectionConfig;
}

// ============================================================================
// Test Suite
// ============================================================================

describe("RedisConnection", () => {
  let connection: RedisConnection;
  let config: RedisConnectionConfig;
  let mockRedis: ReturnType<typeof createMockRedisConnection>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRedis = createMockRedisConnection();
    config = createConfig({ redisConnection: mockRedis as any });
    connection = new RedisConnection(config, "redis-main");
  });

  afterEach(() => {
    connection.disconnect();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Connection lifecycle", () => {
    it("should start in Disconnected status", () => {
      expect(connection.getStatus()).toBe("disconnected");
      expect(connection.isConnected()).toBe(false);
    });

    it("should transition to Connected immediately on connect()", () => {
      connection.connect();
      expect(connection.getStatus()).toBe("connected");
      expect(connection.isConnected()).toBe(true);
    });

    it("should not re-connect if already connected", () => {
      const listener = vi.fn();
      connection.connect();
      connection.onStatusChange(listener);

      connection.connect();

      // Should not fire any additional status changes
      expect(listener).not.toHaveBeenCalled();
    });

    it("should transition to Disconnected on disconnect()", () => {
      connection.connect();
      connection.disconnect();

      expect(connection.getStatus()).toBe("disconnected");
      expect(connection.isConnected()).toBe(false);
    });

    it("should return the connection name", () => {
      expect(connection.getName()).toBe("redis-main");
    });

    it("should always return undefined for socketId()", () => {
      connection.connect();
      expect(connection.socketId()).toBeUndefined();
    });

    it("should reset reconnect attempts on connect()", () => {
      connection.connect();
      expect(connection.reconnectAttempts).toBe(0);
    });
  });

  describe("Status change listeners", () => {
    it("should notify listeners on status change", () => {
      const listener = vi.fn();
      connection.onStatusChange(listener);

      connection.connect();

      expect(listener).toHaveBeenCalledWith("connecting");
      expect(listener).toHaveBeenCalledWith("connected");
    });

    it("should return an unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = connection.onStatusChange(listener);

      unsubscribe();
      connection.connect();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      connection.onStatusChange(listener1);
      connection.onStatusChange(listener2);

      connection.connect();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe("Channel subscriptions", () => {
    beforeEach(() => {
      connection.connect();
    });

    it("should create a public channel subscription", () => {
      const channel = connection.channel("orders");
      expect(channel).toBeDefined();
      expect(channel.name).toBe("orders");
    });

    it("should return the same wrapper for duplicate subscriptions", () => {
      const channel1 = connection.channel("orders");
      const channel2 = connection.channel("orders");
      expect(channel1).toBe(channel2);
    });

    it("should create a private channel subscription", () => {
      const channel = connection.private("user.1");
      expect(channel).toBeDefined();
      expect(channel.name).toBe("private:user.1");
    });

    it("should create a presence channel subscription", () => {
      const presence = connection.join("chat-room.1");
      expect(presence).toBeDefined();
      expect(presence.name).toBe("chat-room.1");
    });

    it("should throw when subscribing while disconnected", () => {
      connection.disconnect();
      expect(() => connection.channel("orders")).toThrow(/not connected/i);
    });

    it("should throw when joining presence while disconnected", () => {
      connection.disconnect();
      expect(() => connection.join("chat-room.1")).toThrow(/not connected/i);
    });
  });

  describe("Polling mechanism", () => {
    beforeEach(() => {
      connection.connect();
    });

    it("should start polling when a channel is subscribed", () => {
      connection.channel("orders");

      // Advance past poll interval
      vi.advanceTimersByTime(100);

      expect(mockRedis.zrange).toHaveBeenCalled();
    });

    it("should stop polling when channel is left", () => {
      const channel = connection.channel("orders");
      channel.leave();

      mockRedis.zrange.mockClear();
      vi.advanceTimersByTime(200);

      expect(mockRedis.zrange).not.toHaveBeenCalled();
    });

    it("should deliver events to channel listeners", async () => {
      const channel = connection.channel("orders");
      const callback = vi.fn();

      // Access the mock echo channel's listen
      (channel as any).echoChannel.listen(".order.created", callback);

      // Simulate Redis returning an event
      const event = JSON.stringify({
        channel: "orders",
        event: ".order.created",
        data: { id: 1, status: "pending" },
        timestamp: Date.now() + 1,
        _idx: Date.now() + 1,
      });
      mockRedis.zrange.mockResolvedValueOnce([event]);

      // Advance past poll interval
      await vi.advanceTimersByTimeAsync(100);

      expect(callback).toHaveBeenCalledWith({ id: 1, status: "pending" });
    });

    it("should handle malformed events gracefully", async () => {
      connection.channel("orders");

      mockRedis.zrange.mockResolvedValueOnce(["not-valid-json"]);

      // Should not throw
      await vi.advanceTimersByTimeAsync(100);
    });

    it("should handle polling errors gracefully", async () => {
      connection.channel("orders");

      mockRedis.zrange.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      await vi.advanceTimersByTimeAsync(100);
    });
  });

  describe("Publishing", () => {
    beforeEach(() => {
      connection.connect();
    });

    it("should publish events to Redis sorted set", async () => {
      await connection.publish("orders", ".order.created", { id: 1 });

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "test-realtime:orders",
        expect.any(Number),
        expect.any(String),
      );
    });

    it("should also publish via Redis pub/sub", async () => {
      await connection.publish("orders", ".order.created", { id: 1 });

      expect(mockRedis.publish).toHaveBeenCalledWith("orders", expect.any(String));
    });

    it("should trim old events when exceeding max", async () => {
      // Simulate many existing events
      const manyEvents = Array.from({ length: 60 }, (_, i) => `event-${i}`);
      mockRedis.zrange.mockResolvedValueOnce(manyEvents);

      await connection.publish("orders", ".event", { data: true });

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });
  });

  describe("leaveAll()", () => {
    beforeEach(() => {
      connection.connect();
    });

    it("should stop all polling timers", () => {
      connection.channel("orders");
      connection.channel("notifications");

      connection.leaveAll();

      mockRedis.zrange.mockClear();
      vi.advanceTimersByTime(200);

      expect(mockRedis.zrange).not.toHaveBeenCalled();
    });

    it("should clear all channel registries", () => {
      connection.channel("orders");
      connection.join("chat-room.1");

      connection.leaveAll();

      // New subscriptions should create fresh wrappers
      const newChannel = connection.channel("orders");
      expect(newChannel).toBeDefined();
    });
  });

  describe("disconnect()", () => {
    it("should stop all polling timers on disconnect", () => {
      connection.connect();
      connection.channel("orders");

      connection.disconnect();

      mockRedis.zrange.mockClear();
      vi.advanceTimersByTime(200);

      expect(mockRedis.zrange).not.toHaveBeenCalled();
    });

    it("should clear all channels on disconnect", () => {
      connection.connect();
      connection.channel("orders");
      connection.join("chat-room.1");

      connection.disconnect();

      expect(connection.isConnected()).toBe(false);
    });
  });
});
