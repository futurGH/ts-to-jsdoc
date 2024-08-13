const compareTranspile = require("./compare.js");

describe("namespace", () => {
	test("namespaces are correctly generated", () => {
		const input = `
/** Namespace description */
export namespace Example {
  /** Sub namespace description */
  export namespace SubNamespace {
    /** Type description */
    export type SubType = {
      /** Property description */
      name: string
    }

    /** Interface description */
    export interface SubInterface {
      /** Property description */
      label: string;
    }
  }
}
`;
		const expected = `/**
 * Namespace description
 * @namespace Example
 */
/**
 * Sub namespace description
 * @namespace Example.SubNamespace
 */
/**
 * Type description
 * @typedef {Object} Example.SubNamespace.SubType
 * @property {string} name Property description
 */
/**
 * Interface description
 * @typedef {Object} Example.SubNamespace.SubInterface
 * @property {string} label Property description
 */
`;
		compareTranspile(input, expected);
	});
});
