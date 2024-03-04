const fs = require("fs");
const path = require("path");
const { transpileProject } = require("../index.js");

beforeAll(() => {
	const tsconfig = path.join(__dirname, "test-project/tsconfig.json");
	return transpileProject(tsconfig, true);
});

describe("project", () => {
	it("doesn't transpile excluded files", () => {
		expect(() => {
			fs.accessSync(path.join(__dirname, "test-project/dist/exclude.js"));
		}).toThrow();
	});

	it("accurately transpiles included files", () => {
		for (const file of fs.readdirSync(path.join(__dirname, "test-project/dist"))) {
			const content = fs.readFileSync(
				path.join(__dirname, `./test-project/dist/${file}`),
				"utf8",
			);
			const expectedContent = fs.readFileSync(
				path.join(__dirname, `./test-project/expected/${file}`),
				"utf8",
			);
			expect(content).toBe(expectedContent);
		}
	});
});
