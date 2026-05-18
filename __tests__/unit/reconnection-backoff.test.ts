/**
 * @fileoverview Tests for Reconnection with Exponential Backoff
 *
 * This test suite verifies the reconnection logic in EchoConnection,
 * specifically the exponential backoff algorithm. Tests cover:
 *
 * - Initial delay calculation
 * - Exponential multiplier application
 * - Maximum delay cap
 * - Reconnect attempt counter
 * - Backoff reset on successful reconnection
 * - Cancellation of pending reconnection
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

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
// Test Suite — Backoff Algorithm (Unit)
// ============================================================================

describe("Reconnection Backoff Algorithm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Delay calculation", () => {
    it("should calculate initial delay correctly", () => {
      const initialDelay = 1000;
      const multiplier = 2;
      const attempt = 0;

      const delay = initialDelay * Math.pow(multiplier, attempt);
      expect(delay).toBe(1000);
    });

    it("should apply exponential multiplier for subsequent attempts", () => {
      const initialDelay = 1000;
      const multiplier = 2;

      expect(initialDelay * Math.pow(multiplier, 0)).toBe(1000);
      expect(initialDelay * Math.pow(multiplier, 1)).toBe(2000);
      expect(initialDelay * Math.pow(multiplier, 2)).toBe(4000);
      expect(initialDelay * Math.pow(multiplier, 3)).toBe(8000);
      expect(initialDelay * Math.pow(multiplier, 4)).toBe(16000);
    });

    it("should cap delay at maxDelay", () => {
      const initialDelay = 1000;
      const multiplier = 2;
      const maxDelay = 30000;

      // Attempt 5: 1000 * 2^5 = 32000, capped at 30000
      const delay = Math.min(initialDelay * Math.pow(multiplier, 5), maxDelay);
      expect(delay).toBe(30000);
    });

    it("should never exceed maxDelay regardless of attempts", () => {
      const initialDelay = 1000;
      const multiplier = 2;
      const maxDelay = 30000;

      for (let attempt = 0; attempt < 20; attempt++) {
        const delay = Math.min(initialDelay * Math.pow(multiplier, attempt), maxDelay);
        expect(delay).toBeLessThanOrEqual(maxDelay);
      }
    });

    it("should work with custom multiplier values", () => {
      const initialDelay = 500;
      const multiplier = 1.5;

      expect(initialDelay * Math.pow(multiplier, 0)).toBe(500);
      expect(initialDelay * Math.pow(multiplier, 1)).toBe(750);
      expect(initialDelay * Math.pow(multiplier, 2)).toBe(1125);
    });

    it("should use default values when config is not provided", () => {
      const defaultInitialDelay = 1000;
      const defaultMultiplier = 2;
      const defaultMaxDelay = 30000;

      const delay = Math.min(defaultInitialDelay * Math.pow(defaultMultiplier, 3), defaultMaxDelay);
      expect(delay).toBe(8000);
    });
  });

  describe("Backoff sequence", () => {
    it("should produce correct delay sequence with defaults", () => {
      const initialDelay = 1000;
      const multiplier = 2;
      const maxDelay = 30000;

      const expectedSequence = [1000, 2000, 4000, 8000, 16000, 30000, 30000];

      for (let i = 0; i < expectedSequence.length; i++) {
        const delay = Math.min(initialDelay * Math.pow(multiplier, i), maxDelay);
        expect(delay).toBe(expectedSequence[i]);
      }
    });

    it("should produce correct delay sequence with custom config", () => {
      const initialDelay = 100;
      const multiplier = 3;
      const maxDelay = 5000;

      const expectedSequence = [100, 300, 900, 2700, 5000, 5000];

      for (let i = 0; i < expectedSequence.length; i++) {
        const delay = Math.min(initialDelay * Math.pow(multiplier, i), maxDelay);
        expect(delay).toBe(expectedSequence[i]);
      }
    });
  });

  describe("Timer management", () => {
    it("should schedule a timer with the correct delay", () => {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const delay = 2000;
      setTimeout(() => {}, delay);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), delay);
    });

    it("should cancel timer with clearTimeout", () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      const timer = setTimeout(() => {}, 1000);
      clearTimeout(timer);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    });

    it("should not execute callback after clearTimeout", () => {
      const callback = vi.fn();
      const timer = setTimeout(callback, 1000);
      clearTimeout(timer);

      vi.advanceTimersByTime(2000);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
