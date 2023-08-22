const compareTranspile = require('./compare.js');

describe('arrow-functions', () => {
  test('arrow functions', () => {
    const input = `
/**
 * Does stuff.
 */
const doStuff = (param: string): number => {
  return 1;
};
`;
    const expected = `/**
 * Does stuff.
 * @param {string} param
 * @returns {number}
 */
const doStuff = (param) => {
    return 1;
};
`;
    compareTranspile(input, expected);
  });
});
