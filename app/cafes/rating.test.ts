import { describe, expect, it } from "vitest";
import { formatRatingLabel } from "./rating";

describe("formatRatingLabel", () => {
  it("returns N/A for unrated cafes", () => {
    expect(formatRatingLabel(null, 0)).toBe("N/A (0 reviews)");
  });

  it("formats numeric ratings with review count", () => {
    expect(formatRatingLabel(3.67, 1)).toBe("3.67/5 (1 review)");
    expect(formatRatingLabel(4.236, 3)).toBe("4.24/5 (3 reviews)");
  });
});
