const compareTranspile = require("./compare.js");

describe("rest-params", () => {
	test("handle rest parameters", () => {
		const input = `
/**
 * Does stuff.
 */
const doStuff = (p1: string, ...nums: number[]): number => 3;
`;
		const expected = `/**
 * Does stuff.
 * @param {string} p1
 * @param {...number} [nums]
 * @returns {number}
 */
const doStuff = (p1, ...nums) => 3;
`;
		compareTranspile(input, expected);
	});
});
