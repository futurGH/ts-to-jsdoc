const compareTranspile = require('./compare.js');

describe('inferred-return-type', () => {
  test('Correctly give an inferred return type of a function', () => {
    const input = `
/**
 * Does stuff.
 */
function doStuff(param: string) {
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
