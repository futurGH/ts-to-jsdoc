const path = require("path");
// Needed variables
const {
  Project, ScriptTarget, Node,
} = require("ts-morph");

// Just for JSDoc
/* eslint-disable */
const {
	PropertyDeclaration,
	PropertyAssignment,
	PropertySignature,
	JSDocableNode,
	MethodDeclaration,
	JSDoc,
	FunctionDeclaration,
	ModifierableNode,
	ClassDeclaration,
	TypeAliasDeclaration,
	SourceFile,
	StatementedNode,
	NamedNodeSpecific,
	NamedNodeSpecificBase,
	InterfaceDeclaration,
} = require("ts-morph");
/* eslint-enable */

// still not sure what the difference between these three is
Node.isObjectProperty = (node) => Node.isPropertyDeclaration(node) ||
  Node.isPropertyAssignment(node) ||
  Node.isPropertySignature(node);

// extension of ^^^
/**
 * @typedef {JSDocableNode & PropertyDeclaration | PropertyAssignment | PropertySignature} ObjectProperty
 */

/**
 * @typedef {JSDocableNode & ModifierableNode & ObjectProperty & MethodDeclaration} ClassMemberNode
 */

// Because JSDoc intellisense doesn't seem to understand more than 2 layers of nested interface `extends`
/**
 * @typedef {NamedNodeSpecific & NamedNodeSpecificBase} NamedNode
 */

/**
 * Get children for object node
 * @param {Node} node
 * @return {ObjectProperty[]}
 */
function getChildProperties(node) {
  return node?.getType()?.getProperties()
      ?.map((child) => child.getValueDeclaration())
  // Hacky way to check if the child is actually a defined child in the interface
  // or if it's, e.g. a built-in method of the type (such as array.length)
      ?.filter((child) => node.getFullText().includes(child?.getFullText())) ||
    // Return an empty array if any of the intermediate methods are undefined or return nothing
    [];
}

/**
 * Get JSDoc for a node or create one if there isn't any
 * @param {JSDocableNode} node
 * @return {JSDoc}
 */
function getJsDocOrCreate(node) {
  return node.getJsDocs()[0] || node.addJsDoc({});
}

/**
 * Sanitize a string that is to be used as a type in a JSDoc comment so that it is compatible with JSDoc
 * @param {string} str
 * @return {string|null}
 */
function sanitizeType(str) {
  if (!str) return null;
  // Convert `typeof MyClass` syntax to `Class<MyClass>`
  const extractedClassFromTypeof = /{*typeof\s+([^(?:}|\s);]*)/gm.exec(str)?.[1];
  if (extractedClassFromTypeof) str = `Class<${extractedClassFromTypeof}>`;

  return str;
}

/**
 * Generate @param documentation from function parameters
 * @param {FunctionDeclaration} functionNode
 */
function generateParameterDocumentation(functionNode) {
  const params = functionNode.getParameters();
  for (const param of params) {
    const parameterType = sanitizeType(param.getTypeNode()?.getText());
    if (!parameterType) continue;
    // Get param tag that matches the param
    const jsDoc = getJsDocOrCreate(functionNode);
    const paramTag = (jsDoc.getTags() || [])
        .filter((tag) => ["param", "parameter"].includes(tag.getTagName()))
        .find((tag) => tag.compilerNode.name?.getText() === param.getName());

    const paramName = param.compilerNode.name?.getText();
    if (paramTag) {
      // Replace tag with one that contains typing info
      const comment = paramTag.getComment();
      const tagName = paramTag.getTagName();

      paramTag.replaceWithText(`@${tagName} {${parameterType}} ${paramName}  ${comment}`);
    } else {
      jsDoc.addTag({
        tagName: "param",
        text: `{${parameterType}} ${paramName}`,
      });
    }
  }
}

/**
 * Generate @returns documentation from function return type
 * @param {FunctionDeclaration} functionNode
 */
