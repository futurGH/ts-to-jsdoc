# TypeScript to JSDoc
Transpile TypeScript code annotated with JSDoc to fully compatible JavaScript code, preserving your documentation.

### A NOTE
This program's primary purpose is to transpile TypeScript so that it can be used with documentation generators that expect JavaScript code. Any other use case is not intended and unsupported. (though I would love to see how else this can be used!)

## Usage

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
