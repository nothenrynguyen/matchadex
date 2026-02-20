import { describe, expect, it } from "vitest";
import { formatRatingLabel } from "./rating";

describe("formatRatingLabel", () => {
  it("returns N/A for unrated cafes", () => {
    expect(formatRatingLabel(null)).toBe("N/A");
  });

  it("formats numeric ratings", () => {
    expect(formatRatingLabel(4.236)).toBe("4.24 ⭐");
  });
});
