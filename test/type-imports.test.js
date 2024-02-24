const compareTranspile = require("./compare.js");

describe("type-imports", () => {
	test("document default type imports", () => {
		const input = `
import type ts from "ts-morph";
`;
		const expected = `/** @typedef {import('ts-morph')} ts */

export {};
`;
		compareTranspile(input, expected);
	});

	test("document named type imports", () => {
		const input = `
import type { ts } from "ts-morph";
`;
		const expected = `/** @typedef {import('ts-morph').ts} ts */

export {};
`;
		compareTranspile(input, expected);
	});

	test("document named type imports with alias", () => {
		const input = `
import type { ts as TypeScript } from "ts-morph";
`;
		const expected = `/** @typedef {import('ts-morph').ts} TypeScript */

export {};
`;
		compareTranspile(input, expected);
	});
});
