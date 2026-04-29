#!/bin/bash

PREFIX=$(realpath $(dirname $0))

curl -L "https://downloads.python.org/pypy/pypy3.10-v7.3.12-linux64.tar.bz2" -o "$PREFIX/pypy.tar.bz2"
tar xjf "$PREFIX/pypy.tar.bz2" --strip-components=1 -C "$PREFIX"
rm "$PREFIX/pypy.tar.bz2"

"$PREFIX/bin/pypy3" -m ensurepip
"$PREFIX/bin/pypy3" -m pip install --prefer-binary numpy scipy pandas pycryptodome sympy || true
