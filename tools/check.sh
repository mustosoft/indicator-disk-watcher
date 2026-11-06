#!/bin/sh
set -eu
npm test
node --check gnome/extension.js
glib-compile-schemas --strict --dry-run schemas
check_dir=$(mktemp -d)
trap 'rm -rf "$check_dir"' EXIT
valac elementary/core.vala tests/core.vala -X -lm -o "$check_dir/core-test"
"$check_dir/core-test" tests/format.tsv
