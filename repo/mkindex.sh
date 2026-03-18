#!/bin/bash

BASEURL="https://github.com/shoyim/compiler/releases/download/pkgs/"
i=0

echo -n "name,version,sha256,url" > index

find ../packages -type f -name "*.pkg.tar.gz" | while read -r pkg; do
    VER_NAME=$(basename $(dirname "$pkg"))
    DIR_NAME=$(basename $(dirname $(dirname "$pkg")))
    
    NEW_PKGFILE="${DIR_NAME}-${VER_NAME}.pkg.tar.gz"
    
    cp "$pkg" "./$NEW_PKGFILE"

    PKGCHECKSUM=$(sha256sum "./$NEW_PKGFILE" | awk '{print $1}')

    echo -e "\n$DIR_NAME,$VER_NAME,$PKGCHECKSUM,$BASEURL$NEW_PKGFILE" >> index
    echo "Adding package $DIR_NAME-$VER_NAME"
    
    ((i=i+1))
done

if [ ! -s index ] || [ $(cat index | wc -l) -le 1 ]; then
    echo "Error: No packages found!"
    exit 1
fi

echo "Done: $i packages."