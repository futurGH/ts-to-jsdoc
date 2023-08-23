const compareTranspile = require('./compare.js');

describe('preserve-param-desc-dash', () => {
  test('Dont add/remove dashes preceeding the description', () => {
    const input = `
/**
 * Does stuff.
 * @param p1 description a
 * @param p2 - description b
 * @returns {number} the return type
 */
function doStuff(p1: string, p2: string): number {
  return 1;
};
`;
    const expected = `/**
 * Does stuff.
 * @param {string} p1 description a
 * @param {string} p2 - description b
 * @returns {number} the return type
 */
function doStuff(p1, p2) {
    return 1;
}
;
`;
    compareTranspile(input, expected);
  });
});
