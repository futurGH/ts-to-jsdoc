const compareTranspile = require("./compare.js");

describe("default-values", () => {
	test("document param default values", () => {
		const input = `
/**
 * Does stuff. 1
 * @param p1 the first parameter
*/
function doStuff1(p1: string, p2?: number, p3: string = 'defaultValue'): number {
  return 1;
};

/**
 * Does stuff. 2
 * @param p1 the first parameter
 */
const doStuff2 = (q1: string, q2: boolean = false, q3: number = 123): number => 2;

type MyFunc = (p: any) => number;
const myFunc: MyFunc = (p: any) => 0;
/**
 * Does stuff. 3
 */
const doStuff3 = (f1: MyFunc = myFunc, f2: MyFunc = (p: any) => 0, f3: MyFunc = (p: any) => {
  myFunc(1);
  return 0;
}): number => 3;
`;
		const expected = `/**
 * Does stuff. 1
 * @param {string} p1 the first parameter
 * @param {number} [p2]
 * @param {string} [p3='defaultValue']
 * @returns {number}
 */
function doStuff1(p1, p2, p3 = 'defaultValue') {
    return 1;
}
;

/**
 * Does stuff. 2
 * @param {string} q1
 * @param {boolean} [q2=false]
 * @param {number} [q3=123]
 * @returns {number}
 */
const doStuff2 = (q1, q2 = false, q3 = 123) => 2;
/** @param {any} p
 * @returns {number}
 */
const myFunc = (p) => 0;
/**
 * Does stuff. 3
 * @param {MyFunc} [f1=myFunc]
 * @param {MyFunc} [f2=(p: any) => 0]
 * @param {MyFunc} [f3=(p: any) => { myFunc(1); return 0; }]
 * @returns {number}
 */
const doStuff3 = (f1 = myFunc, f2 = (p) => 0, f3 = (p) => {
    myFunc(1);
    return 0;
}) => 3;



/** @typedef {(p: any) => number} MyFunc */
`;
		compareTranspile(input, expected);
	});
});
