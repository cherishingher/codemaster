# Judge Sandbox Container

Minimal Docker image for secure code execution, used by both
`apps/web` (local runner) and `services/judge-agent`.

## Build

```bash
docker build -t codemaster-sandbox -f infra/sandbox/Dockerfile .
```

## Security features

- Runs as non-root user (`sandbox`, uid 65534)
- No network access (`--network none`)
- Read-only root filesystem (`--read-only`)
- Memory capped (`--memory`)
- CPU limited (`--cpus`)
- PID limit (`--pids-limit`)
- Writable tmpfs only for `/sandbox/work` and `/tmp`
- Auto-removed after execution (`--rm`)

## Manual test

```bash
echo '#include <iostream>\nint main(){std::cout<<"hello";return 0;}' > /tmp/test.cpp
docker run --rm --network none --memory 256m --cpus 1 --read-only \
  --tmpfs /sandbox/work:size=32m --tmpfs /tmp:size=8m \
  --pids-limit 32 \
  -v /tmp/test.cpp:/sandbox/work/main.cpp:ro \
  codemaster-sandbox sh -c "g++ -O2 -o /sandbox/work/main /sandbox/work/main.cpp && /sandbox/work/main"
```
