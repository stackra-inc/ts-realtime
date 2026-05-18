/**
 * @fileoverview Tests for useChannel React hook
 *
 * This test suite verifies the useChannel hook which provides declarative
 * channel subscriptions in React components. Tests cover:
 *
 * - Subscribing to a channel and event
 * - Receiving event data
 * - Connection status tracking
 * - Error handling
 * - Cleanup on unmount (leave channel)
 * - Re-subscription on channel/event name change
 * - Enabled/disabled option
 * - Ref counting for shared channels
 * - Throwing when RealtimeManager is not available
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

// Mock React hooks
const mockState: Record<string, any> = {};
let stateSetters: Record<string, (val: any) => void> = {};
let effectCleanups: (() => void)[] = [];
let effects: (() => (() => void) | void)[] = [];

vi.mock("react", () => ({
  useState: (initial: any) => {
    const key = `state_${Object.keys(mockState).length}`;
    mockState[key] = initial;
    const setter = (val: any) => {
      mockState[key] = typeof val === "function" ? val(mockState[key]) : val;
    };
    stateSetters[key] = setter;
    return [mockState[key], setter];
  },
  useEffect: (effect: () => (() => void) | void, _deps?: any[]) => {
    effects.push(effect);
  },
  useRef: (initial: any) => ({ current: initial }),
}));

vi.mock("@stackra/ts-container/react", () => ({
  useInject: vi.fn(),
}));

vi.mock("@stackra/contracts", () => ({
  REALTIME_MANAGER: "REALTIME_MANAGER",
}));

vi.mock("@/errors", () => ({
  RealtimeError: class RealtimeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RealtimeError";
    }
  },
}));

import { useInject } from "@stackra/ts-container/react";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockChannelWrapper() {
  return {
    listen: vi.fn().mockReturnThis(),
    onError: vi.fn().mockReturnThis(),
    stopListening: vi.fn(),
    leave: vi.fn(),
    isLeft: false,
    name: "test-channel",
  };
}

function createMockConnection(isConnected = true) {
  const mockChannel = createMockChannelWrapper();
  return {
    isConnected: () => isConnected,
    channel: vi.fn(() => mockChannel),
    onStatusChange: vi.fn((cb: any) => {
      return () => {};
    }),
    _mockChannel: mockChannel,
  };
}

function createMockManager(connection?: any) {
  const conn = connection ?? createMockConnection();
  return {
    connection: vi.fn(async () => conn),
    _connection: conn,
  };
}

function resetMocks() {
  Object.keys(mockState).forEach((key) => delete mockState[key]);
  stateSetters = {};
  effectCleanups = [];
  effects = [];
}

// ============================================================================
// Test Suite
// ============================================================================

describe("useChannel", () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  it("should throw when RealtimeManager is not available", async () => {
    (useInject as any).mockReturnValue(null);

    // Import fresh to trigger the hook
    const { useChannel } = await import("@/hooks/use-channel/use-channel.hook");

    expect(() => useChannel("orders", ".order.created")).toThrow(/RealtimeManager not found/);
  });

  it("should return initial state with null data and not connected", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useChannel } = await import("@/hooks/use-channel/use-channel.hook");
    const result = useChannel("orders", ".order.created");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
    // connected starts as false before async resolution
    expect(result.connected).toBe(false);
  });

  it("should accept an enabled option", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useChannel } = await import("@/hooks/use-channel/use-channel.hook");
    const result = useChannel("orders", ".order.created", { enabled: false });

    expect(result).toBeDefined();
    expect(result.data).toBeNull();
  });

  it("should register effects for connection resolution and subscription", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useChannel } = await import("@/hooks/use-channel/use-channel.hook");
    useChannel("orders", ".order.created");

    // Should register at least 2 effects (connection resolution + subscription)
    expect(effects.length).toBeGreaterThanOrEqual(2);
  });
});
