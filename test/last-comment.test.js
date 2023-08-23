const compareTranspile = require("./compare.js");

describe("last-comment", () => {
	test("update nearest JSDoc", () => {
		const input = `
/**
 * A random orphan JSDoc comment.
 */
/**
 * Does stuff.
 */
function doStuff(param: string): number {
  return 1;
};
`;
		const expected = `/**
 * A random orphan JSDoc comment.
 */
/**
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
