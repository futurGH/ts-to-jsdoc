//function f( // FIXME this is not found by sourceFile.getExportedDeclarations()

/**
 * some function
 */
export function f(
  /** comment for parameter x */
  x: number,
  /** comment for parameter options */
  options?: {
    /** comment for type-literal property a */
    a: number;
    /** comment for type-literal property b */
    b?: number;
  }
): number;

function f(x, options) {
  if (options.a > 0) return x
  if (options.b > 0) return x
}
