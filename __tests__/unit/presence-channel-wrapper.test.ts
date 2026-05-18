/**
 * @fileoverview Tests for PresenceChannelWrapper
 *
 * This test suite verifies the PresenceChannelWrapper service which extends
 * ChannelWrapper with presence-specific member tracking. Tests cover:
 *
 * - `here()` — receiving the initial member list
 * - `joining()` — tracking new members joining
 * - `leaving()` — tracking members leaving
 * - `getMembers()` — retrieving the current member list
 * - Member list consistency — list is updated before callbacks fire
 * - Method chaining — fluent API
 * - Inheritance — ChannelWrapper methods still work
 *
 * @module @stackra/ts-realtime
 * @category Tests / Unit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PresenceChannelWrapper } from "@/services/presence-channel-wrapper.service";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock Echo presence channel for testing.
 */
function createMockPresenceEchoChannel() {
  return {
    listen: vi.fn().mockReturnThis(),
    listenToAll: vi.fn().mockReturnThis(),
    stopListening: vi.fn().mockReturnThis(),
    whisper: vi.fn().mockReturnThis(),
    listenForWhisper: vi.fn().mockReturnThis(),
    notification: vi.fn().mockReturnThis(),
    error: vi.fn(),
    here: vi.fn().mockReturnThis(),
    joining: vi.fn().mockReturnThis(),
    leaving: vi.fn().mockReturnThis(),
  };
}

interface TestUser {
  id: number;
  name: string;
}

// ============================================================================
// Test Suite
// ============================================================================

