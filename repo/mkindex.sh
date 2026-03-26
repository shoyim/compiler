#!/bin/bash

BASEURL="https://github.com/shoyim/compiler/releases/download/pkgs/"

echo "name,version,sha256,url" > index

# Docker ichida barcha build bo'lgan paketlar /app/packages ichida bo'ladi
# Shuning uchun yo'lni /app/packages/* deb ko'rsatamiz
for pkg in /app/packages/*.pkg.tar.gz; do
    if [ -f "$pkg" ]; then
        # Fayl nomidan ma'lumotni ajratish (masalan: python-3.12.0.pkg.tar.gz)
        FILENAME=$(basename "$pkg")
        
        # Nom va versiyani ajratish (bash-5.1.0 -> bash va 5.1.0)
        # Bu yerda fayl nomi "nom-versiya.pkg.tar.gz" formatida deb hisoblanadi
        NAME_VER=${FILENAME%.pkg.tar.gz}
        LANG=${NAME_VER%-*}
        VERSION=${NAME_VER##*-}
        
        # Faylni joriy papkaga (repo papkasiga) nusxalash
        cp "$pkg" "./$FILENAME"
        
        # Xesh hisoblash
        HASH=$(sha256sum "$FILENAME" | cut -d' ' -f1)
        
        # Indexga yozish
        echo "${LANG},${VERSION},${HASH},${BASEURL}${FILENAME}" >> index
        echo "Qo'shildi: $FILENAME"
    fi
done

LINE_COUNT=$(wc -l < index)
if [ "$LINE_COUNT" -le 1 ]; then
    echo "Error: No packages found in /app/packages/ !"
    ls -R /app/packages
    exit 1
fi

echo "Tugadi. Jami $((LINE_COUNT-1)) paket."