#!/bin/bash

PREFIX=$(realpath $(dirname $0))

mkdir -p build
cd build

curl -L "https://downloads.python.org/pypy/pypy3.10-v7.3.12-linux64.tar.bz2" -o pypy.tar.bz2
tar xjf pypy.tar.bz2 --strip-components=1
rm pypy.tar.bz2

cp -r ./* "$PREFIX/"

cd ..
rm -rf build

bin/pypy3 -m ensurepip
bin/pypy3 -m pip install numpy scipy pandas pycryptodome sympy
