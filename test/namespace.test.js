const compareTranspile = require("./compare.js");

describe("namespace", () => {
	test("namespaces with value elements are correctly generated", () => {
		const input = `
/** Namespace description */
export namespace Example {
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

  /** Variable description */
  export const SubConstant: number = 5

  /** Variable description */
  export var SubVariable: number = 5

  /** Class description */
  export class SubClass extends Error {}

  /** Function description */
  export function SubFunction() {}

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
export var Example;
(function (Example) {
    /**
       * Variable description
       * @type {number}
       */
    Example.SubConstant = 5;
    /**
       * Variable description
       * @type {number}
       */
    Example.SubVariable = 5;
    /**
       * Class description
       * @extends Error
       */
    class SubClass extends Error {
    }
    Example.SubClass = SubClass;
    /**
       * Function description
       * @returns {void}
       */
    function SubFunction() { }
    Example.SubFunction = SubFunction;
})(Example || (Example = {}));
/**
 * Type description
 * @typedef {Object} Example.SubType
 * @property {string} name Property description
 */
/**
 * Interface description
 * @typedef {Object} Example.SubInterface
 * @property {string} label Property description
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
