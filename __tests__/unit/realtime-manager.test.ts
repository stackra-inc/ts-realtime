/**
 * @fileoverview Tests for RealtimeManager
 *
 * This test suite verifies the RealtimeManager service which manages
 * multiple named realtime connections. Tests cover:
 *
 * - Connection resolution: default, named, caching
 * - Disconnect: single, all
 * - Configuration: getInstanceConfig, getDefaultInstance, setDefaultInstance
 * - Introspection: getConnectionNames, isConnectionActive, getActiveConnectionNames
 * - Lifecycle hooks: onModuleInit, onModuleDestroy
 * - Event emission: connected, disconnected events
 * - Error handling: missing connections, failed warmup
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RealtimeManager } from "@/services/realtime-manager.service";
import type { RealtimeModuleOptions } from "@/interfaces/realtime-module-options.interface";
import type { RealtimeConnector } from "@/interfaces/realtime-connector.interface";
import type { RealtimeConnection } from "@/interfaces/realtime-connection.interface";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@stackra/ts-support", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stackra/ts-support")>();
  return {
    ...actual,
    MultipleInstanceManager: class MockMultipleInstanceManager<T> {
      private instances = new Map<string, T>();
      private pendingAsync = new Map<string, Promise<T>>();

      protected createDriver(_driver: string, _config: Record<string, any>): T {
        throw new Error("Use async path");
      }

      protected async createDriverAsync(_driver: string, _config: Record<string, any>): Promise<T> {
        throw new Error("Override in subclass");
      }

      public getDefaultInstance(): string {
        return "default";
      }

      public getInstanceConfig(_name: string): Record<string, any> | undefined {
        return undefined;
      }

      public hasInstance(name: string): boolean {
        return this.instances.has(name);
      }

      public instance(name: string): T {
        return this.instances.get(name)!;
      }

      public async instanceAsync(name?: string): Promise<T> {
        const resolvedName = name ?? this.getDefaultInstance();
        if (this.instances.has(resolvedName)) {
          return this.instances.get(resolvedName)!;
        }

        if (this.pendingAsync.has(resolvedName)) {
          return this.pendingAsync.get(resolvedName)!;
        }

        const config = this.getInstanceConfig(resolvedName);
        if (!config) throw new Error(`No config for "${resolvedName}"`);

        const promise = this.createDriverAsync(config.driver ?? resolvedName, config);
        this.pendingAsync.set(resolvedName, promise);

        const instance = await promise;
        this.instances.set(resolvedName, instance);
        this.pendingAsync.delete(resolvedName);
        return instance;
      }

      public forgetInstance(name: string): void {
        this.instances.delete(name);
      }

      public getResolvedInstances(): string[] {
        return [...this.instances.keys()];
      }

      public purge(): void {
        this.instances.clear();
      }
    },
  };
});

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
  Optional: () => () => {},
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockConnection(name: string): RealtimeConnection {
  return {
    getName: () => name,
    getStatus: () => "connected" as any,
    isConnected: () => true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    channel: vi.fn(),
    private: vi.fn(),
    join: vi.fn(),
    onStatusChange: vi.fn(() => () => {}),
    socketId: () => `socket-${name}`,
    leaveAll: vi.fn(),
    reconnectAttempts: 0,
  } as unknown as RealtimeConnection;
}

function createMockConnector(): RealtimeConnector {
  return {
    connect: vi.fn(async (config: any) => createMockConnection(config.driver ?? "default")),
  };
}

function createConfig(overrides: Partial<RealtimeModuleOptions> = {}): RealtimeModuleOptions {
  return {
    default: "main",
    connections: {
      main: {
        driver: "pusher",
        key: "test-key",
        wsHost: "ws.example.com",
        wsPort: 6001,
      },
      secondary: {
        driver: "pusher",
        key: "test-key-2",
        wsHost: "ws2.example.com",
        wsPort: 6002,
      },
    },
    ...overrides,
  };
}

function createManager(
  configOverrides: Partial<RealtimeModuleOptions> = {},
  connector?: RealtimeConnector,
  eventManager?: any,
): RealtimeManager {
  const config = createConfig(configOverrides);
  const conn = connector ?? createMockConnector();
  return new RealtimeManager(config, conn, eventManager);
}

// ============================================================================
// Test Suite
// ============================================================================

describe("RealtimeManager", () => {
  let manager: RealtimeManager;
  let mockConnector: RealtimeConnector;

  beforeEach(() => {
    mockConnector = createMockConnector();
    manager = createManager({}, mockConnector);
  });

  describe("Connection resolution", () => {
    it("should resolve the default connection", async () => {
      const conn = await manager.connection();
      expect(conn).toBeDefined();
      expect(mockConnector.connect).toHaveBeenCalled();
    });

    it("should resolve a named connection", async () => {
      const conn = await manager.connection("secondary");
      expect(conn).toBeDefined();
    });

    it("should cache resolved connections", async () => {
      const conn1 = await manager.connection("main");
      const conn2 = await manager.connection("main");
      expect(conn1).toBe(conn2);
      expect(mockConnector.connect).toHaveBeenCalledTimes(1);
    });

    it("should throw for unconfigured connection names", async () => {
      await expect(manager.connection("nonexistent")).rejects.toThrow();
    });
  });

  describe("Disconnect", () => {
    it("should disconnect a specific connection", async () => {
      const conn = await manager.connection("main");
      await manager.disconnect("main");

      expect(conn.disconnect).toHaveBeenCalled();
      expect(manager.isConnectionActive("main")).toBe(false);
    });

    it("should disconnect the default connection when no name provided", async () => {
      const conn = await manager.connection();
      await manager.disconnect();

      expect(conn.disconnect).toHaveBeenCalled();
    });

    it("should be a no-op for inactive connections", async () => {
      await expect(manager.disconnect("nonexistent")).resolves.toBeUndefined();
    });

    it("should disconnect all connections", async () => {
      const conn1 = await manager.connection("main");
      const conn2 = await manager.connection("secondary");

      await manager.disconnectAll();

      expect(conn1.disconnect).toHaveBeenCalled();
      expect(conn2.disconnect).toHaveBeenCalled();
    });
  });

  describe("Configuration", () => {
    it("should return the default instance name", () => {
      expect(manager.getDefaultInstance()).toBe("main");
    });

    it("should allow setting the default instance name", () => {
      manager.setDefaultInstance("secondary");
      expect(manager.getDefaultInstance()).toBe("secondary");
    });

    it("should return instance config for a valid connection", () => {
      const config = manager.getInstanceConfig("main");
      expect(config).toBeDefined();
      expect(config!.driver).toBe("pusher");
      expect(config!.key).toBe("test-key");
    });

    it("should return undefined for unknown connection names", () => {
      const config = manager.getInstanceConfig("nonexistent");
      expect(config).toBeUndefined();
    });
  });

  describe("Introspection", () => {
    it("should return all configured connection names", () => {
      const names = manager.getConnectionNames();
      expect(names).toContain("main");
      expect(names).toContain("secondary");
    });

    it("should return the default connection name", () => {
      expect(manager.getDefaultConnectionName()).toBe("main");
    });

    it("should report inactive connections correctly", () => {
      expect(manager.isConnectionActive("main")).toBe(false);
    });

    it("should report active connections correctly", async () => {
      await manager.connection("main");
      expect(manager.isConnectionActive("main")).toBe(true);
    });

    it("should return active connection names", async () => {
      await manager.connection("main");
      await manager.connection("secondary");

      const active = manager.getActiveConnectionNames();
      expect(active).toContain("main");
      expect(active).toContain("secondary");
    });
  });

  describe("leaveAll()", () => {
    it("should call leaveAll on the connection", async () => {
      const conn = await manager.connection("main");
      await manager.leaveAll("main");

      expect(conn.leaveAll).toHaveBeenCalled();
    });

    it("should use default connection when no name provided", async () => {
      const conn = await manager.connection();
      await manager.leaveAll();

      expect(conn.leaveAll).toHaveBeenCalled();
    });
  });

  describe("Event emission", () => {
    it("should emit connected event when connection is created", async () => {
      const emitFn = vi.fn();
      const eventManager = {
        connection: () => ({ emit: emitFn }),
      };
      const mgr = createManager({}, mockConnector, eventManager);

      await mgr.connection("main");

      expect(emitFn).toHaveBeenCalled();
    });

    it("should emit disconnected event on disconnect", async () => {
      const emitFn = vi.fn();
      const eventManager = {
        connection: () => ({ emit: emitFn }),
      };
      const mgr = createManager({}, mockConnector, eventManager);

      await mgr.connection("main");
      await mgr.disconnect("main");

      expect(emitFn).toHaveBeenCalledWith(
        expect.stringContaining("disconnected"),
        expect.any(Object),
      );
    });

    it("should not throw when event manager is not available", async () => {
      const mgr = createManager({}, mockConnector, undefined);
      await expect(mgr.connection("main")).resolves.toBeDefined();
    });

    it("should swallow event emission errors", async () => {
      const eventManager = {
        connection: () => ({
          emit: () => {
            throw new Error("Emit failed");
          },
        }),
      };
      const mgr = createManager({}, mockConnector, eventManager);

      // Should not throw
      await expect(mgr.connection("main")).resolves.toBeDefined();
    });
  });

  describe("Lifecycle hooks", () => {
    it("should warm default connection on onModuleInit", async () => {
      await manager.onModuleInit();
      expect(manager.isConnectionActive("main")).toBe(true);
    });

    it("should skip warmup if no connections configured", async () => {
      const emptyManager = createManager({
        default: "nonexistent",
        connections: {},
      });

      await expect(emptyManager.onModuleInit()).resolves.toBeUndefined();
    });

    it("should disconnect all on onModuleDestroy", async () => {
      await manager.connection("main");
      await manager.onModuleDestroy();

      expect(manager.isConnectionActive("main")).toBe(false);
    });
  });

  describe("createDriver (sync)", () => {
    it("should throw when called directly", () => {
      expect(() => (manager as any).createDriver("pusher", {})).toThrow(/async/i);
    });
  });
});
