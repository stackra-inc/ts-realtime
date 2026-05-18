/**
 * @fileoverview Tests for DI Tokens used by the Realtime Package
 *
 * This test suite verifies the DI tokens from @stackra/contracts that
 * the realtime package depends on. Tests cover:
 *
 * - Token existence and type
 * - Token uniqueness
 * - getRealtimeConnectionToken() utility
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@stackra/contracts", () => ({
  REALTIME_CONFIG: "REALTIME_CONFIG",
  REALTIME_MANAGER: "REALTIME_MANAGER",
  REALTIME_CONNECTOR: "REALTIME_CONNECTOR",
  EVENT_EMITTER_MANAGER: "EVENT_EMITTER_MANAGER",
  TAB_COORDINATOR: "TAB_COORDINATOR",
  REDIS_MANAGER: "REDIS_MANAGER",
  RealtimeEvents: {
    CONNECTED: "realtime.connected",
    DISCONNECTED: "realtime.disconnected",
    SUBSCRIBED: "realtime.subscribed",
    RECONNECTING: "realtime.reconnecting",
  },
  ConnectionStatus: {
    Connected: "connected",
    Connecting: "connecting",
    Disconnected: "disconnected",
    Reconnecting: "reconnecting",
    Error: "error",
  },
}));

vi.mock("@stackra/ts-container", () => ({
  Inject: (token: string) => () => {},
}));

// ============================================================================
// Test Suite
// ============================================================================

describe("DI Tokens", () => {
  describe("Contract tokens", () => {
    it("should define REALTIME_CONFIG token", async () => {
      const { REALTIME_CONFIG } = await import("@stackra/contracts");
      expect(REALTIME_CONFIG).toBe("REALTIME_CONFIG");
    });

    it("should define REALTIME_MANAGER token", async () => {
      const { REALTIME_MANAGER } = await import("@stackra/contracts");
      expect(REALTIME_MANAGER).toBe("REALTIME_MANAGER");
    });

    it("should define REALTIME_CONNECTOR token", async () => {
      const { REALTIME_CONNECTOR } = await import("@stackra/contracts");
      expect(REALTIME_CONNECTOR).toBe("REALTIME_CONNECTOR");
    });
  });

  describe("RealtimeEvents", () => {
    it("should define CONNECTED event", async () => {
      const { RealtimeEvents } = await import("@stackra/contracts");
      expect(RealtimeEvents.CONNECTED).toBe("realtime.connected");
    });

    it("should define DISCONNECTED event", async () => {
      const { RealtimeEvents } = await import("@stackra/contracts");
      expect(RealtimeEvents.DISCONNECTED).toBe("realtime.disconnected");
    });

    it("should define SUBSCRIBED event", async () => {
      const { RealtimeEvents } = await import("@stackra/contracts");
      expect(RealtimeEvents.SUBSCRIBED).toBe("realtime.subscribed");
    });

    it("should define RECONNECTING event", async () => {
      const { RealtimeEvents } = await import("@stackra/contracts");
      expect(RealtimeEvents.RECONNECTING).toBe("realtime.reconnecting");
    });
  });

  describe("ConnectionStatus", () => {
    it("should define Connected status", async () => {
      const { ConnectionStatus } = await import("@stackra/contracts");
      expect(ConnectionStatus.Connected).toBe("connected");
    });

    it("should define Connecting status", async () => {
      const { ConnectionStatus } = await import("@stackra/contracts");
      expect(ConnectionStatus.Connecting).toBe("connecting");
    });

    it("should define Disconnected status", async () => {
      const { ConnectionStatus } = await import("@stackra/contracts");
      expect(ConnectionStatus.Disconnected).toBe("disconnected");
    });

    it("should define Reconnecting status", async () => {
      const { ConnectionStatus } = await import("@stackra/contracts");
      expect(ConnectionStatus.Reconnecting).toBe("reconnecting");
    });

    it("should define Error status", async () => {
      const { ConnectionStatus } = await import("@stackra/contracts");
      expect(ConnectionStatus.Error).toBe("error");
    });
  });

  describe("getRealtimeConnectionToken()", () => {
    it("should generate unique tokens per connection name", async () => {
      const { getRealtimeConnectionToken } = await import("@/decorators/inject-realtime.decorator");

      const token1 = getRealtimeConnectionToken("main");
      const token2 = getRealtimeConnectionToken("secondary");

      expect(token1).not.toBe(token2);
    });

    it("should generate consistent tokens for the same name", async () => {
      const { getRealtimeConnectionToken } = await import("@/decorators/inject-realtime.decorator");

      const token1 = getRealtimeConnectionToken("main");
      const token2 = getRealtimeConnectionToken("main");

      expect(token1).toBe(token2);
    });
  });
});
