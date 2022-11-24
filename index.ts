import path from "path";

import {
	Project,
	ScriptTarget,
	Node,
} from "ts-morph";

import type {
	ClassDeclaration,
	FunctionLikeDeclaration,
	InterfaceDeclaration,
	JSDoc,
	JSDocableNode,
	MethodDeclaration,
	ModifierableNode,
	PropertyAssignment,
	PropertyDeclaration,
	PropertySignature,
	SourceFile,
	TypeAliasDeclaration,
	TypedNode,
} from "ts-morph";

declare module "ts-morph" {
	// eslint-disable-next-line no-shadow
	namespace Node {
		let isObjectProperty: (node: Node) => boolean;
	}
}
Node.isObjectProperty = (node): node is ObjectProperty => (
	Node.isPropertyDeclaration(node)
	|| Node.isPropertyAssignment(node)
	|| Node.isPropertySignature(node)
);

type ObjectProperty = JSDocableNode & TypedNode & (
	| PropertyDeclaration
	| PropertyAssignment
	| PropertySignature
);
type ClassMemberNode = JSDocableNode & ModifierableNode & ObjectProperty & MethodDeclaration;

/** Get children for object node */
function getChildProperties(node: Node): ObjectProperty[] {
	const properties = node?.getType()?.getProperties();
	const valueDeclarations = properties.map((child) => child.getValueDeclaration())
		// Hacky way to check if the child is actually a defined child in the interface
		// or if it's, e.g. a built-in method of the type (such as array.length)
		?.filter((child) => node.getFullText().includes(child?.getFullText()));
	return (valueDeclarations ?? []) as ObjectProperty[];
}

/** Get JSDoc for a node or create one if there isn't any */
function getJsDocOrCreate(node: JSDocableNode): JSDoc {
	return node.getJsDocs()[0] || node.addJsDoc({});
}

/** Sanitize a string to use as a type in a doc comment so that it is compatible with JSDoc */
function sanitizeType(str: string): string | null {
	if (!str) return null;
	// Convert `typeof MyClass` syntax to `Class<MyClass>`
	const extractedClassFromTypeof = /{*typeof\s+([^(?:}|\s);]*)/gm.exec(str)?.[1];
	if (extractedClassFromTypeof) str = `Class<${extractedClassFromTypeof}>`;
	return str;
}

/**
 * Generate @param documentation from function parameters, storing it in functionNode
 */
function generateParameterDocumentation(functionNode: FunctionLikeDeclaration): void {
	const params = functionNode.getParameters();
	for (const param of params) {
		const parameterType = sanitizeType(param.getTypeNode()?.getText());
		if (!parameterType) continue;
		// Get param tag that matches the param
		const jsDoc = getJsDocOrCreate(functionNode);
		const paramTag = (jsDoc.getTags() || [])
			.filter((tag) => ["param", "parameter"].includes(tag.getTagName()))
			// @ts-ignore
			.find((tag) => tag.compilerNode.name?.getText() === param.getName());

		const paramNameRaw = param.compilerNode.name?.getText();
		// Skip parameter names if they are present in the type as an object literal
		// e.g. destructuring; { a }: { a: string }
		const paramName = paramNameRaw.match(/[{},]/) ? "" : ` ${paramNameRaw}`;
		if (paramTag) {
			// Replace tag with one that contains type info
			const comment = paramTag.getComment();
			const tagName = paramTag.getTagName();

			paramTag.replaceWithText(`@${tagName} {${parameterType}}${paramName}  ${comment}`);
		} else {
			jsDoc.addTag({
				tagName: "param",
				text: `{${parameterType}}${paramName}`,
			});
		}
	}
}

/**
 * Generate @returns documentation from function return type, storing it in functionNode
 */
