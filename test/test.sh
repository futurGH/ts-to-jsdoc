#! /bin/sh

name=extra-jsdoc-comments

echo src
find test/$name/src -type f

# fixme: -f is not working
# [WARN] Cannot write to /home/user/src/milahu/ts-to-jsdoc/test/out/index.d.js; file already exists.
rm -rf test/$name/out

node bin/ts-to-jsdoc.js test/$name/src -o test/$name/out -f

echo out
find test/$name/out -type f
