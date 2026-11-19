import { describe, it, expect } from "vitest";
import { validateTaskTransition, assertTransition } from "./taskStateMachine";
import { StateError } from "@/lib/errors";

const STATES = ["OPEN", "CLAIMED", "DELIVERED", "ACCEPTED", "CANCELED"];

const ALLOWED: Array<[string, string]> = [
  ["OPEN", "CLAIMED"],
  ["OPEN", "CANCELED"],
  ["CLAIMED", "DELIVERED"],
  ["DELIVERED", "ACCEPTED"],
  ["DELIVERED", "CLAIMED"], // revision path
];

describe("validateTaskTransition", () => {
  it.each(ALLOWED)("allows %s -> %s", (from, to) => {
    expect(validateTaskTransition(from, to)).toBe(true);
  });

  it("rejects every transition not explicitly allowed", () => {
    for (const from of STATES) {
      for (const to of STATES) {
        if (from === to) continue;
        const expected = ALLOWED.some(([f, t]) => f === from && t === to);
        expect(validateTaskTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it.each(["ACCEPTED", "CANCELED"])("treats %s as terminal", (from) => {
    for (const to of STATES.filter((s) => s !== from)) {
      expect(validateTaskTransition(from, to)).toBe(false);
    }
  });

  it("treats a same-state transition as a no-op (allowed)", () => {
    for (const s of STATES) expect(validateTaskTransition(s, s)).toBe(true);
  });

  it("rejects unknown states", () => {
    expect(validateTaskTransition("BOGUS", "OPEN")).toBe(false);
    expect(validateTaskTransition("OPEN", "BOGUS")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for a valid transition", () => {
    expect(() => assertTransition("OPEN", "CLAIMED")).not.toThrow();
  });

  it("throws a 409 StateError with details for an invalid transition", () => {
    try {
      assertTransition("ACCEPTED", "OPEN");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(StateError);
      const err = e as StateError;
      expect(err.code).toBe("INVALID_STATE_TRANSITION");
      expect(err.status).toBe(409);
      expect(err.details).toEqual({ current: "ACCEPTED", next: "OPEN" });
    }
  });
});
