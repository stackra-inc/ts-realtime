/**
 * @fileoverview Tests for RealtimeModule
 *
 * This test suite verifies the RealtimeModule DI integration including:
 * - Module registration via `forRoot()` with connection configurations
 * - Provider creation and token registration
 * - Credential checking via `hasCredentials()`
 * - Module export structure validation
 *
 * @module @stackra/ts-realtime
 * @category Tests / Module
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a minimal valid RealtimeConfig for testing.
 */
function makeConfig(overrides: Record<string, any> = {}) {
  return {
    default: "pusher",
    connections: {
      pusher: {
        driver: "pusher" as const,
        key: "test-key",
        cluster: "us2",
        wsHost: "ws.example.com",
        wsPort: 6001,
      },
      ...overrides.connections,
    },
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("RealtimeModule", () => {
  beforeEach(() => {
    Object.keys(mockEnvValues).forEach((key) => delete mockEnvValues[key]);
  });

  describe("forRoot()", () => {
    it("should return a DynamicModule with the correct module reference", () => {
      // Act: Create module
      const module = RealtimeModule.forRoot(makeConfig());

      // Assert: Module reference is correct
      expect(module).toBeDefined();
      expect(module.module).toBe(RealtimeModule);
    });

    it("should include providers array", () => {
      // Arrange: Set credentials so module creates providers
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "test-key";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.example.com";

      // Act: Create module
      const module = RealtimeModule.forRoot(makeConfig());

      // Assert: Providers are defined
      expect(module.providers).toBeDefined();
      expect(Array.isArray(module.providers)).toBe(true);
      expect(module.providers!.length).toBeGreaterThan(0);
    });

    it("should include exports array", () => {
      // Act: Create module
      const module = RealtimeModule.forRoot(makeConfig());

      // Assert: Exports are defined
      expect(module.exports).toBeDefined();
    });
  });

  describe("hasCredentials()", () => {
    it("should return true when Pusher credentials are set", () => {
      // Arrange: Set Pusher credentials
      mockEnvValues["VITE_PUSHER_APP_KEY"] = "test-key";
      mockEnvValues["VITE_PUSHER_HOST"] = "ws.example.com";

      // Act & Assert
      expect(RealtimeModule.hasCredentials()).toBe(true);
    });

    it("should return true when Reverb credentials are set", () => {
      // Arrange: Set Reverb credentials
      mockEnvValues["VITE_REVERB_APP_KEY"] = "reverb-key";
      mockEnvValues["VITE_REVERB_HOST"] = "reverb.example.com";

      // Act & Assert
      expect(RealtimeModule.hasCredentials()).toBe(true);
    });

    it("should return false when no credentials are set", () => {
      // Act & Assert
      expect(RealtimeModule.hasCredentials()).toBe(false);
    });
  });
});
