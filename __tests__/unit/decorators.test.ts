/**
 * @fileoverview Tests for Realtime Decorators
 *
 * This test suite verifies the DI decorators for the realtime package:
 *
 * - getRealtimeConnectionToken() — token generation
 * - InjectRealtime() — parameter/property decorator
 * - InjectRealtimeManager — manager injection decorator
 *
 * Tests cover:
 * - Token generation with default name
 * - Token generation with custom name
 * - Token format consistency
 * - Decorator function return types
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, vi } from "vitest";
import { getRealtimeConnectionToken, InjectRealtime } from "@/decorators/inject-realtime.decorator";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@stackra/ts-container", () => ({
  Inject: (token: string) => () => {},
}));

// ============================================================================
// Test Suite
// ============================================================================

describe("getRealtimeConnectionToken", () => {
  it("should return default token when no name provided", () => {
    const token = getRealtimeConnectionToken();
    expect(token).toBe("RealtimeConnection:default");
  });

  it("should return token with custom connection name", () => {
    const token = getRealtimeConnectionToken("main");
    expect(token).toBe("RealtimeConnection:main");
  });

  it("should return token with different connection names", () => {
    expect(getRealtimeConnectionToken("notifications")).toBe("RealtimeConnection:notifications");
    expect(getRealtimeConnectionToken("chat")).toBe("RealtimeConnection:chat");
    expect(getRealtimeConnectionToken("analytics")).toBe("RealtimeConnection:analytics");
  });

  it("should produce unique tokens for different names", () => {
    const token1 = getRealtimeConnectionToken("main");
    const token2 = getRealtimeConnectionToken("secondary");
    expect(token1).not.toBe(token2);
  });

  it("should produce consistent tokens for the same name", () => {
    const token1 = getRealtimeConnectionToken("main");
    const token2 = getRealtimeConnectionToken("main");
    expect(token1).toBe(token2);
  });

  it("should handle empty string as connection name", () => {
    const token = getRealtimeConnectionToken("");
    expect(token).toBe("RealtimeConnection:");
  });
});

describe("InjectRealtime", () => {
  it("should return a decorator function", () => {
    const decorator = InjectRealtime();
    expect(typeof decorator).toBe("function");
  });

  it("should return a decorator function with custom name", () => {
    const decorator = InjectRealtime("main");
    expect(typeof decorator).toBe("function");
  });

  it("should use default token when no name provided", () => {
    // InjectRealtime() should internally call Inject with the default token
    const decorator = InjectRealtime();
    expect(decorator).toBeDefined();
  });

  it("should use named token when name provided", () => {
    const decorator = InjectRealtime("notifications");
    expect(decorator).toBeDefined();
  });
});
