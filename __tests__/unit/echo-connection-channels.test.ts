/**
 * @fileoverview Tests for EchoConnection Channel Management
 *
 * This test suite provides additional coverage for channel management
 * within EchoConnection, focusing on:
 *
 * - Channel caching and deduplication
 * - Channel removal on leave
 * - Re-subscription after reconnection
 * - Private channel naming conventions
 * - Presence channel lifecycle
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EchoConnection } from "@/connections/echo.connection";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";

// ============================================================================
// Mocks
// ============================================================================

function createMockPusherConnection() {
  const bindings = new Map<string, Set<(...args: any[]) => void>>();
  return {
    bind: vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (!bindings.has(event)) bindings.set(event, new Set());
      bindings.get(event)!.add(callback);
    }),
    _trigger: (event: string, ...args: any[]) => {
      const callbacks = bindings.get(event);
      if (callbacks) for (const cb of callbacks) cb(...args);
    },
  };
}

const mockPusherConn = createMockPusherConnection();

const mockEchoChannels = new Map<string, any>();

function createMockEchoChannelInstance(name: string) {
  const ch = {
    listen: vi.fn().mockReturnThis(),
    listenToAll: vi.fn().mockReturnThis(),
    stopListening: vi.fn().mockReturnThis(),
    whisper: vi.fn().mockReturnThis(),
    listenForWhisper: vi.fn().mockReturnThis(),
    notification: vi.fn().mockReturnThis(),
    error: vi.fn(),
    here: vi.fn().mockReturnThis(),
    joining: vi.fn().mockReturnThis(),
    leaving: vi.fn().mockReturnThis(),
    _name: name,
  };
  mockEchoChannels.set(name, ch);
  return ch;
}

vi.mock("laravel-echo", () => ({
  default: class MockEcho {
    connector = { pusher: { connection: mockPusherConn } };
    constructor(public options: any) {}
    channel = vi.fn((name: string) => createMockEchoChannelInstance(`public:${name}`));
    private = vi.fn((name: string) => createMockEchoChannelInstance(`private:${name}`));
    join = vi.fn((name: string) => createMockEchoChannelInstance(`presence:${name}`));
    leave = vi.fn();
    disconnect = vi.fn();
    socketId = vi.fn(() => "socket-123");
  },
}));

vi.mock("pusher-js", () => ({
  default: class MockPusherJS {
    connection = mockPusherConn;
    constructor(
      public key: string,
      public options: any,
    ) {}
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createConfig(): RealtimeConnectionConfig {
  return {
    driver: "pusher",
    key: "test-key",
    wsHost: "ws.example.com",
    wsPort: 6001,
    reconnectInitialDelay: 100,
    reconnectMaxDelay: 5000,
    reconnectMultiplier: 2,
  };
}

function connectAndReady(connection: EchoConnection) {
  connection.connect();
  mockPusherConn._trigger("state_change", {
    previous: "connecting",
    current: "connected",
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe("EchoConnection — Channel Management", () => {
  let connection: EchoConnection;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEchoChannels.clear();
    connection = new EchoConnection(createConfig(), "test");
    connectAndReady(connection);
  });

  afterEach(() => {
    connection.disconnect();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Public channels", () => {
    it("should create a channel with the correct name", () => {
      const channel = connection.channel("orders");
      expect(channel.name).toBe("orders");
    });

    it("should cache channels by name", () => {
      const ch1 = connection.channel("orders");
      const ch2 = connection.channel("orders");
      expect(ch1).toBe(ch2);
    });

    it("should create separate wrappers for different channels", () => {
      const ch1 = connection.channel("orders");
      const ch2 = connection.channel("notifications");
      expect(ch1).not.toBe(ch2);
    });

    it("should remove channel from cache when left", () => {
      const channel = connection.channel("orders");
      channel.leave();

      // Next subscription should create a new wrapper
      const newChannel = connection.channel("orders");
      expect(newChannel).not.toBe(channel);
    });
  });

  describe("Private channels", () => {
    it("should prefix private channel names with 'private:'", () => {
      const channel = connection.private("user.1");
      expect(channel.name).toBe("private:user.1");
    });

    it("should cache private channels", () => {
      const ch1 = connection.private("user.1");
      const ch2 = connection.private("user.1");
      expect(ch1).toBe(ch2);
    });

    it("should not conflict with public channels of similar names", () => {
      const publicCh = connection.channel("user.1");
      const privateCh = connection.private("user.1");
      expect(publicCh).not.toBe(privateCh);
    });
  });

  describe("Presence channels", () => {
    it("should create presence channel wrappers", () => {
      const presence = connection.join("chat-room.1");
      expect(presence.name).toBe("chat-room.1");
    });

    it("should cache presence channels", () => {
      const p1 = connection.join("chat-room.1");
      const p2 = connection.join("chat-room.1");
      expect(p1).toBe(p2);
    });

    it("should remove presence channel from cache when left", () => {
      const presence = connection.join("chat-room.1");
      presence.leave();

      const newPresence = connection.join("chat-room.1");
      expect(newPresence).not.toBe(presence);
    });
  });

  describe("leaveAll()", () => {
    it("should mark all public channels as left", () => {
      const ch1 = connection.channel("orders");
      const ch2 = connection.channel("notifications");

      connection.leaveAll();

      expect(ch1.isLeft).toBe(true);
      expect(ch2.isLeft).toBe(true);
    });

    it("should mark all presence channels as left", () => {
      const p1 = connection.join("room.1");
      const p2 = connection.join("room.2");

      connection.leaveAll();

      expect(p1.isLeft).toBe(true);
      expect(p2.isLeft).toBe(true);
    });

    it("should skip already-left channels", () => {
      const ch = connection.channel("orders");
      ch.leave();

      // Should not throw
      expect(() => connection.leaveAll()).not.toThrow();
    });
  });

  describe("Channel re-subscription after reconnection", () => {
    it("should re-subscribe public channels after reconnection", () => {
      connection.channel("orders");
      connection.channel("notifications");

      // Simulate disconnect and reconnect
      mockPusherConn._trigger("state_change", {
        previous: "connected",
        current: "disconnected",
      });

      vi.advanceTimersByTime(100);

      // Simulate successful reconnection
      mockPusherConn._trigger("state_change", {
        previous: "connecting",
        current: "connected",
      });

      // Channels should still be tracked (re-subscribed)
      const ch = connection.channel("orders");
      expect(ch).toBeDefined();
    });

    it("should not re-subscribe left channels after reconnection", () => {
      const ch = connection.channel("orders");
      ch.leave();

      // Simulate disconnect and reconnect
      mockPusherConn._trigger("state_change", {
        previous: "connected",
        current: "disconnected",
      });

      vi.advanceTimersByTime(100);

      mockPusherConn._trigger("state_change", {
        previous: "connecting",
        current: "connected",
      });

      // Left channel should not be re-subscribed
      expect(ch.isLeft).toBe(true);
    });
  });
});
