#!/bin/bash

# GitHub Release havolasi
BASEURL="https://github.com/shoyim/compiler/releases/download/pkgs/"

# Index faylini sarlavha bilan yaratish
echo "name,version,sha256,url" > index

# Paketlarni qidirish (Hozirgi papkadan bir pog'ona yuqoridagi packages papkasi)
# find buyrug'ini tushunarliroq qilamiz
for pkg in ../packages/*/*/pkg.tar.gz; do
    # Agar fayl mavjud bo'lsa
    if [ -f "$pkg" ]; then
        # Yo'ldan ma'lumotlarni ajratish
        # ../packages/python/3.12.0/pkg.tar.gz -> python va 3.12.0
        VERSION=$(basename $(dirname "$pkg"))
        LANG=$(basename $(dirname $(dirname "$pkg")))
        
        NEW_NAME="${LANG}-${VERSION}.pkg.tar.gz"
        
        # Faylni nusxalash va nomini o'zgartirish
        cp "$pkg" "./$NEW_NAME"
        
        # Xesh hisoblash
        HASH=$(sha256sum "$NEW_NAME" | cut -d' ' -f1)
        
        # Indexga yozish
        echo "${LANG},${VERSION},${HASH},${BASEURL}${NEW_NAME}" >> index
        echo "Qo'shildi: $NEW_NAME"
    fi
done

# Tekshirish: Indexda sarlavhadan tashqari yana qator bormi?
LINE_COUNT=$(wc -l < index)
if [ "$LINE_COUNT" -le 1 ]; then
    echo "Error: No packages found!"
    # Debug uchun papkalarni ko'rsatish
    ls -R ..
    exit 1
fi

echo "Tugadi. Jami $((LINE_COUNT-1)) paket."