function generateReturnTypeDocumentation(functionNode: FunctionLikeDeclaration): void {
	const functionReturnType = sanitizeType(functionNode.getReturnType()?.getText());
	const jsDoc = getJsDocOrCreate(functionNode);
	const returnsTag = (jsDoc?.getTags() || [])
		.find((tag) => ["returns", "return"].includes(tag.getTagName()));
	// Replace tag with one that contains type info if tag exists
	if (returnsTag) {
		const tagName = returnsTag.getTagName();
		const comment = returnsTag.getComment();
		// https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler#return-type-description
		if (functionReturnType !== "void") {
			returnsTag.replaceWithText(
				`@${tagName} {${functionReturnType}}${comment ? ` ${comment}` : ""}`,
			);
		}
	} else {
		// Otherwise, create a new one
		jsDoc.addTag({
			tagName: "returns",
			text: `{${functionReturnType}}`,
		});
	}
}

/**
 * Generate documentation for a function, storing it in functionNode
 */
function generateFunctionDocumentation(functionNode: FunctionLikeDeclaration): void {
	generateParameterDocumentation(functionNode);
	generateReturnTypeDocumentation(functionNode);
}

/** Generate modifier documentation for class member */
function generateModifierDocumentation(classMemberNode: ClassMemberNode): void {
	const modifiers = classMemberNode.getModifiers() || [];
	for (const modifier of modifiers) {
		const text = modifier?.getText();
		if (["public", "private", "protected", "readonly", "static"].includes(text)) {
			const jsDoc = getJsDocOrCreate(classMemberNode);
			jsDoc.addTag({ tagName: text });
		}
	}
}

/**
 * Create class property initializer in constructor if it doesn't exist
 * so that documentation is preserved when transpiling
 */
function generateInitializerDocumentation(classPropertyNode: ObjectProperty): void {
	const jsDoc = getJsDocOrCreate(classPropertyNode);
	if (!classPropertyNode.getStructure()?.initializer) {
		classPropertyNode.setInitializer("undefined");
	}
	const initializer = classPropertyNode.getStructure()?.initializer;
	if (initializer !== "undefined") {
		jsDoc.addTag({ tagName: "default", text: initializer });
	}
}

/** Document the class itself; at the moment just its extends signature */
function generateClassBaseDocumentation(classNode: ClassDeclaration) {
	const jsDoc = getJsDocOrCreate(classNode);
	const extendedClass = classNode.getExtends();
	if (extendedClass) {
		jsDoc.addTag({ tagName: "extends", text: extendedClass.getText() });
	}
}

/** Generate documentation for class members in general; either property or method */
function generateClassMemberDocumentation(classMemberNode: ClassMemberNode): void {
	generateModifierDocumentation(classMemberNode);
	Node.isObjectProperty(classMemberNode) && generateInitializerDocumentation(classMemberNode);
	Node.isMethodDeclaration(classMemberNode) && generateFunctionDocumentation(classMemberNode);
}

/** Generate documentation for a class — itself and its members */
function generateClassDocumentation(classNode: ClassDeclaration): void {
	generateClassBaseDocumentation(classNode);
	classNode.getMembers().forEach(generateClassMemberDocumentation);
}

/**
 * Generate @typedefs from type aliases
 * @return A JSDoc comment containing the typedef
 */
function generateTypedefDocumentation(
	typeNode: TypeAliasDeclaration,
	sourceFile: SourceFile,
): string {
	// Create dummy node to assign typedef documentation to
	// (will be deleted afterwards)
	const name = typeNode.getName();
	let { type } = typeNode.getStructure();
	if (typeof type !== "string") return;
	type = sanitizeType(type);
	const dummyNode = sourceFile.addVariableStatement({
		declarations: [{
			name: `__dummy${name}`,
			initializer: "null",
		}],
	});
	const jsDoc = dummyNode.addJsDoc({
		tags: [{
			tagName: "typedef",
			text: `{${type}} ${name}`,
		}],
	}).getText();
	dummyNode.remove();
	return jsDoc;
}

/**
 * Generate documentation for object properties; runs recursively for nested objects
 * @param node
 * @param jsDoc
 * @param [name=""] The name to assign child docs to;
 *		"obj" will generate docs for "obj.val1", "obj.val2", etc
 * @param [topLevelCall=true] recursive functions are funky
 */
