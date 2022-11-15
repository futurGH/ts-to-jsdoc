# TypeScript to JSDoc
Transpile TypeScript code annotated with JSDoc to fully compatible JavaScript code, preserving your documentation.

## Usage

### Command Line

```shell
$ ts-to-jsdoc

Usage:
  ts-to-jsdoc [options] <path>...

Options:
  -h --help          Shows this.
  -o --out --output  Directory to output transpiled JavaScript. [default: source path]
  -i --ignore        File or directory paths to ignore when transpiling.
  -f --force         Overwrite existing output files.
```

### Node.js

```javascript
const transpile = require("ts-to-jsdoc");
// or
import transpile from "ts-to-jsdoc";

const code = `
/**
 * Does stuff.
 * @param param It's a parameter.
 */
function doStuff(param: string): number {}
`;

const transpiledCode = transpile(code);
// Output:
// /**
//  * Does stuff.
//  * @param {string} param It's a parameter.
//  * @returns {number}
//  */
// function doStuff(param) {}
```

## License
[MIT](LICENSE) © [futurGH](https://github.com/futurGH).
