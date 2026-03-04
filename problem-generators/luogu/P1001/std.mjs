export function solve(input) {
  const values = String(input)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
  const [a = 0, b = 0] = values;
  return `${a + b}`;
}
