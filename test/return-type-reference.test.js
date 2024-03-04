const compareTranspile = require("./compare.js");

describe("return-type-reference", () => {
	// GH #21
	test("correctly references return type as written", () => {
		const input = `export interface SomeType {
  someKey: string;
}

export function someFunction(someString: string): SomeType {
    return { someKey: someString };
}
`;
		const expected = `/**
 * @param {string} someString
 * @returns {SomeType}
 */
export function someFunction(someString) {
    return { someKey: someString };
}
/**
 * @typedef {Object} SomeType
 * @property {string} someKey
 */
`;
		compareTranspile(input, expected);
	});
});
