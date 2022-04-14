// test/fixtures.test.js

// https://github.com/lukeed/uvu/blob/master/docs/api.assert.md
// https://github.com/lukeed/uvu/issues/65 # snapshot files

// fixture files
//   test/fixtures/test1/input.ts
//   test/fixtures/test1/expect.js
//   test/fixtures/test2/input.ts
//   test/fixtures/test2/expect.js

// pattern to select test files -> ignore fixture files
//  "scripts": {
//    "test": "uvu -r esm test/ '\\.test\\.js$'"
//  },

// update snapshot files
//   UPDATE_SNAPSHOTS=1 npm run test

import tsToJsdoc from '../index.js'
//import tsToJsdoc from 'ts-to-jsdoc'

import * as fs from 'fs';
//import { test } from 'uvu';
import { suite } from 'uvu';
import * as path from 'path';
import { promisify } from 'util';
import * as assert from 'uvu/assert';

const read = promisify(fs.readFile);
const write = promisify(fs.writeFile);
const exists = promisify(fs.exists);
const fixtures = path.resolve(__dirname, './fixtures');

const testSuite = suite('fixtures');

fs.readdirSync(fixtures).forEach(testname => {
  testSuite(testname, async () => {
    let infile = path.join(fixtures, testname, 'input.ts');
    let outfile = path.join(fixtures, testname, 'expect.js');
    //let actualfile = path.join(fixtures, testname, 'actual.js');

    let input = await read(infile, 'utf8');

    //let result = await transform(input);
    //let actual = result.code;
    let actual;
    if (testname == 'empty-filename') {
      // special case
      actual = tsToJsdoc(input);
    }
    else {
      actual = tsToJsdoc(input, infile);
    }

    //console.log(`input:\n---\n${input}\n---\n\nactual:\n---\n${actual}\n---`) // debug

    if (await exists(outfile) == false || process.env['UPDATE_SNAPSHOTS']) {
      // save snapshot to file
      await write(outfile, actual);
      // no assert. we have no expect value here
    }
    else {
      let expect = await read(outfile, 'utf8')
      assert.fixture(actual, expect);
      // TODO else: write actual result to actualfile
    }
  });
});

testSuite.run();
