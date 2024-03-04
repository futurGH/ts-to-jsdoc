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

	test("document named type imports but not default value import", () => {
		const input = `
import ts, { type Node } from "ts-morph";
`;
		const expected = `/** @typedef {import('ts-morph').Node} Node */
export {};
`;
		compareTranspile(input, expected);
	});

	test("document value imports if used only in a type position", () => {
		const input = `
import { Node } from "ts-morph";
function foo(node: Node) {}
`;
		const expected = `/** @typedef {import('ts-morph').Node} Node */
/**
 * @param {Node} node
 * @returns {void}
 */
function foo(node) { }
export {};
`;
		compareTranspile(input, expected);
	});
});
