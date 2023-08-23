const compareTranspile = require("./compare.js");

describe("remove-optional-wrapper", () => {
	test("remove incorrect optional parameter indicator", () => {
		const input = `
/**
 * Does stuff.
 * @param {string} [param] - A parameter.
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
