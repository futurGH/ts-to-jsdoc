const compareTranspile = require('./compare.js');

describe('basic', () => {
  test('basic', () => {
    const input = `
/**
 * Does stuff.
 */
function doStuff(param: string): number {
  return 1;
};
`;
    const expected = `/**
 * Does stuff.
 * @param {string} param
 * @returns {number}
 */
function doStuff(param) {
    return 1;
}
;
`;
    compareTranspile(input, expected);
  });
});
