const compareTranspile = require('./compare.js');

describe('remove-obsolete-params', () => {
  test('remove obsolete params', () => {
    const input = `
/**
 * Does stuff.
 * @param {number} somethingWrong
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
