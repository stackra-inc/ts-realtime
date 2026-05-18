/**
 * @fileoverview Tests for defineConfig utility
 *
 * This test suite verifies the defineConfig helper function which provides
 * type-safe configuration definition for the realtime module. Tests cover:
 *
 * - Identity function behavior (returns same object)
 * - Type safety (accepts valid config shapes)
 * - Passthrough of all configuration properties
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect } from "vitest";
import { defineConfig } from "@/utils/define-config.util";
import type { RealtimeModuleOptions } from "@/interfaces/realtime-module-options.interface";

// ============================================================================
// Test Suite
// ============================================================================

describe("defineConfig", () => {
  it("should return the same configuration object", () => {
    const config: RealtimeModuleOptions = {
      default: "main",
      connections: {
        main: {
          driver: "pusher",
          key: "test-key",
          wsHost: "ws.example.com",
          wsPort: 6001,
        },
      },
    };

    const result = defineConfig(config);

    expect(result).toBe(config);
  });

  it("should preserve all connection properties", () => {
    const config: RealtimeModuleOptions = {
      default: "main",
      connections: {
        main: {
          driver: "pusher",
          key: "my-key",
          wsHost: "ws.example.com",
          wsPort: 6001,
          forceTLS: true,
          cluster: "us2",
          encrypted: true,
          disableStats: false,
          authEndpoint: "/broadcasting/auth",
          authHeaders: { Authorization: "Bearer token" },
          reconnectInitialDelay: 500,
          reconnectMaxDelay: 30000,
          reconnectMultiplier: 1.5,
        },
      },
    };

    const result = defineConfig(config);

    expect(result.default).toBe("main");
    expect(result.connections.main.driver).toBe("pusher");
    expect(result.connections.main.key).toBe("my-key");
    expect(result.connections.main.wsHost).toBe("ws.example.com");
    expect(result.connections.main.wsPort).toBe(6001);
    expect(result.connections.main.forceTLS).toBe(true);
    expect(result.connections.main.cluster).toBe("us2");
    expect(result.connections.main.authEndpoint).toBe("/broadcasting/auth");
    expect(result.connections.main.reconnectInitialDelay).toBe(500);
    expect(result.connections.main.reconnectMaxDelay).toBe(30000);
    expect(result.connections.main.reconnectMultiplier).toBe(1.5);
  });

  it("should support multiple connections", () => {
    const config: RealtimeModuleOptions = {
      default: "main",
      connections: {
        main: {
          driver: "pusher",
          key: "key-1",
          wsHost: "ws1.example.com",
        },
        secondary: {
          driver: "pusher",
          key: "key-2",
          wsHost: "ws2.example.com",
        },
        redis: {
          driver: "redis",
        },
      },
    };

    const result = defineConfig(config);

    expect(Object.keys(result.connections)).toHaveLength(3);
    expect(result.connections.main).toBeDefined();
    expect(result.connections.secondary).toBeDefined();
    expect(result.connections.redis).toBeDefined();
  });

  it("should support minimal configuration", () => {
    const config: RealtimeModuleOptions = {
      default: "default",
      connections: {},
    };

    const result = defineConfig(config);

    expect(result.default).toBe("default");
    expect(result.connections).toEqual({});
  });
});
