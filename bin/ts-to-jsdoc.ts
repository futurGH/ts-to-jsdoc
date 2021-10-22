import fs from "fs";
import path from "path";

import { default as arg } from "arg";
import transpile from "../index";

const { ["--out"]: out, ["--ignore"]: ignore, ["--help"]: help, _ } = arg({
  "--out": String,
  "-o": "--out",
  "--output": "--out",

  "--ignore": [String],
  "-i": "--ignore",

  "--help": Boolean,
  "-h": "--help",
});

const args = { out, ignore, help, _ }

const helpMessage = `
Usage:
  ts-to-jsdoc [options] <path>...

Options:
  -h --help          Shows this.
  -o --out --output  Directory to output transpiled JavaScript. [default: source path]
  -i --ignore        File or directory paths to ignore when transpiling.`;

if (args.help || Object.keys(args).every((arg) => !args[arg]?.length)) {
  console.log(helpMessage);
  process.exit(0);
}

if (args.out) {
  args.out = makePathAbsolute(args.out);
  if (!fs.existsSync(args.out)) {
    console.error(error(`Output directory ${args.out} does not exist.`));
    process.exit(1);
  }
  if (!fs.lstatSync(args.out).isDirectory()) {
    console.error(error(`Output directory ${args.out} is not a directory.`));
    process.exit(1);
  }
}

args.ignore = args.ignore?.length ? normalizePaths(args.ignore) : [];

const paths = replaceDirectoriesWithFiles(
    [...new Set(normalizePaths(args._))], // Creating a Set then spreading removes duplicates
)
    .filter((filepath) => path.extname(filepath) === ".ts" && !filepath.endsWith(".d.ts"))
    .filter((filepath) =>
      !args.ignore.some(
          (ignoredPath) => filepath === ignoredPath || pathIsInside(filepath, ignoredPath),
      ),
    );

for (const filepath of paths) {
  const outPath = path.join(
      args.out ?? path.dirname(filepath),
      `${path.basename(filepath, ".ts")}.js`,
  );
  if (fs.existsSync(outPath)) {
    console.warn(warning(`Cannot write to ${outPath}; file already exists.`));
    continue;
  }

  const code = fs.readFileSync(filepath, "utf8");
  const transpiled = transpile(code, filepath, {}, true);
  if (transpiled === code) {
    console.error(error(`Could not transpile ${filepath}.`));
    continue;
  }

  fs.writeFileSync(outPath, transpiled);
}

function warning(message) {
  return `\u001B[93m[WARN]\u001B[39m ${message}`;
}

function error(message) {
  return `\u001B[91m[ERROR]\u001B[39m ${message}`;
}

function makePathAbsolute(filepath) {
  return path.isAbsolute(filepath) ?
    filepath :
    path.resolve(process.cwd(), filepath);
}

/**
 * Makes paths absolute, filtering those that exist
 * @param {Array<string>} paths An array of paths
 * @return {Array<string>} An array containing absolute paths that do exist
 */
function normalizePaths(paths) {
  return paths
      .map(makePathAbsolute)
      .filter((filepath) => {
        if (!fs.existsSync(filepath)) {
          console.warn(warning(`File or directory ${filepath} does not exist.`));
          return false;
        }
        return true;
      });
}

/**
 * Given an array of paths, recursively removes all directories and appends all files within said directories
 * @param {Array<string>} paths An array of paths
 * @return {Array<string>} An array containing only files, replacing directories with their contents
 */
function replaceDirectoriesWithFiles(paths) {
  let pathArray = [...paths];
  for (const [index, filepath] of pathArray.entries()) {
    if (fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory()) {
      pathArray.splice(index, 1);
      pathArray = pathArray
          .concat(replaceDirectoriesWithFiles(
              fs.readdirSync(filepath).map((file) => path.join(filepath, file)),
          ));
    }
  }
  return pathArray;
}

/**
 * @license WTFPL
 * Copyright © 2013–2016 Domenic Denicola <d@domenic.me>
 */
function pathIsInside(thePath, potentialParent) {
  // For inside-directory checking, we want to allow trailing slashes, so normalize.
  thePath = stripTrailingSep(thePath);
  potentialParent = stripTrailingSep(potentialParent);

  // Node treats only Windows as case-insensitive in its path module; we follow those conventions.
  if (process.platform === "win32") {
    thePath = thePath.toLowerCase();
    potentialParent = potentialParent.toLowerCase();
  }

  return thePath.lastIndexOf(potentialParent, 0) === 0 &&
      (
          thePath[potentialParent.length] === path.sep ||
          thePath[potentialParent.length] === undefined
      );
}

/**
 * @license WTFPL
 * Copyright © 2013–2016 Domenic Denicola <d@domenic.me>
 */
function stripTrailingSep(thePath) {
  if (thePath[thePath.length - 1] === path.sep) {
    return thePath.slice(0, -1);
  }
  return thePath;
}

