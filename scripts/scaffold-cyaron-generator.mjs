#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function parseArgs(argv) {
  const options = {
    slug: "",
    title: "",
    source: "",
    targetDir: "",
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--help":
      case "-h":
        console.log(`Usage: node scripts/scaffold-cyaron-generator.mjs --slug my-problem [--title "My Problem"] [--source local:my-problem] [--target-dir problem-generators/custom/my-problem] [--force]`);
        process.exit(0);
        break;
      case "--slug":
        options.slug = String(next ?? "").trim();
        i += 1;
        break;
      case "--title":
        options.title = String(next ?? "").trim();
        i += 1;
        break;
      case "--source":
        options.source = String(next ?? "").trim();
        i += 1;
        break;
      case "--target-dir":
        options.targetDir = String(next ?? "").trim();
        i += 1;
        break;
      case "--force":
        options.force = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.slug) {
    throw new Error("--slug is required");
  }

  if (!options.title) {
    options.title = options.slug
      .split(/[-_]/g)
      .filter(Boolean)
      .map((item) => item[0].toUpperCase() + item.slice(1))
      .join(" ");
  }

  if (!options.source) {
    options.source = `local:${options.slug}`;
  }

  if (!options.targetDir) {
    options.targetDir = path.join("problem-generators", "custom", options.slug);
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildReadme(options) {
  return `# ${options.title}

这是通过 \`generator:scaffold:cyaron\` 生成的 CYaRon 外部生成器模板。

目录说明：

- \`std.cpp\`：先放你的标准解
- \`gen.py\`：根据题面、约束、标准代码和 case seed 生成输入
- \`validator.py\`：校验输入合法性
- \`testdata-generation-config.example.json\`：可贴进后台版本配置

推荐流程：

1. 把真实标准解替换到 \`std.cpp\`
2. 按题意改 \`gen.py\` 里的 \`build_case\`
3. 按输入格式改 \`validator.py\`
4. 把示例 JSON 粘到后台 \`testdataGenerationConfig\`

如果要启用完整 CYaRon：

\`\`\`bash
cd ${path.join(REPO_ROOT, options.targetDir)}
python3 -m pip install -r requirements.txt
\`\`\`
`;
}

function buildStdCpp() {
  return `#include <bits/stdc++.h>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  // TODO: replace with the real standard solution.
  return 0;
}
`;
}

function buildGenPy() {
  return `#!/usr/bin/env python3
import argparse
import os
import random
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
def discover_repo_root() -> str:
    override = os.environ.get("TESTDATA_REPO_ROOT")
    if override:
        return override

    current = SCRIPT_DIR
    while True:
        candidate = os.path.join(current, "problem-generators", "shared", "codemaster_external.py")
        if os.path.isfile(candidate):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return SCRIPT_DIR
        current = parent


REPO_ROOT = discover_repo_root()
SHARED_DIR = os.path.join(REPO_ROOT, "problem-generators", "shared")
if SHARED_DIR not in sys.path:
    sys.path.insert(0, SHARED_DIR)

from codemaster_external import (  # noqa: E402
    build_json_output,
    guess_array_limits,
    load_context,
    load_cyaron_backend,
    read_external_config,
    resolve_profile,
    seed_to_int,
)

backend = load_cyaron_backend()
CYARON_AVAILABLE = bool(backend["available"])
Vector = backend["Vector"]
randint = backend["randint"]


def random_vector(n: int, left: int, right: int) -> list[int]:
    try:
        values = Vector.random(n, [(left, right)])
        return [int(item) for item in values]
    except TypeError:
        return [randint(left, right) for _ in range(n)]
    except Exception:
        return [randint(left, right) for _ in range(n)]


def build_case(profile: str, context: dict) -> tuple[str, dict]:
    # TODO: replace this with real generation logic for your problem.
    # The default template assumes a problem with:
    #   n
    #   a1 a2 ... an
    limits = guess_array_limits(context, n_default=200000, value_default=1000000000)
    n_min = int(limits["n_min"])
    n_max = int(limits["n_max"])
    value_min = int(limits["value_min"])
    value_max = int(limits["value_max"])

    if profile == "tiny-edge":
        n = 1
        values = [0]
    elif profile == "max-random":
        n = n_max
        values = random_vector(n, value_min, value_max)
    elif profile == "dense-duplicates":
        n = min(max(32, n_min), n_max)
        palette = [value_min, -1, 0, 1, value_max]
        values = [int(random.choice(palette)) for _ in range(n)]
    else:
        n = min(max(16, n_min), n_max)
        values = random_vector(n, value_min, value_max)

    text = f"{n}\\n{' '.join(str(value) for value in values)}\\n"
    metadata = {
        "profile": profile,
        "n": n,
        "minValue": min(values),
        "maxValue": max(values),
    }
    return text, metadata


def main():
    parser = argparse.ArgumentParser(description="Scaffolded CYaRon generator template")
    parser.add_argument("--mode", default=None)
    parser.add_argument("--seed", default=os.environ.get("TESTDATA_CASE_SEED", "scaffold-demo"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    context = load_context()
    external = read_external_config(context)
    random.seed(seed_to_int(args.seed))
    profile = resolve_profile(args.mode, context, default=str(external.get("profile") or "default"))
    text, metadata = build_case(profile, context)

    if not CYARON_AVAILABLE:
      print("warning: cyaron not installed, fallback to Python random. install requirements.txt for full CYaRon mode.", file=sys.stderr)

    if args.json:
        print(build_json_output(text, metadata))
        return

    sys.stdout.write(text)


if __name__ == "__main__":
    main()
`;
}

function buildValidatorPy() {
  return `#!/usr/bin/env python3
import sys


def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


def main() -> int:
    content = sys.stdin.read()
    if not content.strip():
        return fail("empty_input")

    tokens = content.split()
    try:
        values = [int(token) for token in tokens]
    except ValueError:
        return fail("non_integer_token")

    if not values:
        return fail("missing_n")

    n = values[0]
    if n <= 0:
        return fail("n_must_be_positive")
    if len(values) != n + 1:
        return fail("token_count_mismatch")

    # TODO: replace with the real validator for your input format.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;
}

function buildConfig(options) {
  return JSON.stringify(
    {
      version: 1,
      groups: [
        {
          key: "tiny-edge",
          title: "Tiny Edge",
          count: 1,
          score: 10,
          visible: false,
          groupId: "edge",
          generator: {
            type: "external",
            params: {
              driver: "cyaron",
              cwd: options.targetDir.replace(/\\\\/g, "/"),
              command: ["python3", "gen.py", "--mode", "tiny-edge", "--seed", "{{caseSeed}}"],
              outputMode: "text",
              context: {
                profile: "tiny-edge",
              },
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        },
        {
          key: "random",
          title: "Random",
          count: 2,
          score: 40,
          visible: false,
          groupId: "random",
          generator: {
            type: "external",
            params: {
              driver: "cyaron",
              cwd: options.targetDir.replace(/\\\\/g, "/"),
              command: ["python3", "gen.py", "--mode", "default", "--seed", "{{caseSeed}}"],
              outputMode: "text",
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        },
        {
          key: "max-random",
          title: "Max Random",
          count: 1,
          score: 50,
          visible: false,
          groupId: "stress",
          generator: {
            type: "external",
            params: {
              driver: "cyaron",
              cwd: options.targetDir.replace(/\\\\/g, "/"),
              command: ["python3", "gen.py", "--mode", "max-random", "--seed", "{{caseSeed}}"],
              outputMode: "text",
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        },
      ],
    },
    null,
    2,
  ) + "\n";
}

async function writeExecutableFile(filePath, content) {
  await fs.writeFile(filePath, content, "utf8");
  if (filePath.endsWith(".py")) {
    await fs.chmod(filePath, 0o755);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetDir = path.resolve(REPO_ROOT, options.targetDir);

  if ((await pathExists(targetDir)) && !options.force) {
    throw new Error(`Target directory already exists: ${targetDir}. Pass --force to overwrite.`);
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  await Promise.all([
    writeExecutableFile(path.join(targetDir, "gen.py"), buildGenPy()),
    writeExecutableFile(path.join(targetDir, "validator.py"), buildValidatorPy()),
    fs.writeFile(path.join(targetDir, "requirements.txt"), "cyaron>=0.6.0\n", "utf8"),
    fs.writeFile(path.join(targetDir, "std.cpp"), buildStdCpp(), "utf8"),
    fs.writeFile(path.join(targetDir, "README.md"), buildReadme(options), "utf8"),
    fs.writeFile(path.join(targetDir, "testdata-generation-config.example.json"), buildConfig(options), "utf8"),
    fs.writeFile(
      path.join(targetDir, "problem.json"),
      JSON.stringify(
        {
          slug: options.slug,
          title: options.title,
          source: options.source,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    ),
  ]);

  console.log(JSON.stringify({
    ok: true,
    targetDir,
    slug: options.slug,
    title: options.title,
    source: options.source,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
