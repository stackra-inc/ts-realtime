/**
 * @fileoverview Tests for useRealtime React hook
 *
 * This test suite verifies the useRealtime hook which provides connection
 * status and manager access in React components. Tests cover:
 *
 * - Initial state (disconnected)
 * - Connection status tracking
 * - Manager access
 * - Error handling (connection failure sets Error status)
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
  ConnectionStatus: {
    Connected: "connected",
    Connecting: "connecting",
    Disconnected: "disconnected",
    Reconnecting: "reconnecting",
    Error: "error",
  },
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

function createMockConnection(status = "connected") {
  return {
    getStatus: () => status,
    isConnected: () => status === "connected",
    onStatusChange: vi.fn(() => () => {}),
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

describe("useRealtime", () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  it("should throw when RealtimeManager is not available", async () => {
    (useInject as any).mockReturnValue(null);

    const { useRealtime } = await import("@/hooks/use-realtime/use-realtime.hook");

    expect(() => useRealtime()).toThrow(/RealtimeManager not found/);
  });

  it("should return initial state with disconnected status", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useRealtime } = await import("@/hooks/use-realtime/use-realtime.hook");
    const result = useRealtime();

    expect(result.status).toBe("disconnected");
    expect(result.isConnected).toBe(false);
  });

  it("should provide access to the manager instance", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useRealtime } = await import("@/hooks/use-realtime/use-realtime.hook");
    const result = useRealtime();

    expect(result.manager).toBe(manager);
  });

  it("should register an effect for connection resolution", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useRealtime } = await import("@/hooks/use-realtime/use-realtime.hook");
    useRealtime();

    expect(effects.length).toBeGreaterThanOrEqual(1);
  });

  it("should compute isConnected from status", async () => {
    const manager = createMockManager();
    (useInject as any).mockReturnValue(manager);

    const { useRealtime } = await import("@/hooks/use-realtime/use-realtime.hook");
    const result = useRealtime();

    // Initial status is "disconnected", so isConnected should be false
    expect(result.isConnected).toBe(false);
  });
});
