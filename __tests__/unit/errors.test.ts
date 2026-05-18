/**
 * @fileoverview Tests for Realtime Error Classes
 *
 * This test suite verifies the error hierarchy for the realtime package:
 *
 * - RealtimeError — base error class
 * - RealtimeConnectionError — connection-specific errors
 * - RealtimeChannelError — channel-specific errors
 *
 * Tests cover:
 * - Error instantiation with message
 * - Error instantiation with cause
 * - Error name and code properties
 * - Inheritance chain (instanceof checks)
 * - Stack trace capture
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect } from "vitest";
import { RealtimeError, RealtimeConnectionError, RealtimeChannelError } from "@/errors";

// ============================================================================
// Test Suite
// ============================================================================

describe("RealtimeError", () => {
  describe("instantiation", () => {
    it("should create an error with a message", () => {
      const error = new RealtimeError("Something went wrong");
      expect(error.message).toBe("Something went wrong");
    });

    it("should have the correct name", () => {
      const error = new RealtimeError("test");
      expect(error.name).toBe("RealtimeError");
    });

    it("should have the correct code", () => {
      const error = new RealtimeError("test");
      expect(error.code).toBe("REALTIME_ERROR");
    });

    it("should accept an optional cause", () => {
      const cause = new Error("Root cause");
      const error = new RealtimeError("Wrapper error", cause);
      expect(error.cause).toBe(cause);
    });

    it("should have undefined cause when not provided", () => {
      const error = new RealtimeError("test");
      expect(error.cause).toBeUndefined();
    });

    it("should be an instance of Error", () => {
      const error = new RealtimeError("test");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have a stack trace", () => {
      const error = new RealtimeError("test");
      expect(error.stack).toBeDefined();
    });
  });
});

describe("RealtimeConnectionError", () => {
  describe("instantiation", () => {
    it("should create an error with a message", () => {
      const error = new RealtimeConnectionError("Connection failed");
      expect(error.message).toBe("Connection failed");
    });

    it("should have the correct name", () => {
      const error = new RealtimeConnectionError("test");
      expect(error.name).toBe("RealtimeConnectionError");
    });

    it("should have the correct code", () => {
      const error = new RealtimeConnectionError("test");
      expect(error.code).toBe("REALTIME_CONNECTION_ERROR");
    });

    it("should accept an optional cause", () => {
      const cause = new Error("Network timeout");
      const error = new RealtimeConnectionError("Connection failed", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("inheritance", () => {
    it("should be an instance of RealtimeError", () => {
      const error = new RealtimeConnectionError("test");
      expect(error).toBeInstanceOf(RealtimeError);
    });

    it("should be an instance of Error", () => {
      const error = new RealtimeConnectionError("test");
      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe("RealtimeChannelError", () => {
  describe("instantiation", () => {
    it("should create an error with a message", () => {
      const error = new RealtimeChannelError("Channel left");
      expect(error.message).toBe("Channel left");
    });

    it("should have the correct name", () => {
      const error = new RealtimeChannelError("test");
      expect(error.name).toBe("RealtimeChannelError");
    });

    it("should have the correct code", () => {
      const error = new RealtimeChannelError("test");
      expect(error.code).toBe("REALTIME_CHANNEL_ERROR");
    });

    it("should accept an optional cause", () => {
      const cause = new Error("Auth failed");
      const error = new RealtimeChannelError("Channel error", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("inheritance", () => {
    it("should be an instance of RealtimeError", () => {
      const error = new RealtimeChannelError("test");
      expect(error).toBeInstanceOf(RealtimeError);
    });

    it("should be an instance of Error", () => {
      const error = new RealtimeChannelError("test");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