function generateObjectPropertyDocumentation(
	node: ObjectProperty,
	jsDoc: JSDoc,
	name = "",
	topLevelCall = true,
): void {
	name = name || node.getName();
	if (!topLevelCall) name = `${name}.${node.getName()}`;
	let propType = node.getTypeNode()
		?.getText()
		?.replace(/\n/g, "")
		?.replace(/\s/g, "");
	propType = sanitizeType(propType);

	const isOptional = node.hasQuestionToken()
		|| node.getJsDocs()
			?.[0]
			?.getTags()
			?.some((tag) => tag.getTagName() === "optional");
	// Copy over existing description if there is one
	const existingPropDocs = node.getJsDocs()?.[0]?.getDescription() || "";
	const children = getChildProperties(node);

	if (children.length) propType = "Object";

	jsDoc.addTag({
		tagName: "property",
		text: `{${propType}} ${isOptional ? `[${name}]` : name} ${existingPropDocs}`,
	});

	if (children.length) {
		children.forEach((child) => generateObjectPropertyDocumentation(child, jsDoc, name, false));
	}
}

/** Generate @typedefs from interfaces */
function generateInterfaceDocumentation(interfaceNode: InterfaceDeclaration): string {
	const name = interfaceNode.getName();
	const jsDoc = getJsDocOrCreate(interfaceNode);

	jsDoc.addTag({ tagName: "typedef", text: `{Object} ${name}` });
	interfaceNode.getProperties().forEach((prop) => {
		generateObjectPropertyDocumentation(prop, jsDoc);
	});
	return jsDoc.getFullText();
}

/**
 * Transpile.
 * @param src Source code to transpile
 * @param [filename=input.ts] Filename to use internally when transpiling (can be a path or a name)
 * @param [compilerOptions={}] Options for the compiler.
 * 		See https://www.typescriptlang.org/tsconfig#compilerOptions
 * @param [debug=false] Whether to log errors
 * @return Transpiled code (or the original source code if something went wrong)
 */
function transpile(
	src: string,
	filename = "input.ts",
	compilerOptions: object = {},
	debug = false,
): string {
	// Useless variable to prevent comments from getting removed when code contains just
	// typedefs/interfaces, which get transpiled to nothing but comments
	const protectCommentsHeader = "const __tsToJsdoc_protectCommentsHeader = 1;\n";

	try {
		const project = new Project({
			compilerOptions: {
				target: ScriptTarget.ESNext,
				esModuleInterop: true,
				...compilerOptions,
			},
		});

		const code = protectCommentsHeader + src;
		// ts-morph throws a fit if the path already exists
		const sourceFile = project.createSourceFile(
			`${path.basename(filename, ".ts")}.ts-to-jsdoc.ts`,
			code,
		);

		sourceFile.getClasses().forEach(generateClassDocumentation);

		const typedefs = sourceFile.getTypeAliases()
			.map((typeAlias) => generateTypedefDocumentation(typeAlias, sourceFile));

		const interfaces = sourceFile.getInterfaces()
			.map((interfaceNode) => generateInterfaceDocumentation(interfaceNode));

		sourceFile.getFunctions().forEach(generateFunctionDocumentation);

		let result = project.emitToMemory()?.getFiles()?.[0]?.text;
		if (result) {
			if (!result.startsWith(protectCommentsHeader)) {
				throw new Error(
					"Internal error: generated header is missing in output\n\n"
					+ `protectCommentsHeader: ${JSON.stringify(protectCommentsHeader)}\n`
					+ `Output: ${
						JSON.stringify(`${result.slice(protectCommentsHeader.length + 100)} ...`)
					}`,
				);
			}
			result = result.slice(protectCommentsHeader.length);
			const join = (arr: string[]) => arr.join("\n\n");
			return `${result}\n\n${join(typedefs)}\n\n${join(interfaces)}`;
		}
	} catch (e) {
		debug && console.error(e);
		return src;
	}
	return src;
}

module.exports = transpile;
export default transpile;
