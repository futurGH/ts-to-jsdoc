import {
	Node, Project, ScriptTarget, SyntaxKind, TypeFormatFlags,
} from "ts-morph";

import { versionMajorMinor as tsVersionMajorMinor } from "typescript";

import type {
	CompilerOptions,
	ClassDeclaration,
	ConstructorDeclaration,
	FunctionLikeDeclaration,
	GetAccessorDeclaration,
	ImportDeclaration,
	InterfaceDeclaration,
	JSDoc,
	JSDocableNode,
	MethodDeclaration,
	ModifierableNode,
	PropertyAssignment,
	PropertyDeclaration,
	PropertySignature,
	ReferenceFindableNode,
	SetAccessorDeclaration,
	SourceFile,
	TypeAliasDeclaration,
	TypedNode,
	VariableDeclaration,
	FunctionDeclaration,
	ModuleDeclaration,
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

interface MajorMinorVersion {
	major: number;
	minor: number;
}

function parseTsVersion(majorMinor: string): MajorMinorVersion {
	const [major, minor] = majorMinor.split(".").map((v) => parseInt(v));
	return { major, minor };
}

function isTsVersionAtLeast(tsVersion: MajorMinorVersion, major: number, minor: number): boolean {
	return tsVersion.major > major || (tsVersion.major === major && tsVersion.minor >= minor);
}

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

function nodeIsOnlyUsedInTypePosition(node: Node & ReferenceFindableNode): boolean {
	for (const reference of node.findReferencesAsNodes()) {
		// We're only looking for usages in the context of the file where the node is defined
		if (reference.getSourceFile().getFilePath() !== node.getSourceFile().getFilePath()) continue;
		// A reference in the context of an import statement doesn't count
		if (Node.isImportSpecifier(reference.getParent())) continue;
		if (!Node.isTypeReference(reference.getParent())) return false;
	}
	return true;
}

/** Generate `@typedef` declarations for type imports */
function generateImportDeclarationDocumentationViaTypedef(
	importDeclaration: ImportDeclaration,
): string {
	let typedefs = "";

	const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
	const declarationIsTypeOnly = importDeclaration.isTypeOnly();

	const defaultImport = importDeclaration.getDefaultImport();
	const defaultImportName = defaultImport?.getText();
	if (defaultImport) {
		if (declarationIsTypeOnly || nodeIsOnlyUsedInTypePosition(defaultImport)) {
			typedefs += `/** @typedef {import('${moduleSpecifier}')} ${defaultImportName} */\n`;
		}
	}

	for (const namedImport of importDeclaration.getNamedImports() ?? []) {
		const name = namedImport.getName();
		const aliasNode = namedImport.getAliasNode();
		const alias = aliasNode?.getText() || name;

		if (declarationIsTypeOnly || namedImport.isTypeOnly() || nodeIsOnlyUsedInTypePosition(aliasNode || namedImport.getNameNode())) {
			typedefs += `/** @typedef {import('${moduleSpecifier}').${name}} ${alias} */\n`;
		}
	}

	return typedefs;
}

/** Generate `@import` JSDoc declarations for type imports */
function generateImportDeclarationDocumentationViaImportTag(
	importDeclaration: ImportDeclaration,
): string {
	const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
	const declarationIsTypeOnly = importDeclaration.isTypeOnly();

	const imports: { default: string | undefined, named: string[] } = {
		default: undefined,
		named: [],
	};

	const defaultImport = importDeclaration.getDefaultImport();
	const defaultImportName = defaultImport?.getText();
	if (defaultImport) {
		if (declarationIsTypeOnly || nodeIsOnlyUsedInTypePosition(defaultImport)) {
			imports.default = defaultImportName;
		}
	}

	for (const namedImport of importDeclaration.getNamedImports() ?? []) {
		const name = namedImport.getName();
		const aliasNode = namedImport.getAliasNode();
		const alias = aliasNode?.getText();
		if (declarationIsTypeOnly || namedImport.isTypeOnly() || nodeIsOnlyUsedInTypePosition(aliasNode || namedImport.getNameNode())) {
			if (alias !== undefined) {
				imports.named.push(`${name} as ${alias}`);
			} else {
				imports.named.push(name);
			}
		}
	}

	const importParts: string[] = [];
	if (imports.default !== undefined) {
		importParts.push(imports.default);
	}
	if (imports.named.length > 0) {
		importParts.push(`{ ${imports.named.join(", ")} }`);
	}
	return importParts.length > 0 ? `/** @import ${importParts.join(", ")} from '${moduleSpecifier}' */` : "";
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
		const paramType = param.getTypeNode()?.getText() || param.getType().getText(
			param,
			TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
		);
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
	const functionReturnType = functionNode.getReturnTypeNode()?.getText() || functionNode.getReturnType().getText(
		functionNode.getFunctions()[0],
		TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
	);
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
 * Generate documentation for a function, storing it in functionNode or context.docNode
 */
function generateFunctionDocumentation(
	functionNode: FunctionLikeDeclaration,
	context: { docNode?: JSDocableNode, overloads?: FunctionDeclaration[] } = {},
): void {
	const outputDocNode = getOutputJsDocNodeOrCreate(functionNode, context.docNode);

	const typeParams = functionNode.getTypeParameters();

	typeParams.forEach((param) => {
		const constraint = param.getConstraint();
		const defaultType = param.getDefault();
		const paramName = param.getName();
		const nameWithDefault = defaultType ? `[${paramName}=${defaultType.getText()}]` : paramName;
		outputDocNode.getJsDocs()[0].addTag({
			tagName: "template",
			text: `${constraint ? `{${constraint.getText()}} ` : ""}${nameWithDefault}`,
		});
	});

	const overloads = context.overloads || [];

	const structures = overloads.flatMap((overload) => {
		generateFunctionDocumentation(overload);

		const jsDocs = overload.getJsDocs();
		return jsDocs.map(
			(jsDoc) => ({
				description: jsDoc.getDescription(),
				tags: [
					{ tagName: "overload" },
					...jsDoc.getTags().map((tag) => tag.getStructure()),
				],
			}),
		);
	});

	outputDocNode.insertJsDocs(0, structures);

	generateParameterDocumentation(functionNode, outputDocNode);
	generateReturnTypeDocumentation(functionNode, outputDocNode);
}

/** Generate modifier documentation for class member */
function generateModifierDocumentation(classMemberNode: ClassMemberNode): void {
	const modifiers = classMemberNode.getModifiers() || [];
	let jsDoc: JSDoc;
	for (const modifier of modifiers) {
		const text = modifier?.getText();
		if (["public", "private", "protected", "readonly", "static"].includes(text)) {
			jsDoc ??= getJsDocOrCreateMultiline(classMemberNode);
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
	const initializerType = initializer?.getType().getText(
		classPropertyNode,
		TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
	);
	if (initializer && initializer.getText() !== "undefined") {
		const jsDoc = getJsDocOrCreate(classPropertyNode);
		jsDoc.addTag({ tagName: "default", text: initializerType });
	}
}

/** Generate documentation for a get accessor */
function generateGetterDocumentation(getterNode: GetAccessorDeclaration): void {
	const jsDoc = getJsDocOrCreateMultiline(getterNode);
	jsDoc.addTag({
		tagName: "returns",
		text: `{${getterNode.getReturnType().getText(
			getterNode,
			TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
		)}}`,
	});
}

/** Generate documentation for a set accessor */
function generateSetterDocumentation(setterNode: SetAccessorDeclaration): void {
	const jsDoc = getJsDocOrCreateMultiline(setterNode);
	const parameter = setterNode.getParameters()[0];
	jsDoc.addTag({
		tagName: "param",
		text: `{${parameter.getType().getText(
			setterNode,
			TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
		)}} ${parameter.getName()}`,
	});
}

/** Generate documentation for a class constructor */
function generateConstructorDocumentation(constructor: ConstructorDeclaration): void {
	const jsDocableNode = getOutputJsDocNodeOrCreate(constructor);
	generateParameterDocumentation(constructor, jsDocableNode);
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
	if (Node.isObjectProperty(classMemberNode)) generateInitializerDocumentation(classMemberNode);
	if (Node.isGetAccessorDeclaration(classMemberNode)) generateGetterDocumentation(classMemberNode);
	if (Node.isSetAccessorDeclaration(classMemberNode)) generateSetterDocumentation(classMemberNode);
	if (Node.isConstructorDeclaration(classMemberNode)) generateConstructorDocumentation(classMemberNode);
	if (Node.isMethodDeclaration(classMemberNode)) generateFunctionDocumentation(classMemberNode);
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
	const paramType = varNode.getTypeNode()?.getText() || varNode.getType().getText(
		varNode,
		TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
	);
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

function generateNamespaceDocumentation(namespace: ModuleDeclaration, prefix = ""): string[] {
	let containsValueReferences = false;

	namespace.forEachDescendant((node, traversal) => {
		switch (node.getKind()) {
		case SyntaxKind.ClassDeclaration:
		case SyntaxKind.FunctionDeclaration:
		case SyntaxKind.VariableDeclaration:
			containsValueReferences = true;
			traversal.stop();
			break;
		default:
			break;
		}
	});

	const namespaceName = namespace.getName();
	const name = [prefix, namespaceName].filter(Boolean).join(".");
	const jsDoc = getJsDocOrCreateMultiline(namespace);
	jsDoc.addTag({ tagName: "namespace", text: name });

	const additions = namespace.getModules()
		.map(($namespace) => generateNamespaceDocumentation($namespace, name));

	const typedefs = namespace.getTypeAliases()
		.map((typeAlias) => {
			const aliasName = typeAlias.getName();
			const scopedName = `${name}.${aliasName}`;
			const documentation = generateTypedefDocumentation(typeAlias).trim();

			return documentation
				.replace(`@typedef {Object} ${aliasName}`, `@typedef {Object} ${scopedName}`);
		})
		.join("\n")
		.trim();

	const interfaces = namespace.getInterfaces()
		.map((interfaceNode) => {
			const interfaceName = interfaceNode.getName();
			const scopedName = `${name}.${interfaceName}`;
			const documentation = generateInterfaceDocumentation(interfaceNode).trim();

			return documentation
				.replace(`@typedef {Object} ${interfaceName}`, `@typedef {Object} ${scopedName}`);
		})
		.join("\n")
		.trim();

	namespace.getClasses().forEach(generateClassDocumentation);

	namespace.getFunctions().forEach((node) => generateFunctionDocumentation(node));

	const varDeclarations = namespace.getVariableDeclarations();
	varDeclarations.forEach((varDeclaration) => {
		const initializer = varDeclaration.getInitializerIfKind(SyntaxKind.ArrowFunction)
			|| varDeclaration.getInitializerIfKind(SyntaxKind.FunctionExpression);
		if (initializer) {
			const docNode = varDeclaration.getVariableStatement();
			generateFunctionDocumentation(initializer, { docNode });
		} else {
			generateTopLevelVariableDocumentation(varDeclaration);
		}
	});

	const result = [
		typedefs,
		interfaces,
		additions,
	].flat(2);

	// Namespace only includes types
	if (!containsValueReferences) {
		result.unshift(jsDoc.getFullText());
		namespace.remove();
	}

	return result
		// Normalize indentation depths to be consistent
		.map((text) => text.replace(/^[ \t]{1,}\*/gm, " *"));
}

/**
 * Generate documentation for a source file
 * @param sourceFile The source file to generate documentation for
 */
function generateDocumentationForSourceFile(sourceFile: SourceFile, tsVersion: MajorMinorVersion): void {
	sourceFile.getClasses().forEach(generateClassDocumentation);

	const namespaceAdditions = sourceFile.getModules()
		.map((namespace) => generateNamespaceDocumentation(namespace))
		.flat(2);

	const generateImportDeclarationDocumentation = isTsVersionAtLeast(tsVersion, 5, 5)
	  ? generateImportDeclarationDocumentationViaImportTag
	  : generateImportDeclarationDocumentationViaTypedef;

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

	const functionOverloadsByName = {};

	sourceFile.forEachChild((node) => {
		if (Node.isFunctionDeclaration(node)) {
			if (!functionOverloadsByName[node.getName()]) {
				functionOverloadsByName[node.getName()] = [];
			}

			if (!node.hasBody()) {
				functionOverloadsByName[node.getName()].push(node);
			}
		}
	});

	const directFunctions = sourceFile.getFunctions();
	directFunctions.forEach((node) => {
		const overloads = functionOverloadsByName[node.getName()] ?? [];
		generateFunctionDocumentation(node, { overloads });
	});

	const varDeclarations = sourceFile.getVariableDeclarations();
	varDeclarations.forEach((varDeclaration) => {
		const initializer = varDeclaration.getInitializerIfKind(SyntaxKind.ArrowFunction)
			|| varDeclaration.getInitializerIfKind(SyntaxKind.FunctionExpression);
		if (initializer) {
			const docNode = varDeclaration.getVariableStatement();
			generateFunctionDocumentation(initializer, { docNode });
		} else {
			generateTopLevelVariableDocumentation(varDeclaration);
		}
	});

	sourceFile.insertText(0, `${importDeclarations}\n\n`);
	sourceFile
		.insertText(sourceFile.getFullText().length, `\n\n${namespaceAdditions.join("\n")}`);
	sourceFile.insertText(sourceFile.getFullText().length, `\n\n${typedefs}`);
	sourceFile.insertText(sourceFile.getFullText().length, `\n\n${interfaces}`);

	sourceFile.formatText({
		ensureNewLineAtEndOfFile: true,
		trimTrailingWhitespace: true,
	});
}

/**
 * Transpile a project.
 * @param tsconfig Path to a tsconfig file to use for configuration
 * @param [debug=false] Whether to log errors
 */
export function transpileProject(tsconfig: string, debug = false): void {
	try {
		const project = new Project({
			tsConfigFilePath: tsconfig,
		});

		const tsVersion = parseTsVersion(tsVersionMajorMinor);
		const sourceFiles = project.getSourceFiles();
		sourceFiles.forEach((sourceFile) => generateDocumentationForSourceFile(sourceFile, tsVersion));

		const preEmitDiagnostics = project.getPreEmitDiagnostics();
		if (preEmitDiagnostics.length && project.getCompilerOptions().noEmitOnError) {
			throw new Error(`Pre-compilation errors:\n${
				preEmitDiagnostics.map((diagnostic) => diagnostic.getMessageText()).join("\n")
			}`);
		}

		const emitResult = project.emitSync();
		if (emitResult?.getEmitSkipped()) {
			throw new Error("Emit was skipped.");
		}
		const diagnostics = emitResult.getDiagnostics();
		if (diagnostics.length) {
			throw new Error(`Compilation errors:\n${
				diagnostics.map((diagnostic) => diagnostic.getMessageText()).join("\n")
			}`);
		}
	} catch (e) {
		if (debug) console.error(e);
	}
}

/**
 * Transpile a single file.
 * @param code Source code to transpile
 * @param [filename=input.ts] Filename to use internally when transpiling (can be a path or a name)
 * @param [compilerOptions={}] Options for the compiler.
 * 		See https://www.typescriptlang.org/tsconfig#compilerOptions
 * @param [inMemory=false] Whether to store the file in memory while transpiling
 * @param [debug=false] Whether to log errors
 * @param [tsVersion=<current>] Major and minor version of TypeScript, used to check for
 * certain features such as whether to `@import` or `@typedef` JSDoc tags for imports.
 * Defaults to the current TypeScript version.
 * @returns Transpiled code (or the original source code if something went wrong)
 */
export function transpileFile(
	{
		code,
		filename = "input.ts",
		compilerOptions = {},
		inMemory = false,
		debug = false,
		tsVersion = tsVersionMajorMinor,
	}: {
		code: string;
		filename?: string;
		compilerOptions?: CompilerOptions;
		inMemory?: boolean;
		debug?: boolean;
		tsVersion?: string;
	},
): string {
	try {
		const parsedTsVersion = parseTsVersion(tsVersion);

		const project = new Project({
			defaultCompilerOptions: {
				target: ScriptTarget.ESNext,
				esModuleInterop: true,
			},
			useInMemoryFileSystem: inMemory,
			compilerOptions,
		});

		let sourceFile: SourceFile;
		if (inMemory) {
			sourceFile = project.createSourceFile(filename, code);
		} else {
			const fileExtension = filename.split(".").pop();
			const fileBasename = filename.slice(0, -fileExtension.length - 1);
			// Avoid conflicts with the original file
			const sourceFilename = fileExtension === "tsx"
				? `${fileBasename}.ts-to-jsdoc.tsx`
				: `${fileBasename}.ts-to-jsdoc.ts`;
			sourceFile = project.createSourceFile(sourceFilename, code);
		}

		generateDocumentationForSourceFile(sourceFile, parsedTsVersion);

		const preEmitDiagnostics = project.getPreEmitDiagnostics();
		if (preEmitDiagnostics.length && project.getCompilerOptions().noEmitOnError) {
			throw new Error(`Pre-compilation errors:\n${
				preEmitDiagnostics.map((diagnostic) => diagnostic.getMessageText()).join("\n")
			}`);
		}

		const emitResult = project.emitToMemory({ targetSourceFile: sourceFile });
		if (emitResult?.getEmitSkipped()) {
			throw new Error("Emit was skipped.");
		}
		const diagnostics = emitResult.getDiagnostics();
		if (diagnostics.length) {
			throw new Error(`Compilation errors:\n${
				diagnostics.map((diagnostic) => diagnostic.getMessageText()).join("\n")
			}`);
		}

		const text = emitResult?.getFiles()?.[0]?.text;

		if (text) return text;
		throw new Error("Could not emit output to memory.");
	} catch (e) {
		if (debug) console.error(e);
		return code;
	}
}
