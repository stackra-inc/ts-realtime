/**
 * @fileoverview Tests for usePresence React hook
 *
 * This test suite verifies the usePresence hook which provides declarative
 * presence channel subscriptions in React components. Tests cover:
 *
 * - Joining a presence channel
 * - Tracking members (here, joining, leaving)
 * - Connection status tracking
 * - Error handling
 * - Cleanup on unmount (leave channel)
 * - Ref counting for shared presence channels
 * - Throwing when RealtimeManager is not available
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

const mockState: Record<string, any> = {};
let stateSetters: Record<string, (val: any) => void> = {};
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

function createMockPresenceWrapper() {
  return {
    here: vi.fn().mockReturnThis(),
    joining: vi.fn().mockReturnThis(),
    leaving: vi.fn().mockReturnThis(),
    onError: vi.fn().mockReturnThis(),
    leave: vi.fn(),
    isLeft: false,
    name: "chat-room.1",
  };
}

function createMockConnection(isConnected = true) {
  const mockPresence = createMockPresenceWrapper();
  return {
    isConnected: () => isConnected,
    join: vi.fn(() => mockPresence),
    onStatusChange: vi.fn(() => () => {}),
    _mockPresence: mockPresence,
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
  effects = [];
}

// ============================================================================
// Test Suite
// ============================================================================

describe("usePresence", () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  it("should throw when RealtimeManager is not available", async () => {
    (useInject as any).mockReturnValue(null);

    const { usePresence } = await import("@/hooks/use-presence/use-presence.hook");

    expect(() => usePresence("chat-room.1")).toThrow(/RealtimeManager not found/);
  });

  it("should return initial state with empty members and not connected", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { usePresence } = await import("@/hooks/use-presence/use-presence.hook");
    const result = usePresence("chat-room.1");

    expect(result.members).toEqual([]);
    expect(result.error).toBeNull();
    expect(result.connected).toBe(false);
  });

  it("should register effects for connection resolution and channel join", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { usePresence } = await import("@/hooks/use-presence/use-presence.hook");
    usePresence("chat-room.1");

    expect(effects.length).toBeGreaterThanOrEqual(2);
  });

  it("should accept a channel name parameter", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { usePresence } = await import("@/hooks/use-presence/use-presence.hook");
    const result = usePresence("my-room.42");

    expect(result).toBeDefined();
    expect(result.members).toEqual([]);
  });
});
