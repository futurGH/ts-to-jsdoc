const compareTranspile = require("./compare.js");

describe("var declaration properties", () => {
	test("variables are correctly documented", () => {
		const input = `
/**
 * My property
 */
export const myProperty: string = null;

export const anotherProperty: 'small'|'large' = 'small';
`;
		const expected = `/**
 * My property
 * @type {string}
 */
export const myProperty = null;

/** @type {'small'|'large'} */
export const anotherProperty = 'small';
`;
		compareTranspile(input, expected);
	});
	test("types already documented are not overwritten", () => {
		const input = `
/**
 * My property
 * @type {'a'|'b'}
 */
export const myProperty = 'a';
`;
		const expected = `/**
 * My property
 * @type {'a'|'b'}
 */
export const myProperty = 'a';
`;
		compareTranspile(input, expected);
	});
});