describe("PresenceChannelWrapper", () => {
  let echoChannel: ReturnType<typeof createMockPresenceEchoChannel>;
  let onLeave: ReturnType<typeof vi.fn>;
  let wrapper: PresenceChannelWrapper;

  beforeEach(() => {
    echoChannel = createMockPresenceEchoChannel();
    onLeave = vi.fn();
    wrapper = new PresenceChannelWrapper(echoChannel, "chat-room.1", onLeave);
  });

  describe("here()", () => {
    it("should delegate to the Echo channel here method", () => {
      const callback = vi.fn();
      wrapper.here(callback);
      expect(echoChannel.here).toHaveBeenCalled();
    });

    it("should return this for method chaining", () => {
      const result = wrapper.here(vi.fn());
      expect(result).toBe(wrapper);
    });

    it("should update internal members list before invoking callback", () => {
      const members: TestUser[] = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      echoChannel.here.mockImplementation((cb: (members: TestUser[]) => void) => {
        cb(members);
        return echoChannel;
      });

      let membersInsideCallback: TestUser[] = [];
      wrapper.here<TestUser>((m) => {
        membersInsideCallback = wrapper.getMembers<TestUser>();
      });

      expect(membersInsideCallback).toEqual(members);
    });

    it("should pass the member list to the callback", () => {
      const members: TestUser[] = [{ id: 1, name: "Alice" }];

      echoChannel.here.mockImplementation((cb: (members: TestUser[]) => void) => {
        cb(members);
        return echoChannel;
      });

      const callback = vi.fn();
      wrapper.here<TestUser>(callback);

      expect(callback).toHaveBeenCalledWith(members);
    });
  });

  describe("joining()", () => {
    it("should delegate to the Echo channel joining method", () => {
      const callback = vi.fn();
      wrapper.joining(callback);
      expect(echoChannel.joining).toHaveBeenCalled();
    });

    it("should return this for method chaining", () => {
      const result = wrapper.joining(vi.fn());
      expect(result).toBe(wrapper);
    });

    it("should add the new member to the internal list before invoking callback", () => {
      const initialMembers: TestUser[] = [{ id: 1, name: "Alice" }];
      const newMember: TestUser = { id: 2, name: "Bob" };

      // Set up initial members
      echoChannel.here.mockImplementation((cb: (members: TestUser[]) => void) => {
        cb(initialMembers);
        return echoChannel;
      });
      wrapper.here<TestUser>(vi.fn());

      // Set up joining
      echoChannel.joining.mockImplementation((cb: (member: TestUser) => void) => {
        cb(newMember);
        return echoChannel;
      });

      let membersInsideCallback: TestUser[] = [];
      wrapper.joining<TestUser>(() => {
        membersInsideCallback = wrapper.getMembers<TestUser>();
      });

      expect(membersInsideCallback).toContainEqual(newMember);
      expect(membersInsideCallback).toHaveLength(2);
    });

    it("should pass the joining member to the callback", () => {
      const newMember: TestUser = { id: 3, name: "Charlie" };

      echoChannel.joining.mockImplementation((cb: (member: TestUser) => void) => {
        cb(newMember);
        return echoChannel;
      });

      const callback = vi.fn();
      wrapper.joining<TestUser>(callback);

      expect(callback).toHaveBeenCalledWith(newMember);
    });
  });

  describe("leaving()", () => {
    it("should delegate to the Echo channel leaving method", () => {
      const callback = vi.fn();
      wrapper.leaving(callback);
      expect(echoChannel.leaving).toHaveBeenCalled();
    });

    it("should return this for method chaining", () => {
      const result = wrapper.leaving(vi.fn());
      expect(result).toBe(wrapper);
    });

    it("should remove the member from the internal list before invoking callback", () => {
      const alice: TestUser = { id: 1, name: "Alice" };
      const bob: TestUser = { id: 2, name: "Bob" };

      // Set up initial members
      echoChannel.here.mockImplementation((cb: (members: TestUser[]) => void) => {
        cb([alice, bob]);
        return echoChannel;
      });
      wrapper.here<TestUser>(vi.fn());

      // Set up leaving
      echoChannel.leaving.mockImplementation((cb: (member: TestUser) => void) => {
        cb(bob);
        return echoChannel;
      });

      let membersInsideCallback: TestUser[] = [];
      wrapper.leaving<TestUser>(() => {
        membersInsideCallback = wrapper.getMembers<TestUser>();
      });

      expect(membersInsideCallback).not.toContainEqual(bob);
      expect(membersInsideCallback).toHaveLength(1);
      expect(membersInsideCallback[0]).toBe(alice);
    });

    it("should pass the leaving member to the callback", () => {
      const leavingMember: TestUser = { id: 1, name: "Alice" };

      echoChannel.leaving.mockImplementation((cb: (member: TestUser) => void) => {
        cb(leavingMember);
        return echoChannel;
      });

      const callback = vi.fn();
      wrapper.leaving<TestUser>(callback);

      expect(callback).toHaveBeenCalledWith(leavingMember);
    });
  });

  describe("getMembers()", () => {
    it("should return an empty array initially", () => {
      expect(wrapper.getMembers()).toEqual([]);
    });

    it("should return a copy of the members array (not a reference)", () => {
      echoChannel.here.mockImplementation((cb: (members: TestUser[]) => void) => {
        cb([{ id: 1, name: "Alice" }]);
        return echoChannel;
      });
      wrapper.here<TestUser>(vi.fn());

      const members1 = wrapper.getMembers<TestUser>();
      const members2 = wrapper.getMembers<TestUser>();

      expect(members1).toEqual(members2);
      expect(members1).not.toBe(members2);
    });

    it("should reflect the current state after multiple joins and leaves", () => {
      const alice: TestUser = { id: 1, name: "Alice" };
      const bob: TestUser = { id: 2, name: "Bob" };
      const charlie: TestUser = { id: 3, name: "Charlie" };

      // Initial members
      echoChannel.here.mockImplementation((cb: (members: TestUser[]) => void) => {
        cb([alice, bob]);
        return echoChannel;
      });
      wrapper.here<TestUser>(vi.fn());

      // Charlie joins
      echoChannel.joining.mockImplementation((cb: (member: TestUser) => void) => {
        cb(charlie);
        return echoChannel;
      });
      wrapper.joining<TestUser>(vi.fn());

      // Alice leaves
      echoChannel.leaving.mockImplementation((cb: (member: TestUser) => void) => {
        cb(alice);
        return echoChannel;
      });
      wrapper.leaving<TestUser>(vi.fn());

      const members = wrapper.getMembers<TestUser>();
      expect(members).toHaveLength(2);
      expect(members).toContainEqual(bob);
      expect(members).toContainEqual(charlie);
    });
  });

  describe("Inheritance from ChannelWrapper", () => {
    it("should support listen() from parent class", () => {
      const callback = vi.fn();
      wrapper.listen(".event", callback);
      expect(echoChannel.listen).toHaveBeenCalledWith(".event", callback);
    });

    it("should support leave() from parent class", () => {
      wrapper.leave();
      expect(wrapper.isLeft).toBe(true);
      expect(onLeave).toHaveBeenCalledWith("chat-room.1");
    });

    it("should support name property from parent class", () => {
      expect(wrapper.name).toBe("chat-room.1");
    });

    it("should support onError() from parent class", () => {
      const callback = vi.fn();
      wrapper.onError(callback);
      expect(echoChannel.error).toHaveBeenCalled();
    });
  });

  describe("Method chaining", () => {
    it("should support chaining here → joining → leaving → listen", () => {
      echoChannel.here.mockImplementation((cb: any) => {
        cb([]);
        return echoChannel;
      });
      echoChannel.joining.mockImplementation((cb: any) => {
        return echoChannel;
      });
      echoChannel.leaving.mockImplementation((cb: any) => {
        return echoChannel;
      });

      const result = wrapper.here(vi.fn()).joining(vi.fn()).leaving(vi.fn());

      expect(result).toBe(wrapper);
    });
  });
});
