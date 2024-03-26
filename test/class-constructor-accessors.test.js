const compareTranspile = require("./compare.js");

describe("class-constructor-accessors", () => {
	test("class constructor and accessors are correctly documented", () => {
		const input = `
class Test {
    constructor(
        one: string,
        two: number
    );

    constructor(
        one: string,
        two: number,
        three: boolean
    );

    /**
     * @param baz test
     */
    constructor(
        public foo: string,
        bar: number,
        private baz?: boolean,
    ) {}

    /** Test */
    get foobar() {
        return parseFloat(this.foo);
    }

    set foobar(value: number) {
        this.foo = value.toString();
    }
}
`;
		const expected = `class Test {
    foo;
    baz;
    /** @param {string} foo
     * @param {number} bar
     * @param {boolean} [baz] test
     */
    constructor(foo, bar, baz) {
        this.foo = foo;
        this.baz = baz;
    }
    /**
     * Test
     * @returns {number}
     */
    get foobar() {
        return parseFloat(this.foo);
    }
    /**
     * @param {number} value
     */
    set foobar(value) {
        this.foo = value.toString();
    }
}
`;
		compareTranspile(input, expected);
	});
});
