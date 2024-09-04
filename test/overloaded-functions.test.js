const compareTranspile = require("./compare.js");

describe("overloaded-functions", () => {
	test("wrap optional parameter names in square brackets", () => {
		const input = `
/**
 * Adds two strings together
 */ 
function add(a:string, b:string):string;

/**
 * Adds two numbers together
 */ 
function add(a:number, b:number): number;

/**
 * Adds two items together
 */ 
function add(a: any, b:any): any {
    return a + b;
}
`;
		const expected = `/**
 * Adds two strings together
 * @overload
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
/**
 * Adds two numbers together
 * @overload
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
/**
 * Adds two items together
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function add(a, b) {
    return a + b;
}
`;
		compareTranspile(input, expected);
	});

	test("wrap optional parameter names in square brackets", () => {
		const input = `
/**
 * Creates a curried function to cause an entity to speak.
 *
 * @see {@link speak}
 * @param speech The content to speak.
 * @returns A curried function.
 */
export function speak(speech: string): <T extends {say: (text: string) => void}>(entity: T) => Promise<void>;

/**
 * Causes an entity to speak.
 *
 * @see {@link speak}
 * @param speech The content to speak.
 * @param entity The entity to trigger the speech from.
 * @returns The resulting promise, which resolves when complete.
 */
export function speak<T extends {say: (text: string) => void}>(speech: string, entity: T): Promise<void>;

/**
 * Causes an entity to speak.
 *
 * @param speech The content to speak.
 * @param entity The entity to trigger the speech from.
 * @returns The resulting promise, which resolves when complete.
 */
export function speak(speech: any, entity: any) {
		return entity.say(speech)
}
`;
		const expected = `/**
 * Creates a curried function to cause an entity to speak.
 *
 * @overload
 * @see {@link speak}
 * @param {string} speech The content to speak.
 * @returns {<T extends {say: (text: string) => void}>(entity: T) => Promise<void>} A curried function.
 */
/**
 * Causes an entity to speak.
 *
 * @overload
 * @see {@link speak}
 * @template {{say: (text: string) => void}} T
 * @param {string} speech The content to speak.
 * @param {T} entity The entity to trigger the speech from.
 * @returns {Promise<void>} The resulting promise, which resolves when complete.
 */
/**
 * Causes an entity to speak.
 * @param {any} speech The content to speak.
 * @param {any} entity The entity to trigger the speech from.
 * @returns {any} The resulting promise, which resolves when complete.
 */
export function speak(speech, entity) {
    return entity.say(speech);
}
`;
		compareTranspile(input, expected);
	});
});
