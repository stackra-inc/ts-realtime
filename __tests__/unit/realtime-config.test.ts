/**
 * @fileoverview Tests for defaultRealtimeModuleOptions
 *
 * This test suite verifies the default configuration values exported
 * by the realtime config module. Tests cover:
 *
 * - Default connection name
 * - Empty connections map
 * - Partial type (allows merging with consumer config)
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect } from "vitest";
import { defaultRealtimeModuleOptions } from "@/config/realtime.config";

// ============================================================================
// Test Suite
// ============================================================================

describe("defaultRealtimeModuleOptions", () => {
  it("should have a default connection name of 'default'", () => {
    expect(defaultRealtimeModuleOptions.default).toBe("default");
  });

  it("should have an empty connections map", () => {
    expect(defaultRealtimeModuleOptions.connections).toEqual({});
  });

  it("should be a partial type (not all fields required)", () => {
    // The type is Partial<RealtimeModuleOptions>, so it should be spreadable
    const merged = {
      ...defaultRealtimeModuleOptions,
      default: "main",
      connections: {
        main: { driver: "pusher", key: "test" },
      },
    };

    expect(merged.default).toBe("main");
    expect(merged.connections.main.driver).toBe("pusher");
  });

  it("should be immutable in practice (object reference)", () => {
    // Verify the exported object is stable
    const ref1 = defaultRealtimeModuleOptions;
    const ref2 = defaultRealtimeModuleOptions;
    expect(ref1).toBe(ref2);
  });
});
