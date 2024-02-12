const compareTranspile = require("./compare.js");

describe("object-type-aliases", () => {
	test("transpile object literal type aliases", () => {
		const input = `
type Test = {
    prop: string;
};
`;
		const expected = `/**
 * @typedef {Object} Test
 * @property {string} prop 
 */
`;
		compareTranspile(input, expected);
	});
	test("preserve object literal type alias property comments", () => {
		const input = `
type Test = {
    /**
     * Comment
     * @deprecated
     */
    prop: string;
};
`;
		const expected = `/**
 * @typedef {Object} Test
 * @property {string} prop Comment
 */
`;
		compareTranspile(input, expected);
	});
	test("treat object literal union and intersection as regular aliases", () => {
		const input = `
type Test1 = { prop: string } & { prop2: number };
type Test2 = { prop: string } | { prop2: number };
`;
		const expected = `/** @typedef {{ prop: string } & { prop2: number }} Test1 */
/** @typedef {{ prop: string } | { prop2: number }} Test2 */
`;
		compareTranspile(input, expected);
	});
});
