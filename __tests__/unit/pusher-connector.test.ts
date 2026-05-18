/**
 * @fileoverview Tests for LaravelEchoConnector
 *
 * This test suite verifies the LaravelEchoConnector factory which creates
 * EchoConnection instances from configuration. Tests cover:
 *
 * - Successful connection creation with valid config
 * - No-op connection when key is missing
 * - No-op connection when wsHost is missing
 * - setDispatchFn() for event bridging
 * - No-op connection behavior (methods throw or no-op)
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LaravelEchoConnector } from "@/connectors/pusher.connector";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";

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

vi.mock("@stackra/ts-container", () => ({
  Injectable: () => (target: any) => target,
  Inject: () => () => {},
}));

// Mock EchoConnection to avoid real WebSocket creation
vi.mock("@/connections/echo.connection", () => ({
  EchoConnection: class MockEchoConnection {
    constructor(
      public config: any,
      public name: string,
      public dispatchFn?: any,
    ) {}
    connect = vi.fn();
    disconnect = vi.fn();
    isConnected = () => true;
    getStatus = () => "connected";
    getName = () => this.name;
  },
}));

// ============================================================================
// Test Suite
// ============================================================================

describe("LaravelEchoConnector", () => {
  let connector: LaravelEchoConnector;

  beforeEach(() => {
    connector = new LaravelEchoConnector();
  });

  describe("connect()", () => {
    it("should create an EchoConnection with valid config", async () => {
      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        key: "test-key",
        wsHost: "ws.example.com",
        wsPort: 6001,
      };

      const connection = await connector.connect(config);

      expect(connection).toBeDefined();
      expect(connection.getName()).toBe("pusher");
    });

    it("should call connect() on the created connection", async () => {
      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        key: "test-key",
        wsHost: "ws.example.com",
      };

      const connection = await connector.connect(config);

      expect(connection.connect).toHaveBeenCalled();
    });

    it("should return a no-op connection when key is missing", async () => {
      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        key: "",
        wsHost: "ws.example.com",
      };

      const connection = await connector.connect(config);

      expect(connection.getName()).toBe("no-op");
      expect(connection.isConnected()).toBe(false);
      expect(connection.getStatus()).toBe("disconnected");
    });

    it("should return a no-op connection when key is undefined", async () => {
      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        wsHost: "ws.example.com",
      };

      const connection = await connector.connect(config);

      expect(connection.getName()).toBe("no-op");
    });

    it("should return a no-op connection when wsHost is missing", async () => {
      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        key: "test-key",
        wsHost: "",
      };

      const connection = await connector.connect(config);

      expect(connection.getName()).toBe("no-op");
    });

    it("should return a no-op connection when wsHost is undefined", async () => {
      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        key: "test-key",
      };

      const connection = await connector.connect(config);

      expect(connection.getName()).toBe("no-op");
    });
  });

  describe("No-op connection behavior", () => {
    let noOpConnection: any;

    beforeEach(async () => {
      noOpConnection = await connector.connect({ driver: "pusher" });
    });

    it("should throw on channel()", () => {
      expect(() => noOpConnection.channel("test")).toThrow(/not configured/i);
    });

    it("should throw on private()", () => {
      expect(() => noOpConnection.private("test")).toThrow(/not configured/i);
    });

    it("should throw on join()", () => {
      expect(() => noOpConnection.join("test")).toThrow(/not configured/i);
    });

    it("should not throw on connect()", () => {
      expect(() => noOpConnection.connect()).not.toThrow();
    });

    it("should not throw on disconnect()", () => {
      expect(() => noOpConnection.disconnect()).not.toThrow();
    });

    it("should return undefined for socketId()", () => {
      expect(noOpConnection.socketId()).toBeUndefined();
    });

    it("should not throw on leaveAll()", () => {
      expect(() => noOpConnection.leaveAll()).not.toThrow();
    });

    it("should return an unsubscribe function from onStatusChange()", () => {
      const unsub = noOpConnection.onStatusChange(vi.fn());
      expect(typeof unsub).toBe("function");
    });

    it("should have reconnectAttempts of 0", () => {
      expect(noOpConnection.reconnectAttempts).toBe(0);
    });
  });

  describe("setDispatchFn()", () => {
    it("should store the dispatch function", async () => {
      const dispatchFn = vi.fn();
      connector.setDispatchFn(dispatchFn);

      const config: RealtimeConnectionConfig = {
        driver: "pusher",
        key: "test-key",
        wsHost: "ws.example.com",
      };

      const connection = await connector.connect(config);

      // The dispatch function should be passed to EchoConnection
      expect((connection as any).dispatchFn).toBe(dispatchFn);
    });
  });
});
