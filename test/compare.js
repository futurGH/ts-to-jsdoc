const { transpileFile } = require("../index.js");

/**
 * Compare the transpiled output of the input to the expected output.
 * @param {string} input The input to transpile.
 * @param {string} expected The expected output.
 * @param {string} tsVersion The TypeScript version to use. Defaults to 4.9.
 */
function compareTranspile(input, expected, tsVersion = "4.9") {
	const actual = transpileFile({ code: input, tsVersion });

	expect(actual).toBe(expected);
}

module.exports = compareTranspile;
