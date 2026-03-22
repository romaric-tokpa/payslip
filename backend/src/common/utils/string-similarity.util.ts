/**
 * Chaîne normalisée pour comparaisons (casse, accents, ponctuation, espaces).
 */
export function normalizeString(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export function findBestMatch(
  value: string,
  candidates: { id: string; name: string }[],
): { match: { id: string; name: string } | null; distance: number } {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { match: null, distance: Infinity };
  }
  let best: { id: string; name: string } | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = levenshteinDistance(
      normalized,
      normalizeString(c.name),
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return { match: bestDist <= 3 ? best : null, distance: bestDist };
}
