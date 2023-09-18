const compareTranspile = require("./compare.js");

describe("variable-declarations", () => {
	test("document all types of variables", () => {
		const input = `
/** Foo */
let foo: string = "foo";

/** Bar */
const bar: number = 1;

/** Baz */
var baz: boolean = true;
`;
		const expected = `/**
 * Foo
 * @type {string}
 */
let foo = "foo";

/**
 * Bar
 * @type {number}
 */
const bar = 1;

/**
 * Baz
 * @type {boolean}
 */
var baz = true;
`;
		compareTranspile(input, expected);
	});

	test("don't overwrite existing type tags", () => {
		const input = `
/**
 * Foo
 * @type {string | number}
 */
const foo: string = "foo";
`;
		const expected = `/**
 * Foo
 * @type {string | number}
 */
const foo = "foo";
`;
		compareTranspile(input, expected);
	});

	test("don't generate documentation for variable declarations without existing JSDoc", () => {
		const input = `
const foo: string = "foo";
/**
 * Bar
 */
const bar: string = "bar";
`;
		const expected = `const foo = "foo";
/**
 * Bar
 * @type {string}
 */
const bar = "bar";
`;
		compareTranspile(input, expected);
	});
});
