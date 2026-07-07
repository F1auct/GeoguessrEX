export function scoreFromDistance(distanceKm) {
  const maxScore = 5000;
  const decay = 2000;
  return Math.max(0, Math.round(maxScore * Math.exp(-distanceKm / decay)));
}
