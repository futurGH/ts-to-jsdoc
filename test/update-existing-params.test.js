const compareTranspile = require("./compare.js");

describe("update-existing-params", () => {
	test("update existing param tag with new type", () => {
		const input = `
/**
 * Does stuff.
 * @param {number} param - A parameter.
 */
function doStuff(param?: string): number {
  return 1;
};
`;
		const expected = `/**
 * Does stuff.
 * @param {string} [param] - A parameter.
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
