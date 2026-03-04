const HORSE_MOVES = [
  [0, 0],
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

function parseInput(input) {
  const values = String(input)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);

  if (values.length < 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('Expected four integers: n m horseX horseY');
  }

  const [n, m, horseX, horseY] = values;
  return { n, m, horseX, horseY };
}

function buildBlockedSet(n, m, horseX, horseY) {
  const blocked = new Set();
  for (const [dx, dy] of HORSE_MOVES) {
    const x = horseX + dx;
    const y = horseY + dy;
    if (x < 0 || x > n || y < 0 || y > m) continue;
    blocked.add(`${x},${y}`);
  }
  return blocked;
}

export function solve(input) {
  const { n, m, horseX, horseY } = parseInput(input);
  const blocked = buildBlockedSet(n, m, horseX, horseY);
  if (blocked.has('0,0') || blocked.has(`${n},${m}`)) {
    return '0';
  }

  const dp = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0n));
  dp[0][0] = 1n;

  for (let x = 0; x <= n; x += 1) {
    for (let y = 0; y <= m; y += 1) {
      if (x === 0 && y === 0) continue;
      if (blocked.has(`${x},${y}`)) {
        dp[x][y] = 0n;
        continue;
      }
      const fromLeft = y > 0 ? dp[x][y - 1] : 0n;
      const fromUp = x > 0 ? dp[x - 1][y] : 0n;
      dp[x][y] = fromLeft + fromUp;
    }
  }

  return dp[n][m].toString();
}
