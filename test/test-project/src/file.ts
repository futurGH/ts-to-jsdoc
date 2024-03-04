import { Class, func } from "./additional";

/** Description goes here */
function test(param?: Class) {
	return param?.defaultMember.toString(10);
}

interface Interface {
	/** Member */
	member: string;
}

/** Object */
const obj: Interface = {
	member: "test",
};

func(test() || obj.member);