function generateReturnTypeDocumentation(functionNode) {
  const functionReturnType = sanitizeType(functionNode.getReturnType()?.getText());
  const jsDoc = getJsDocOrCreate(functionNode);
  const returnsTag = (jsDoc?.getTags() || []).find((tag) => ["returns", "return"].includes(tag.getTagName()));
  // Replace tag with one that contains type info if tag exists
  if (returnsTag) {
    const tagName = returnsTag.getTagName();
    const comment = returnsTag.getComment();
    // https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler#return-type-description
    if (functionReturnType !== "void") {
      returnsTag.replaceWithText(`@${tagName} {${functionReturnType}}${comment ? ` ${comment}` : ""}`);
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
 * Generate documentation for function
 * @param {FunctionDeclaration | MethodDeclaration} functionNode
 */
function generateFunctionDocumentation(functionNode) {
  generateParameterDocumentation(functionNode);
  generateReturnTypeDocumentation(functionNode);
}

/**
 * Generate modifier documentation for class member
 * @param {ClassMemberNode} classMemberNode
 */
function generateModifierDocumentation(classMemberNode) {
  const modifiers = classMemberNode.getModifiers() || [];
  for (let modifier of modifiers) {
    modifier = modifier?.getText();
    if (["public", "private", "protected", "readonly", "static"].includes(modifier)) {
      const jsDoc = getJsDocOrCreate(classMemberNode);
      jsDoc.addTag({tagName: modifier});
    }
  }
}

/**
 * Create class property initializer in constructor if it doesn't exist
 * so that documentation is preserved when transpiling
 * @param {ObjectProperty} classPropertyNode
 */
function generateInitializerDocumentation(classPropertyNode) {
  const jsDoc = getJsDocOrCreate(classPropertyNode);
  if (!classPropertyNode.getStructure()?.initializer) classPropertyNode.setInitializer("undefined");
  if (classPropertyNode.getStructure()?.initializer !== "undefined") {
    jsDoc.addTag({tagName: "default", text: classPropertyNode.getStructure().initializer});
  }
}

/**
 * Document the class itself; at the moment just its extends signature
 * @param {ClassDeclaration} classNode
 */
function generateClassBaseDocumentation(classNode) {
  const jsDoc = getJsDocOrCreate(classNode);
  const extendedClass = classNode.getExtends();
  if (extendedClass) {
    jsDoc.addTag({tagName: "extends", text: extendedClass.getText()});
  }
}

/**
 * Generate documentation for class members in general; whether property or method
 * @param {ClassMemberNode} classMemberNode
 */
function generateClassMemberDocumentation(classMemberNode) {
  generateModifierDocumentation(classMemberNode);
  Node.isObjectProperty(classMemberNode) && generateInitializerDocumentation(classMemberNode);
  Node.isMethodDeclaration(classMemberNode) && generateFunctionDocumentation(classMemberNode);
}

/**
 * Generate documentation for a class -- itself and its members
 * @param {ClassDeclaration} classNode
 */
function generateClassDocumentation(classNode) {
  generateClassBaseDocumentation(classNode);
  classNode.getMembers().forEach(generateClassMemberDocumentation);
}

/**
 * Generate @typedefs from type aliases
 * @param {NamedNode & TypeAliasDeclaration} typeNode
 * @param {SourceFile & StatementedNode<SourceFile>} sourceFile
 * @returns {string} A JSDoc comment containing the typedef
 */
function generateTypedefDocumentation(typeNode, sourceFile) {
  // Create dummy node to assign typedef documentation to (will be deleted afterwards)
  const name = typeNode.getName();
  let {type} = typeNode.getStructure();
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
 * @param {ObjectProperty} node
 * @param {JSDoc} jsDoc
 * @param {string} [name=""] The name to assign child docs to; "obj" will generate docs for "obj.val1", "obj.val2", etc
 * @param {boolean} [topLevelCall=true] recursive functions are funky
 */
function generateObjectPropertyDocumentation(node, jsDoc, name = "", topLevelCall = true) {
  name = name || node.getName();
  if (!topLevelCall) name = `${name}.${node.getName()}`;

  let propType = node.getTypeNode()
      ?.getText()
      ?.replace(/\n/g, "")
      ?.replace(/\s/g, "");
  propType = sanitizeType(propType);

  const isOptional = node.hasQuestionToken() || node.getJsDocs()?.[0]?.getTags()?.some((tag) => tag.getTagName() === "optional");
  // Copy over existing description if there is one
  const existingPropDocs = node.getJsDocs()?.[0]?.getDescription() || "";
  const children = getChildProperties(node);

  if (children.length) propType = "Object";

  jsDoc.addTag({tagName: "property", text: `{${propType}} ${isOptional ? `[${name}]` : name} ${existingPropDocs}`});

  if (children.length) {
    children.forEach((child) => generateObjectPropertyDocumentation(child, jsDoc, name, false));
  }
}

/**
 * Generate @typedefs from interfaces
 * @param {NamedNode & InterfaceDeclaration} interfaceNode
 */
function generateInterfaceDocumentation(interfaceNode) {
  const name = interfaceNode.getName();
  const jsDoc = getJsDocOrCreate(interfaceNode);

  jsDoc.addTag({tagName: "typedef", text: `{Object} ${name}`});
  interfaceNode.getProperties().forEach((prop) => {
    generateObjectPropertyDocumentation(prop, jsDoc);
  });
  return jsDoc.getFullText();
}

/**
 * Transpile.
 * @param {string} src Source code to transpile
 * @param {string} filename Filename to use internally when transpiling (can be path or just a name)
 * @param {Object} [compilerOptions={}] Options for the compiler. See https://www.typescriptlang.org/tsconfig#compilerOptions
 * @param {boolean} [debug=false] Whether to log errors
 * @return {string} Transpiled code (or the original source code if something went wrong)
 */
module.exports = function transpile(src, filename, compilerOptions = {}, debug = false) {
  try {
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ESNext,
        esModuleInterop: true,
        ...compilerOptions,
      },
    });

    // Useless variable to prevent comments from getting removed when code contains just
    // typedefs/interfaces, which get transpiled to nothing but comments
    const code = `const __fakeValue = null;\n\n${src}`;
    // ts-morph throws a fit if the path already exists
    const sourceFile = project.createSourceFile(`${path.basename(filename, ".ts")}.ts-to-jsdoc.ts`, code);

    sourceFile.getClasses().forEach(generateClassDocumentation);

    const typedefs = sourceFile.getTypeAliases()
        .map((typeAlias) => generateTypedefDocumentation(typeAlias, sourceFile));

    const interfaces = sourceFile.getInterfaces()
        .map((interfaceNode) => generateInterfaceDocumentation(interfaceNode));

    sourceFile.getFunctions().forEach(generateFunctionDocumentation);

    const result = project.emitToMemory()?.getFiles()?.[0]?.text;
    if (result) {
      return `${result}\n\n${typedefs}\n\n${interfaces}`;
    }
  } catch (e) {
    debug && console.error(e);
    return src;
  }
  return src;
};
