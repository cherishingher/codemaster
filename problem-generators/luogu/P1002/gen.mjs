function formatCase(n, m, horseX, horseY) {
  return `${n} ${m} ${horseX} ${horseY}\n`;
}

function randomCase(randInt, maxCoordinate) {
  const n = randInt(0, maxCoordinate);
  const m = randInt(0, maxCoordinate);
  const horseX = randInt(0, n);
  const horseY = randInt(0, m);
  return formatCase(n, m, horseX, horseY);
}

export function generate(context) {
  const { group, helpers, phase } = context;
  const { randInt, randPick } = helpers;

  if (group.name === 'small-random') {
    const limit = phase === 'verify-generated' ? 8 : 12;
    return randomCase(randInt, limit);
  }

  if (group.name === 'edge') {
    const verifyCases = [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [2, 2, 1, 1],
      [2, 3, 0, 1],
      [3, 2, 1, 0],
      [4, 4, 2, 2],
      [5, 0, 0, 0],
      [0, 5, 0, 0],
    ];
    const generateCases = [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [2, 2, 1, 1],
      [5, 5, 0, 0],
      [6, 6, 3, 3],
      [10, 10, 5, 5],
      [20, 20, 0, 0],
      [20, 20, 10, 10],
      [20, 20, 1, 2],
      [20, 20, 19, 18],
      [20, 0, 10, 0],
      [0, 20, 0, 10],
      [20, 1, 1, 1],
      [1, 20, 1, 1],
    ];
    const cases = phase === 'verify-generated' ? verifyCases : generateCases;
    const [n, m, horseX, horseY] = randPick(cases);
    return formatCase(n, m, horseX, horseY);
  }

  if (group.name === 'stress') {
    const n = randInt(16, 20);
    const m = randInt(16, 20);
    const horseX = randInt(0, n);
    const horseY = randInt(0, m);
    return formatCase(n, m, horseX, horseY);
  }

  return randomCase(randInt, 6);
}
