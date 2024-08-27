# TypeScript to JSDoc
Transpile TypeScript code annotated with JSDoc to fully compatible JavaScript code, preserving your documentation.

Demo by [@smacpherson64](https://github.com/smacpherson64): [TypeScript to JSDoc](https://sethmac.com/typescript-to-jsdoc/)

## Usage

### Command Line

```shell
$ ts-to-jsdoc

Usage:
  ts-to-jsdoc [options] <path>...
  ts-to-jsdoc -p path/to/tsconfig.json

Options:
  -h --help          Shows this.
  -p --project       Path to tsconfig.json.
  -o --out --output  Directory to output transpiled JavaScript. [default: source path, ignored if project is set]
  -i --ignore        File or directory paths to ignore when transpiling. [ignored if project is set]
  -f --force         Overwrite existing output files. [ignored if project is set]
```

### Node.js

```javascript
const { transpileFile, transpileProject } = require("ts-to-jsdoc");
// or
import { transpileFile, transpileProject } from "ts-to-jsdoc";

const code = `
/**
 * Does stuff.
 * @param param It's a parameter.
 */
function doStuff(param: string): number { }
`;

const transpiledCode = transpileFile({ code: code });
// Output:
// /**
//  * Does stuff.
//  * @param {string} param It's a parameter.
//  * @returns {number}
//  */
// function doStuff(param) { }

/* Or you can transpile an entire project at once */
transpileProject({ project: "path/to/tsconfig.json" });
```

## License
[MIT](LICENSE) © [futurGH](https://github.com/futurGH).
