const { transpileFile } = require("../index.js");

/**
 * Compare the transpiled output of the input to the expected output.
 * @param {string} input The input to transpile.
 * @param {string} expected The expected output.
 */
function compareTranspile(input, expected) {
	const actual = transpileFile({ code: input });

	expect(actual).toBe(expected);
}

module.exports = compareTranspile;
