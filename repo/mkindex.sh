#!/bin/bash

BASEURL="https://github.com/shoyim/compiler/releases/download/pkgs/"
i=0

echo -n "" > index

for pkg in $(find ../packages -type f -name "*.pkg.tar.gz")
do
    DIR_NAME=$(basename $(dirname $(dirname $pkg)))
    VER_NAME=$(basename $(dirname $pkg))
    
    NEW_PKGFILE="${DIR_NAME}-${VER_NAME}.pkg.tar.gz"
    
    cp "$pkg" "./$NEW_PKGFILE"

    PKGCHECKSUM=$(sha256sum "./$NEW_PKGFILE" | awk '{print $1}')

    echo "$DIR_NAME,$VER_NAME,$PKGCHECKSUM,$BASEURL$NEW_PKGFILE" >> index
    echo "Adding package $DIR_NAME-$VER_NAME"
    
    ((i=i+1))
done

echo "Done: $i packages."