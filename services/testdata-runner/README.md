# Testdata Runner Image

用于自动测试数据生成任务的最小执行镜像，包含：

- `g++`
- `python3`

本地构建：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
docker build -t codemaster-testdata-runner:latest services/testdata-runner
```

`judge-agent` 切换到 Docker 隔离执行：

```bash
export TESTDATA_RUNNER_MODE=docker
export TESTDATA_RUNNER_IMAGE=codemaster-testdata-runner:latest
```
