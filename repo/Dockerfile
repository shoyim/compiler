FROM debian:buster-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        unzip autoconf build-essential libssl-dev \
        pkg-config zlib1g-dev libargon2-dev libsodium-dev libcurl4-openssl-dev \
        sqlite3 libsqlite3-dev libonig-dev libxml2 libxml2-dev bc curl git \
        linux-headers-amd64 perl xz-utils python3 python3-pip gnupg jq \
        cmake cmake-doc extra-cmake-modules gcc binutils bash coreutils \
        util-linux pciutils usbutils findutils grep libncurses5-dev \
        libncursesw5-dev libgmp-dev libmpfr-dev python2 libffi-dev gfortran \
        libreadline-dev libblas-dev liblapack-dev libpcre3-dev libarpack2-dev libfftw3-dev \
        libglpk-dev libqhull-dev libqrupdate-dev libsuitesparse-dev libsundials-dev \
        libbz2-dev liblzma-dev libpcre2-dev gperf bison flex g++ gawk zip && \
        ln -sf /bin/bash /bin/sh && \
        update-alternatives --install /usr/bin/python python /usr/bin/python3 1 && \
        rm -rf /var/lib/apt/lists/*

COPY . /

RUN chmod +x /entrypoint.sh /mkindex.sh

ENTRYPOINT ["bash", "/entrypoint.sh"]
CMD ["--no-build"]