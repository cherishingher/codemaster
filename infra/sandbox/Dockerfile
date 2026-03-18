FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/false -u 65534 sandbox

RUN mkdir -p /sandbox/work && chown sandbox:sandbox /sandbox/work

USER sandbox
WORKDIR /sandbox/work
