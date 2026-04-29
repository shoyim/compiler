#!/usr/bin/env bash

# Download and extract JDK 21
curl -L "https://download.java.net/java/GA/jdk21.0.2/f2283984656d49d69e91c558476027ac/13/GPL/openjdk-21.0.2_linux-x64_bin.tar.gz" -o jdk.tar.gz
tar xzf jdk.tar.gz --strip-components=1
rm jdk.tar.gz

# Download and extract Kotlin
curl -L "https://github.com/JetBrains/kotlin/releases/download/v2.2.0/kotlin-compiler-2.2.0.zip" -o kotlin.zip
unzip kotlin.zip
rm kotlin.zip
cp -r kotlinc/* .
rm -rf kotlinc
