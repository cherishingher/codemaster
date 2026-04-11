# 拯救世界

这是通过 `generator:scaffold:cyaron` 生成的 CYaRon 外部生成器模板。

目录说明：

- `std.cpp`：先放你的标准解
- `gen.py`：根据题面、约束、标准代码和 case seed 生成输入
- `validator.py`：校验输入合法性
- `testdata-generation-config.example.json`：可贴进后台版本配置

推荐流程：

1. 把真实标准解替换到 `std.cpp`
2. 按题意改 `gen.py` 里的 `build_case`
3. 按输入格式改 `validator.py`
4. 把示例 JSON 粘到后台 `testdataGenerationConfig`

如果要启用完整 CYaRon：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/custom/problem-521
python3 -m pip install -r requirements.txt
```
