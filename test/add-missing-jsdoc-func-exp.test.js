const compareTranspile = require("./compare.js");

describe("add-missing-jsdoc-func-exp", () => {
	test("JSDoc node is added to variable containing a function expression", () => {
		const input = "const doStuff = (param: string): number => 1;";
		const expected = `/** @param {string} param
 * @returns {number}
 */
const doStuff = (param) => 1;
`;
		compareTranspile(input, expected);
	});
});
