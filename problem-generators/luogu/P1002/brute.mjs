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

function dfs(x, y, n, m, blocked) {
  if (x > n || y > m) return 0n;
  if (blocked.has(`${x},${y}`)) return 0n;
  if (x === n && y === m) return 1n;
  return dfs(x + 1, y, n, m, blocked) + dfs(x, y + 1, n, m, blocked);
}

export function solve(input) {
  const { n, m, horseX, horseY } = parseInput(input);
  const blocked = buildBlockedSet(n, m, horseX, horseY);
  return dfs(0, 0, n, m, blocked).toString();
}
