export function func(param1: string | undefined, param2 = 1, param3?: boolean) {
	return param1;
}

export class Class {
	defaultMember = 1;

	optional?: boolean;

	definite!: boolean;

	constructor(param: string) {
		this.optional = !!param;
	}
}

export type Type = "1" | "2";
