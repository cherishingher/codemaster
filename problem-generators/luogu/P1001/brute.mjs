export function solve(input) {
  const tokens = String(input)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let total = 0;
  for (const token of tokens.slice(0, 2)) {
    total += Number(token);
  }
  return `${total}`;
}
