import { func } from "./additional";
/**
 * Description goes here
 * @param {Class} [param]
 * @returns {string}
 */
function test(param) {
    return param?.defaultMember.toString(10);
}
/**
 * Object
 * @type {Interface}
 */
const obj = {
    member: "test",
};
func(test() || obj.member);
/**
 * @typedef {Object} Interface
 * @property {string} member Member
 */
