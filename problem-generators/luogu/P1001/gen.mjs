export function generate(context) {
  const { group, helpers } = context;
  const randInt = helpers.randInt;

  if (group.name === 'small-random') {
    return `${randInt(-1000, 1000)} ${randInt(-1000, 1000)}\n`;
  }

  if (group.name === 'edge') {
    const edges = [
      [-1000000000, -1000000000],
      [1000000000, 1000000000],
      [1000000000, -1000000000],
      [0, 0],
      [-1, 1],
      [123456789, 987654321],
      [-999999999, 1],
      [1, -999999999]
    ];
    const pair = helpers.randPick(edges);
    return `${pair[0]} ${pair[1]}\n`;
  }

  if (group.name === 'stress') {
    return `${randInt(-2000000000, 2000000000)} ${randInt(-2000000000, 2000000000)}\n`;
  }

  return `${randInt(-100, 100)} ${randInt(-100, 100)}\n`;
}
