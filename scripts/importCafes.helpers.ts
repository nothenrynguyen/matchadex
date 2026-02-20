export type ExistingCafeRecord = {
  id: string;
  googlePlaceId: string;
  name: string;
  city: string;
};

export type ManualCafeRecord = {
  googlePlaceId: string;
  name: string;
  city: string;
};

export const BANNED_CAFE_WORDS = [
  "7-eleven",
  "barnes",
  "target",
  "hotel",
  "gas",
  "market",
  "station",
];

export const SUPPORTED_CITY_LABELS = ["LA", "OC", "Bay", "NYC", "Seattle"] as const;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function isCafeOrCoffeeType(types: string[] | undefined) {
  if (!types || types.length === 0) {
    return false;
  }

  return types.some((type) => type.includes("cafe") || type.includes("coffee"));
}

export function getMatchingBannedWord(
  name: string,
  address: string | null,
  bannedWords: string[],
) {
  const searchableText = `${name} ${address ?? ""}`.toLowerCase();
  return bannedWords.find((word) => searchableText.includes(word)) ?? null;
}

export function findExistingCafeForManualImport(
  existingCafes: ExistingCafeRecord[],
  manualCafe: ManualCafeRecord,
) {
  const manualName = normalize(manualCafe.name);
  const manualCity = normalize(manualCafe.city);

  return (
    existingCafes.find((existingCafe) => existingCafe.googlePlaceId === manualCafe.googlePlaceId) ??
    existingCafes.find(
      (existingCafe) =>
        normalize(existingCafe.name) === manualName && normalize(existingCafe.city) === manualCity,
    ) ??
    null
  );
}

export function inferCityLabelFromText(query: string, address: string | null) {
  const haystack = `${query} ${address ?? ""}`.toLowerCase();

  if (haystack.includes("seattle") || haystack.includes("wa ")) {
    return "Seattle";
  }

  if (
    haystack.includes("new york") ||
    haystack.includes("nyc") ||
    haystack.includes(" manhattan") ||
    haystack.includes(", ny")
  ) {
    return "NYC";
  }

  if (
    haystack.includes("san francisco") ||
    haystack.includes("oakland") ||
    haystack.includes("berkeley") ||
    haystack.includes("san jose") ||
    haystack.includes("bay area")
  ) {
    return "Bay";
  }

  if (
    haystack.includes("orange county") ||
    haystack.includes("irvine") ||
    haystack.includes("anaheim") ||
    haystack.includes("newport beach") ||
    haystack.includes("costa mesa")
  ) {
    return "OC";
  }

  if (
    haystack.includes("los angeles") ||
    haystack.includes("la ") ||
    haystack.includes("west hollywood") ||
    haystack.includes("pasadena")
  ) {
    return "LA";
  }

  return null;
}
