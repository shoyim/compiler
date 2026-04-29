#!/usr/bin/env bash

curl -L "https://dotnetcli.azureedge.net/dotnet/Sdk/9.0.100/dotnet-sdk-9.0.100-linux-x64.tar.gz" -Lo dotnet.tar.gz
tar xzf dotnet.tar.gz --strip-components=1
rm dotnet.tar.gz

# Cache nuget packages
export DOTNET_CLI_HOME=$PWD
./dotnet new console -o cache_application
./dotnet new console -lang F# -o fs_cache_application
./dotnet new console -lang VB -o vb_cache_application

rm -rf cache_application fs_cache_application vb_cache_application
