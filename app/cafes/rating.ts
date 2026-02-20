export function formatRatingLabel(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)} ⭐`;
}
