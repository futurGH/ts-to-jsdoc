import path from "path";

import {
	Node, Project, ScriptTarget, SyntaxKind,
} from "ts-morph";

import type {
	ClassDeclaration,
	FunctionLikeDeclaration,
	ImportDeclaration,
	InterfaceDeclaration,
	JSDoc,
	JSDocableNode,
	MethodDeclaration,
	ModifierableNode,
	PropertyAssignment,
	PropertyDeclaration,
	PropertySignature,
	TypeAliasDeclaration,
	TypedNode,
	VariableDeclaration,
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

function getJsDoc(node: JSDocableNode): JSDoc | undefined {
	return node.getJsDocs().at(-1);
}

/** Get JSDoc for a node or create one if there isn't any */
function getJsDocOrCreate(node: JSDocableNode): JSDoc {
	return getJsDoc(node) || node.addJsDoc({});
}

/**
 * getJsDocOrCreate, but if JSDoc is created, insert a newline at the beginning
 * so that the first line of JSDoc doesn't appear on the same line as `/**`
 */
function getJsDocOrCreateMultiline(node: JSDocableNode): JSDoc {
	return getJsDoc(node) || node.addJsDoc({
		description: "\n",
	});
}

/** Return the node most suitable for JSDoc for a function, adding JSDoc if there isn't any */
function getOutputJsDocNodeOrCreate(
	functionNode: FunctionLikeDeclaration,
	docNode?: JSDocableNode,
): JSDocableNode {
	if (docNode) {
		const funcNodeDocs = functionNode.getJsDocs();
		if (funcNodeDocs.length) return functionNode;
		getJsDocOrCreateMultiline(docNode);
		return docNode;
	}
	getJsDocOrCreateMultiline(functionNode);
	return functionNode;
}

/** Generate `@typedef` declarations for type imports */
function generateImportDeclarationDocumentation(
	importDeclaration: ImportDeclaration,
): string {
	let typedefs = "";

	const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
	const declarationIsTypeOnly = importDeclaration.isTypeOnly();

	const defaultImport = importDeclaration.getDefaultImport()?.getText();
	if (defaultImport && declarationIsTypeOnly) {
		typedefs += `/** @typedef {import('${moduleSpecifier}')} ${defaultImport} */\n`;
	}

	for (const namedImport of importDeclaration.getNamedImports() ?? []) {
		if (!declarationIsTypeOnly && !namedImport.isTypeOnly()) continue;

		const name = namedImport.getName();
		const aliasNode = namedImport.getAliasNode();
		const alias = aliasNode?.getText() || name;

		typedefs += `/** @typedef {import('${moduleSpecifier}').${name}} ${alias} */\n`;
	}

	return typedefs;
}

/**
 * Generate `@param` documentation from function parameters for functionNode, storing it in docNode
 */
function generateParameterDocumentation(
	functionNode: FunctionLikeDeclaration,
	docNode: JSDocableNode,
): void {
	const params = functionNode.getParameters();

	if (!params.length) return;

	const jsDoc = getJsDocOrCreateMultiline(docNode);

	// Get existing param tags, store their comments, then remove them
	const paramTags = (jsDoc.getTags() || [])
		.filter((tag) => ["param", "parameter"].includes(tag.getTagName()));
	const commentLookup = Object.fromEntries(paramTags.map((tag) => [
		// @ts-ignore
		tag.compilerNode.name?.getText().replace(/\[|\]|(=.*)/g, "").trim(),
		(tag.getComment() || "").toString().trim(),
	]));
	const preferredTagName = paramTags[0]?.getTagName();
	paramTags.forEach((tag) => tag.remove());

	for (const param of params) {
		const paramType = param.getTypeNode()?.getText() || param.getType().getText();
		if (!paramType) continue;

		const paramName = param.compilerNode.name?.getText();
		const isOptional = param.isOptional();
		const isRest = param.isRestParameter();

		// Rest parameters are arrays, but the JSDoc syntax is `...number` instead of `number[]`
		const paramTypeOut = isRest ? `...${paramType.replace(/\[\]\s*$/, "")}` : paramType;

		let defaultValue: string;
		if (isOptional) {
			const paramInitializer = param.getInitializer();
			defaultValue = paramInitializer?.getText().replaceAll(/(\s|\t)*\n(\s|\t)*/g, " ");
		}

		let paramNameOut = paramName;
		// Skip parameter names if they are present in the type as an object literal
		// e.g. destructuring; { a }: { a: string }
		if (paramNameOut.match(/[{},]/)) paramNameOut = "";
		if (paramNameOut && isOptional) {
			// Wrap name in square brackets if the parameter is optional
			const defaultValueOut = defaultValue !== undefined ? `=${defaultValue}` : "";
			paramNameOut = `[${paramNameOut}${defaultValueOut}]`;
		}
		paramNameOut = paramNameOut ? ` ${paramNameOut}` : "";

		const comment = commentLookup[paramName.trim()];

		jsDoc.addTag({
			tagName: preferredTagName || "param",
			text: `{${paramTypeOut}}${paramNameOut}${comment ? ` ${comment}` : ""}`,
		});
	}
}

/**
 * Generate `@returns` documentation from function return type for functionNode, storing it in docNode
 */
function generateReturnTypeDocumentation(
	functionNode: FunctionLikeDeclaration,
	docNode: JSDocableNode,
): void {
	const returnTypeNode = functionNode.getReturnTypeNode() ?? functionNode.getReturnType();
	const functionReturnType = returnTypeNode.getText(functionNode.getSignature().getDeclaration());
	const jsDoc = getJsDocOrCreate(docNode);
	const returnsTag = (jsDoc?.getTags() || [])
		.find((tag) => ["returns", "return"].includes(tag.getTagName()));
	// Replace tag with one that contains type info if tag exists
	const tagName = returnsTag?.getTagName() || "returns";
	const comment = (returnsTag?.getComment() || "").toString().trim();

	if (returnsTag) {
		returnsTag.remove();
	}
	jsDoc.addTag({
		tagName,
		text: `{${functionReturnType}}${comment ? ` ${comment}` : ""}`,
	});
}

/**
 * Generate documentation for a function, storing it in functionNode or docNode
 */
function generateFunctionDocumentation(
	functionNode: FunctionLikeDeclaration,
	docNode?: JSDocableNode,
): void {
	const outputDocNode = getOutputJsDocNodeOrCreate(functionNode, docNode);

	generateParameterDocumentation(functionNode, outputDocNode);
	generateReturnTypeDocumentation(functionNode, outputDocNode);
}

/** Generate modifier documentation for class member */
function generateModifierDocumentation(classMemberNode: ClassMemberNode): void {
	const modifiers = classMemberNode.getModifiers() || [];
	for (const modifier of modifiers) {
		const text = modifier?.getText();
		if (["public", "private", "protected", "readonly", "static"].includes(text)) {
			const jsDoc = getJsDocOrCreateMultiline(classMemberNode);
			jsDoc.addTag({ tagName: text });
		}
	}
}

/**
 * Create class property initializer in constructor if it doesn't exist
 * so that documentation is preserved when transpiling
 */
function generateInitializerDocumentation(classPropertyNode: ObjectProperty): void {
	const initializer = classPropertyNode.getInitializer();
	const initializerType = initializer?.getType().getText();
	if (initializer && initializer.getText() !== "undefined") {
		const jsDoc = getJsDocOrCreate(classPropertyNode);
		jsDoc.addTag({ tagName: "default", text: initializerType });
	}
}

/** Document the class itself; at the moment just its extends signature */
function generateClassBaseDocumentation(classNode: ClassDeclaration) {
	const extendedClass = classNode.getExtends();
	if (extendedClass) {
		const jsDoc = getJsDocOrCreate(classNode);
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
 * Generate `@typedefs` from type aliases
 * @return A JSDoc comment containing the typedef
 */
function generateTypedefDocumentation(typeAlias: TypeAliasDeclaration): string {
	const name = typeAlias.getName();
	const typeNode = typeAlias.getTypeNode();

	const isObjectType = Node.isTypeLiteral(typeNode) && typeAlias.getType().isObject();
	const properties = isObjectType ? typeNode.getProperties() : [];
	const typeParams = typeAlias.getTypeParameters();

	// If we're going to have multiple tags, we need to create a multiline JSDoc
	const jsDoc = properties.length || typeParams.length
		? getJsDocOrCreateMultiline(typeAlias)
		: getJsDocOrCreate(typeAlias);

	if (Node.isTypeLiteral(typeNode) && typeAlias.getType().isObject()) {
		jsDoc.addTag({ tagName: "typedef", text: `{Object} ${name}` });
		typeNode.getProperties().forEach((prop) => {
			generateObjectPropertyDocumentation(prop, jsDoc);
		});
	} else {
		const { type } = typeAlias.getStructure();
		if (typeof type !== "string") return jsDoc.getFullText();
		jsDoc.addTag({ tagName: "typedef", text: `{${type}} ${name}` });
	}

	typeParams.forEach((param) => {
		const constraint = param.getConstraint();
		const defaultType = param.getDefault();
		const paramName = param.getName();
		const nameWithDefault = defaultType ? `[${paramName}=${defaultType.getText()}]` : paramName;
		jsDoc.addTag({
			tagName: "template",
			text: `${constraint ? `{${constraint.getText()}} ` : ""}${nameWithDefault}`,
		});
	});

	return jsDoc.getFullText();
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
		?.replace(/\n/g, "")?.trim();

	const isOptional = node.hasQuestionToken()
		|| node.getJsDocs()
			?.[0]
			?.getTags()
			?.some((tag) => tag.getTagName() === "optional");
	// Copy over existing description if there is one
	const existingPropDocs = node.getJsDocs()?.[0]?.getDescription()?.trim() || "";
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

/** Generate `@typedefs` from interfaces */
function generateInterfaceDocumentation(interfaceNode: InterfaceDeclaration): string {
	const name = interfaceNode.getName();
	const jsDoc = getJsDocOrCreateMultiline(interfaceNode);

	jsDoc.addTag({ tagName: "typedef", text: `{Object} ${name}` });
	interfaceNode.getProperties().forEach((prop) => {
		generateObjectPropertyDocumentation(prop, jsDoc);
	});
	return jsDoc.getFullText();
}

/** Generate documentation for top-level var, const, and let declarations */
function generateTopLevelVariableDocumentation(varNode: VariableDeclaration) {
	const paramType = (varNode.getTypeNode() || varNode.getType())?.getText();
	if (!paramType) {
		return;
	}

	const jsDoc = getJsDoc(varNode.getVariableStatement());
	if (!jsDoc) {
		// Only generate documentation for variables that have an existing comment in JSDoc format
		return;
	}

	const tags = jsDoc?.getTags() || [];
	if (tags.find((tag) => ["type"].includes(tag.getTagName()))) {
		return;
	}

	const constTag = tags.find((tag) => ["const", "constant"].includes(tag.getTagName()));
	if (constTag && constTag.getComment()?.length) {
		return;
	}

	jsDoc.addTag({
		tagName: "type",
		text: `{${paramType}}`,
	});
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
	src = protectCommentsHeader + src;

	try {
		const project = new Project({
			compilerOptions: {
				target: ScriptTarget.ESNext,
				esModuleInterop: true,
				...compilerOptions,
			},
		});

		// Preserve blank lines in output
		const blankLineMarker = "// TS-TO-JSDOC BLANK LINE //";

		const code = src.split("\n").map((line) => (
			line.match(/^[\s\t]*$/) ? (blankLineMarker + line) : line
		)).join("\n");

		const fileExtension = path.extname(filename);
		const fileBasename = path.basename(filename, fileExtension);
		const sourceFilename = fileExtension === ".tsx"
			? `${fileBasename}.ts-to-jsdoc.tsx`
			: `${fileBasename}.ts-to-jsdoc.ts`;

		// ts-morph throws a fit if the path already exists
		const sourceFile = project.createSourceFile(
			sourceFilename,
			code,
		);

		sourceFile.getClasses().forEach(generateClassDocumentation);

		const importDeclarations = sourceFile.getImportDeclarations()
			.map((declaration) => generateImportDeclarationDocumentation(declaration).trim())
			.join("\n")
			.trim();

		const typedefs = sourceFile.getTypeAliases()
			.map((typeAlias) => generateTypedefDocumentation(typeAlias).trim())
			.join("\n")
			.trim();

		const interfaces = sourceFile.getInterfaces()
			.map((interfaceNode) => generateInterfaceDocumentation(interfaceNode).trim())
			.join("\n")
			.trim();

		const directFunctions = sourceFile.getFunctions();
		directFunctions.forEach((node) => generateFunctionDocumentation(node));

		const varDeclarations = sourceFile.getVariableDeclarations();
		varDeclarations.forEach((varDeclaration) => {
			const initializer = varDeclaration.getInitializerIfKind(SyntaxKind.ArrowFunction)
			|| varDeclaration.getInitializerIfKind(SyntaxKind.FunctionExpression);
			if (initializer) {
				generateFunctionDocumentation(initializer, varDeclaration.getVariableStatement());
			} else {
				generateTopLevelVariableDocumentation(varDeclaration);
			}
		});

		let result = project.emitToMemory()?.getFiles()?.[0]?.text;

		if (result) {
			if (!result.startsWith(protectCommentsHeader)) {
				throw new Error(
					"Internal error: generated header is missing in output.\n\n"
					+ `Output: ${
						JSON.stringify(`${result.slice(protectCommentsHeader.length + 100)} ...`)
					}`,
				);
			}
			result = result.replace(protectCommentsHeader, "");

			// Restore blank lines in output
			result = result.split("\n").map((_line) => {
				const line = _line.trim();
				return line.startsWith(blankLineMarker)
					? line.slice(blankLineMarker.length)
					: _line;
			}).join("\n").trim();

			if (importDeclarations) result = `${importDeclarations}\n\n${result}`;
			if (typedefs) result += `\n\n${typedefs}`;
			if (interfaces) result += `\n\n${interfaces}`;

			result = `${result.trim()}\n`;

			return result;
		}
		throw new Error("Could not emit output to memory.");
	} catch (e) {
		debug && console.error(e);
		return src;
	}
	return src;
}

module.exports = transpile;
export default transpile;
