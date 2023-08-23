const transpile = require('../index.js');

function compareTranspile(input, expected) {
  // @ts-ignore
  const actual = transpile(input);

  expect(actual).toBe(expected);
}

module.exports = compareTranspile;
