const compareTranspile = require("./compare.js");

describe("type-imports", () => {
	describe("uses @typedef for TS versions < 5.5", () => {
		test("document default type imports", () => {
			const input = `
import type ts from "ts-morph";
`;
			const expected = `/** @typedef {import('ts-morph')} ts */
export {};
`;
			compareTranspile(input, expected, "5.4");
		});

		test("document named type imports", () => {
			const input = `
import type { ts } from "ts-morph";
`;
			const expected = `/** @typedef {import('ts-morph').ts} ts */
export {};
`;
			compareTranspile(input, expected, "5.4");
		});

		test("document named type imports with alias", () => {
			const input = `
import type { ts as TypeScript } from "ts-morph";
`;
			const expected = `/** @typedef {import('ts-morph').ts} TypeScript */
export {};
`;
			compareTranspile(input, expected, "5.4");
		});

		test("document named type imports but not default value import", () => {
			const input = `
import ts, { type Node } from "ts-morph";
`;
			const expected = `/** @typedef {import('ts-morph').Node} Node */
export {};
`;
			compareTranspile(input, expected, "5.4");
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
			compareTranspile(input, expected, "5.4");
		});
	});
	describe("uses @import for TS versions >= 5.5", () => {
		test("document default type imports", () => {
			const input = `
import type ts from "ts-morph";
`;
			const expected = `/** @import ts from 'ts-morph' */
export {};
`;
			compareTranspile(input, expected, "5.5");
		});

		test("document named type imports", () => {
			const input = `
import type { ts } from "ts-morph";
`;
			const expected = `/** @import { ts } from 'ts-morph' */
export {};
`;
			compareTranspile(input, expected, "5.5");
		});

		test("document named type imports with alias", () => {
			const input = `
import type { ts as TypeScript } from "ts-morph";
`;
			const expected = `/** @import { ts as TypeScript } from 'ts-morph' */
export {};
`;
			compareTranspile(input, expected, "5.5");
		});

		test("document named type imports but not default value import", () => {
			const input = `
import ts, { type Node } from "ts-morph";
`;
			const expected = `/** @import { Node } from 'ts-morph' */
export {};
`;
			compareTranspile(input, expected, "5.5");
		});

		test("document value imports if used only in a type position", () => {
			const input = `
import { Node } from "ts-morph";
function foo(node: Node) {}
	`;
			const expected = `/** @import { Node } from 'ts-morph' */
/**
 * @param {Node} node
 * @returns {void}
 */
function foo(node) { }
export {};
`;
			compareTranspile(input, expected, "5.5");
		});
	});
});
