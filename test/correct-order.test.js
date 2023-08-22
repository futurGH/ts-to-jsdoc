const compareTranspile = require('./compare.js');

describe('correct-order', () => {
  test('correctly order params vs returns', () => {
    const input = `
/**
 * Does stuff.
 * @returns {number}
 * @param {string} param - A parameter.
 */
function doStuff(param: string): number {
  return 1;
};
`;
    const expected = `/**
 * Does stuff.
 * @param {string} param - A parameter.
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
