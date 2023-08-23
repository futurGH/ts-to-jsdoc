const compareTranspile = require("./compare.js");

describe("optional-params", () => {
	test("wrap optional parameter names in square brackets", () => {
		const input = `
/**
 * Does stuff.
 */
function doStuff(param?: string): number {
  return 1;
};
`;
		const expected = `/**
 * Does stuff.
 * @param {string} [param]
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
