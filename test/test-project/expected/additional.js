/**
 * @param {string | undefined} param1
 * @param {number} [param2=1]
 * @param {boolean} [param3]
 * @returns {string}
 */
export function func(param1, param2 = 1, param3) {
    return param1;
}
export class Class {
    /** @default 1 */
    defaultMember = 1;
    optional;
    definite;
    constructor(param) {
        this.optional = !!param;
    }
}
/** @typedef {"1" | "2"} Type */
