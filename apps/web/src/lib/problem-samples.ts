export type ProblemSampleDraft = {
  input: string;
  output: string;
  explain?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseProblemSamplesText(text: string): {
  items: ProblemSampleDraft[];
  error: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], error: null };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { items: [], error: "样例必须是 JSON 数组。" };
    }

    const items = parsed.map((item, index) => {
      if (!isObject(item)) {
        throw new Error(`第 ${index + 1} 个样例不是对象。`);
      }

      const input = item.input;
      const output = item.output;
      const explain = item.explain;

      if (typeof input !== "string" || typeof output !== "string") {
        throw new Error(`第 ${index + 1} 个样例缺少字符串类型的 input/output。`);
      }

      if (explain !== undefined && typeof explain !== "string") {
        throw new Error(`第 ${index + 1} 个样例 explain 必须是字符串。`);
      }

      return {
        input,
        output,
        explain,
      };
    });

    return { items, error: null };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "样例 JSON 解析失败。",
    };
  }
}
