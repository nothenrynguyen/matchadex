export function formatRatingLabel(value: number | null, reviewCount: number) {
  if (value === null || reviewCount === 0) {
    return "N/A (0 reviews)";
  }

  const reviewLabel = reviewCount === 1 ? "review" : "reviews";
  return `${value.toFixed(2)}/5 (${reviewCount} ${reviewLabel})`;
}
