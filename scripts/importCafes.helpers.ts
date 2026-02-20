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
