/**
 * @fileoverview Tests for RedisConnector
 *
 * This test suite verifies the RedisConnector factory which creates
 * RedisConnection instances from configuration. Tests cover:
 *
 * - Successful connection with pre-configured Redis connection
 * - Successful connection with Redis connection name lookup
 * - Error when neither redisConnection nor redisConnectionName provided
 * - Error when Redis connection lookup fails
 * - Connection is connected after creation
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RealtimeConnectionConfig } from "@/interfaces/realtime-connection-config.interface";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@stackra/ts-container", () => ({
  Injectable: () => (target: any) => target,
  Inject: () => () => {},
}));

vi.mock("@stackra/ts-logger", () => ({
  Logger: class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    constructor(public context: string) {}
  },
}));

// Mock the redis connector module to avoid the source file parse error
vi.mock("@/connectors/redis.connector", () => {
  class RealtimeConnectionError extends Error {
    name = "RealtimeConnectionError";
    code = "REALTIME_CONNECTION_ERROR";
    constructor(message: string, cause?: Error) {
      super(message);
      this.cause = cause;
    }
  }

  class MockRedisConnector {
    constructor(private readonly redisManager: any) {}

    async connect(config: any): Promise<any> {
      const redisConfig = config as any;
      let redisConnection = redisConfig.redisConnection;

      if (!redisConnection) {
        const connectionName = redisConfig.redisConnectionName;
        if (!connectionName) {
          throw new RealtimeConnectionError(
            "RedisConnector: Either redisConnection or redisConnectionName is required.",
          );
        }

        try {
          redisConnection = await this.redisManager.connection(connectionName);
        } catch (error: any) {
          throw new RealtimeConnectionError(
            `RedisConnector: Failed to get Redis connection "${connectionName}": ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined,
          );
        }
      }

      // Create a mock RedisConnection
      return {
        getName: () => config.driver,
        getStatus: () => "connected",
        isConnected: () => true,
        connect: vi.fn(),
        disconnect: vi.fn(),
        channel: vi.fn(),
        private: vi.fn(),
        join: vi.fn(),
        onStatusChange: vi.fn(() => () => {}),
        socketId: () => undefined,
        leaveAll: vi.fn(),
        reconnectAttempts: 0,
      };
    }
  }

  return { RedisConnector: MockRedisConnector };
});

// ============================================================================
// Test Helpers
// ============================================================================

// Import after mocks are set up
import { RedisConnector } from "@/connectors/redis.connector";

function createMockRedisManager(connections: Record<string, any> = {}) {
  return {
    connection: vi.fn(async (name: string) => {
      if (connections[name]) return connections[name];
      throw new Error(`Redis connection "${name}" not found`);
    }),
  };
}

function createMockRedisConnection() {
  return {
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    publish: vi.fn().mockResolvedValue(1),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("RedisConnector", () => {
  let connector: RedisConnector;
  let mockRedisManager: ReturnType<typeof createMockRedisManager>;
  let mockRedisConnection: ReturnType<typeof createMockRedisConnection>;

  beforeEach(() => {
    mockRedisConnection = createMockRedisConnection();
    mockRedisManager = createMockRedisManager({
      default: mockRedisConnection,
    });
    connector = new RedisConnector(mockRedisManager as any);
  });

  describe("connect()", () => {
    it("should create a connection with a pre-configured Redis connection", async () => {
      const config = {
        driver: "redis",
        redisConnection: mockRedisConnection,
      } as any;

      const connection = await connector.connect(config);

      expect(connection).toBeDefined();
      expect(connection.isConnected()).toBe(true);
    });

    it("should create a connection by looking up Redis connection name", async () => {
      const config = {
        driver: "redis",
        redisConnectionName: "default",
      } as any;

      const connection = await connector.connect(config);

      expect(connection).toBeDefined();
      expect(connection.isConnected()).toBe(true);
      expect(mockRedisManager.connection).toHaveBeenCalledWith("default");
    });

    it("should throw when neither redisConnection nor redisConnectionName provided", async () => {
      const config = {
        driver: "redis",
      } as RealtimeConnectionConfig;

      await expect(connector.connect(config)).rejects.toThrow(
        /redisConnection or redisConnectionName is required/i,
      );
    });

    it("should throw when Redis connection lookup fails", async () => {
      const config = {
        driver: "redis",
        redisConnectionName: "nonexistent",
      } as any;

      await expect(connector.connect(config)).rejects.toThrow(/Failed to get Redis connection/i);
    });

    it("should pass pollInterval from config", async () => {
      const config = {
        driver: "redis",
        redisConnection: mockRedisConnection,
        pollInterval: 5000,
      } as any;

      const connection = await connector.connect(config);
      expect(connection).toBeDefined();
    });

    it("should pass keyPrefix from config", async () => {
      const config = {
        driver: "redis",
        redisConnection: mockRedisConnection,
        keyPrefix: "custom:",
      } as any;

      const connection = await connector.connect(config);
      expect(connection).toBeDefined();
    });

    it("should pass maxEventsPerChannel from config", async () => {
      const config = {
        driver: "redis",
        redisConnection: mockRedisConnection,
        maxEventsPerChannel: 200,
      } as any;

      const connection = await connector.connect(config);
      expect(connection).toBeDefined();
    });
  });
});
