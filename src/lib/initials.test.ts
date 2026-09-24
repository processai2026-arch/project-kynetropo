import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first and last word", () => {
    expect(initialsOf("Karthik Raja")).toBe("KR");
    expect(initialsOf("A Munusamy Karthikeyan")).toBe("AK");
    expect(initialsOf("Chandru")).toBe("C");
  });
  it("ignores punctuation so garment names read cleanly", () => {
    expect(initialsOf("Pant / Trouser")).toBe("PT");
    expect(initialsOf("Shirt (Full Sleeve)")).toBe("SS");
  });
  it("falls back to a dash when there is no name", () => {
    expect(initialsOf("")).toBe("—");
    expect(initialsOf(null)).toBe("—");
    expect(initialsOf("—")).toBe("—");
  });
});
