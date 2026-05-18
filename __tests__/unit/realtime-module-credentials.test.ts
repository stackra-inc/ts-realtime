/**
 * @fileoverview Tests for RealtimeModule credential checking
 *
 * This test suite provides additional coverage for the RealtimeModule's
 * hasCredentials() method and forRoot() behavior with various credential
 * configurations. Tests cover:
 *
 * - Pusher credentials (key + host)
 * - Reverb credentials (key + host)
 * - Mixed credentials
 * - Empty/whitespace-only values
 * - Error handling when Env is not available
 * - Module behavior when credentials are missing
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock @stackra/ts-http to avoid the @stackra/ts-pipeline dependency issue
vi.mock("@stackra/ts-http", () => ({
  HttpMiddleware: () => (target: any) => target,
}));

import { RealtimeModule } from "@/realtime.module";

// ============================================================================
// Mocks
// ============================================================================

const mockEnvValues: Record<string, string | undefined> = {};

vi.mock("@stackra/ts-support", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stackra/ts-support")>();
  return {
    ...actual,
    Env: {
      get: (key: string, defaultValue?: string) => mockEnvValues[key] ?? defaultValue ?? "",
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

// ============================================================================
// Test Suite
// ============================================================================

describe("RealtimeModule — Credential Checking", () => {
  beforeEach(() => {
    Object.keys(mockEnvValues).forEach((key) => delete mockEnvValues[key]);
  });

  describe("hasCredentials() — Pusher", () => {
    it("should return true with both key and host", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "app-key-123";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.pusher.com";

      expect(RealtimeModule.hasCredentials()).toBe(true);
    });

    it("should return false with only key (no host)", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "app-key-123";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });

    it("should return false with only host (no key)", () => {
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.pusher.com";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });

    it("should return false with empty key", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.pusher.com";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });

    it("should return false with whitespace-only key", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "   ";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.pusher.com";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });

    it("should return false with empty host", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "app-key-123";
      mockEnvValues["VITE_PUSHER_HOST"] = "";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });

    it("should return false with whitespace-only host", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "app-key-123";
      mockEnvValues["VITE_PUSHER_HOST"] = "  \t  ";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });
  });

  describe("hasCredentials() — Reverb", () => {
    it("should return true with both key and host", () => {
      mockEnvValues["VITE_REVERB_APP_KEY"] = "reverb-key-456";
      mockEnvValues["VITE_REVERB_HOST"] = "reverb.example.com";

      expect(RealtimeModule.hasCredentials()).toBe(true);
    });

    it("should return false with only key (no host)", () => {
      mockEnvValues["VITE_REVERB_APP_KEY"] = "reverb-key-456";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });

    it("should return false with only host (no key)", () => {
      mockEnvValues["VITE_REVERB_HOST"] = "reverb.example.com";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });
  });

  describe("hasCredentials() — Mixed", () => {
    it("should return true when either Pusher or Reverb is configured", () => {
      // Only Reverb configured
      mockEnvValues["VITE_REVERB_APP_KEY"] = "reverb-key";
      mockEnvValues["VITE_REVERB_HOST"] = "reverb.example.com";
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "";
      mockEnvValues["VITE_PUSHER_HOST"] = "";

      expect(RealtimeModule.hasCredentials()).toBe(true);
    });

    it("should return true when both are configured", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "pusher-key";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.pusher.com";
      mockEnvValues["VITE_REVERB_APP_KEY"] = "reverb-key";
      mockEnvValues["VITE_REVERB_HOST"] = "reverb.example.com";

      expect(RealtimeModule.hasCredentials()).toBe(true);
    });

    it("should return false when neither is configured", () => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "";
      mockEnvValues["VITE_PUSHER_HOST"] = "";
      mockEnvValues["VITE_REVERB_APP_KEY"] = "";
      mockEnvValues["VITE_REVERB_HOST"] = "";

      expect(RealtimeModule.hasCredentials()).toBe(false);
    });
  });

  describe("forRoot() — No credentials", () => {
    it("should return empty providers when credentials are missing", () => {
      const module = RealtimeModule.forRoot({
        default: "main",
        connections: {
          main: { driver: "pusher", key: "test", wsHost: "ws.example.com" },
        },
      });

      expect(module.providers).toEqual([]);
      expect(module.exports).toEqual([]);
    });

    it("should still return the correct module reference", () => {
      const module = RealtimeModule.forRoot({
        default: "main",
        connections: { main: { driver: "pusher" } },
      });

      expect(module.module).toBe(RealtimeModule);
    });
  });

  describe("forRoot() — With credentials", () => {
    beforeEach(() => {
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "test-key";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.example.com";
    });

    it("should create providers for each configured connection", () => {
      const module = RealtimeModule.forRoot({
        default: "main",
        connections: {
          main: { driver: "pusher", key: "key-1", wsHost: "ws1.example.com" },
          secondary: { driver: "pusher", key: "key-2", wsHost: "ws2.example.com" },
        },
      });

      expect(module.providers!.length).toBeGreaterThan(0);
    });

    it("should mark the module as global", () => {
      const module = RealtimeModule.forRoot({
        default: "main",
        connections: {
          main: { driver: "pusher", key: "key", wsHost: "ws.example.com" },
        },
      });

      expect((module as any).global).toBe(true);
    });

    it("should export the RealtimeManager", () => {
      const module = RealtimeModule.forRoot({
        default: "main",
        connections: {
          main: { driver: "pusher", key: "key", wsHost: "ws.example.com" },
        },
      });

      expect(module.exports).toBeDefined();
      expect(module.exports!.length).toBeGreaterThan(0);
    });
  });
});
