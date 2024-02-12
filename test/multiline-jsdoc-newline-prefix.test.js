const compareTranspile = require("./compare.js");

describe("multiline-jsdoc-newline-prefix", () => {
	test("functions receive JSDoc with leading newline", () => {
		const input = `
function foo(param: string) {
	return 1;
}
const bar = (param?: boolean) => "bar";
function baz() {
	return 0;
}
`;
		const expected = `/**
 * @param {string} param
 * @returns {number}
 */
function foo(param) {
    return 1;
}
/**
 * @param {boolean} [param]
 * @returns {string}
 */
const bar = (param) => "bar";
/**
 * @returns {number}
 */
function baz() {
    return 0;
}
`;
		compareTranspile(input, expected);
	});

	test("classes receive single-line JSDoc", () => {
		const input = `
class Test {}
class Test2 extends Test {}
`;
		const expected = `/** */
class Test {
}
/** @extends Test */
class Test2 extends Test {
}
`;
		compareTranspile(input, expected);
	});

	test("type aliases receive single-line JSDoc", () => {
		const input = `
type Alias = Array<unknown>;
`;
		const expected = `/** @typedef {Array<unknown>} Alias */
`;
		compareTranspile(input, expected);
	});

	test("type aliases with generics or properties receive JSDoc with leading newline", () => {
		const input = `
type ConditionalWithGeneric<T> = T extends string ? T : Array<T>;
type ObjectType = {
	foo: string;
	bar: number;
}
`;
		const expected = `/**
 * @typedef {T extends string ? T : Array<T>} ConditionalWithGeneric
 * @template T
 */
/**
 * @typedef {Object} ObjectType
 * @property {string} foo
 * @property {number} bar 
 */
`;
		compareTranspile(input, expected);
	});

	test("interface declarations receive JSDoc with leading newline", () => {
		const input = `
interface SomeType {
	someKey: string;
}
`;
		const expected = `/**
 * @typedef {Object} SomeType
 * @property {string} someKey 
 */
`;
		compareTranspile(input, expected);
	});
});
