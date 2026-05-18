/**
 * @fileoverview Tests for Realtime Facade
 *
 * This test suite verifies the realtime facade which provides a module-level
 * proxy to the RealtimeManager via DI injection. Tests cover:
 *
 * - Facade export exists
 * - Facade is typed as RealtimeManager
 * - Facade uses the correct DI token
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

const mockInject = vi.fn(() => ({
  connection: vi.fn(),
  disconnect: vi.fn(),
  channel: vi.fn(),
}));

vi.mock("@stackra/ts-container", () => ({
  inject: (...args: any[]) => mockInject(...args),
}));

vi.mock("@stackra/contracts", () => ({
  REALTIME_MANAGER: "REALTIME_MANAGER_TOKEN",
}));

// ============================================================================
// Test Suite
// ============================================================================

describe("realtime facade", () => {
  it("should export a realtime constant", async () => {
    const { realtime } = await import("@/facades/realtime.facade");
    expect(realtime).toBeDefined();
  });

  it("should call inject with the REALTIME_MANAGER token", async () => {
    await import("@/facades/realtime.facade");
    expect(mockInject).toHaveBeenCalledWith("REALTIME_MANAGER_TOKEN");
  });

  it("should return an object (proxy to RealtimeManager)", async () => {
    const { realtime } = await import("@/facades/realtime.facade");
    expect(typeof realtime).toBe("object");
  });
});
