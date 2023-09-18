const compareTranspile = require("./compare.js");

describe("variable-scoping", () => {
	test("only generate documentation for top-level variable declarations", () => {
		const input = `
/**
 * Foo
 */
const foo: string = "foo";
{
    /**
     * Bar
     */
    const bar: string = "bar";
}
`;
		const expected = `/**
 * Foo
 * @type {string}
 */
const foo = "foo";
{
    /**
     * Bar
     */
    const bar = "bar";
}
`;
		compareTranspile(input, expected);
	});
});
