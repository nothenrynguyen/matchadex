import { describe, expect, it } from "vitest";
import {
  findExistingCafeForManualImport,
  getMatchingBannedWord,
  isCafeOrCoffeeType,
} from "./importCafes.helpers";

describe("importCafes helpers", () => {
  it("matches existing cafe for manual import by googlePlaceId", () => {
    const existing = [
      { id: "1", googlePlaceId: "gp-1", name: "Cafe One", city: "LA" },
      { id: "2", googlePlaceId: "gp-2", name: "Cafe Two", city: "OC" },
    ];

    const match = findExistingCafeForManualImport(existing, {
      googlePlaceId: "gp-2",
      name: "Different Name",
      city: "Seattle",
    });

    expect(match?.id).toBe("2");
  });

  it("matches existing cafe for manual import by normalized name + city", () => {
    const existing = [
      { id: "1", googlePlaceId: "gp-1", name: "Cafe One", city: "LA" },
      { id: "2", googlePlaceId: "gp-2", name: "Kodo Cafe", city: "NYC" },
    ];

    const match = findExistingCafeForManualImport(existing, {
      googlePlaceId: "new-gp",
      name: "  kodo cafe ",
      city: "nyc",
    });

    expect(match?.id).toBe("2");
  });

  it("requires cafe or coffee place types", () => {
    expect(isCafeOrCoffeeType(["restaurant", "food"])).toBe(false);
    expect(isCafeOrCoffeeType(["coffee_shop", "food"])).toBe(true);
    expect(isCafeOrCoffeeType(["cafe", "point_of_interest"])).toBe(true);
  });

  it("detects banned words including station", () => {
    const banned = ["7-eleven", "station"];
    expect(getMatchingBannedWord("Union Station Cafe", null, banned)).toBe("station");
    expect(getMatchingBannedWord("Normal Cafe", null, banned)).toBeNull();
  });
});
