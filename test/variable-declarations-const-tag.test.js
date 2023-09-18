const compareTranspile = require("./compare.js");

describe("variable-declarations-const-tag", () => {
	test("don't create @type tag when @const is present with value", () => {
		const input = `
/**
 * Foo
 * @const {string}
 */
const foo = "foo";
`;
		const expected = `/**
 * Foo
 * @const {string}
 */
const foo = "foo";
`;
		compareTranspile(input, expected);
	});

	test("create @type tag when @const is present without value", () => {
		const input = `
/**
 * Foo
 * @const
 */
const foo: string = "foo";
`;
		const expected = `/**
 * Foo
 * @const
 * @type {string}
 */
const foo = "foo";
`;
		compareTranspile(input, expected);
	});
});
