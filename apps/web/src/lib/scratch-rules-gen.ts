type ScratchInputValue = string | number | boolean | null;

type ScratchBlock = {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  topLevel?: boolean;
};

type ScratchTarget = {
  name: string;
  isStage?: boolean;
  blocks: Record<string, ScratchBlock>;
};

type ScratchProject = {
  targets: ScratchTarget[];
};

export type ScratchRuleSet = {
  role: string;
  scripts: ScriptRule[];
};

export type ScriptRule = {
  hat: string | string[];
  groups: GroupRule[];
};

export type GroupRule = {
  mode?: "ordered" | "unordered";
  blocks: BlockRule[];
};

export type BlockRule = {
  opcode: string;
  fields?: Record<string, FieldRule>;
  inputs?: Record<string, InputRule>;
  substack?: GroupRule;
  substack2?: GroupRule;
};

export type FieldRule = string | number | { value: string | number };

export type InputRule =
  | string
  | number
  | boolean
  | { value: string | number | boolean }
  | ({ opcode: string } & Partial<BlockRule>);

type GeneratorOptions = {
  role?: string;
  topLevelUnorderedHatOpcodes?: string[];
  substackMode?: "ordered" | "unordered";
};

const DEFAULT_TOPLEVEL_UNORDERED = new Set(["event_whenflagclicked"]);

export function generateScratchRuleSet(
  project: ScratchProject,
  options: GeneratorOptions = {}
): ScratchRuleSet {
  if (!project?.targets?.length) {
    throw new Error("project_invalid");
  }
  const roleName = options.role ?? pickDefaultRole(project.targets);
  const target = project.targets.find((t) => t.name === roleName);
  if (!target) {
    throw new Error("role_not_found");
  }

  const scripts = extractScripts(target.blocks);
  const rules: ScriptRule[] = scripts.map((script) => {
    const bodyChain = script.chain.slice(1);
    const mode = resolveTopLevelMode(script.hatOpcode, options);
    const group: GroupRule = {
      mode,
      blocks: bodyChain.map((id) => buildBlockRule(id, target.blocks, options, new Set())),
    };
    return {
      hat: script.hatOpcode,
      groups: group.blocks.length ? [group] : [],
    };
  });

  return { role: roleName, scripts: rules };
}

function pickDefaultRole(targets: ScratchTarget[]) {
  const sprite = targets.find((t) => !t.isStage);
  return (sprite ?? targets[0]).name;
}

function resolveTopLevelMode(hatOpcode: string, options: GeneratorOptions) {
  const custom = options.topLevelUnorderedHatOpcodes;
  if (custom) {
    return custom.includes(hatOpcode) ? "unordered" : "ordered";
  }
  return DEFAULT_TOPLEVEL_UNORDERED.has(hatOpcode) ? "unordered" : "ordered";
}

function extractScripts(blocks: Record<string, ScratchBlock>) {
  const scripts: { hatId: string; hatOpcode: string; chain: string[] }[] = [];
  for (const [id, block] of Object.entries(blocks)) {
    if (block.topLevel && !block.parent) {
      const chain = linearizeChain(id, blocks);
      scripts.push({ hatId: id, hatOpcode: block.opcode, chain });
    }
  }
  return scripts;
}

function linearizeChain(startId: string, blocks: Record<string, ScratchBlock>) {
  const chain: string[] = [];
  let current: string | null | undefined = startId;
  const seen = new Set<string>();
  while (current && blocks[current] && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = blocks[current].next;
  }
  return chain;
}

function buildBlockRule(
  blockId: string,
  blocks: Record<string, ScratchBlock>,
  options: GeneratorOptions,
  visited: Set<string>
): BlockRule {
  const block = blocks[blockId];
  if (!block) {
    return { opcode: "unknown" };
  }
  if (visited.has(blockId)) {
    return { opcode: block.opcode };
  }
  visited.add(blockId);

  const rule: BlockRule = { opcode: block.opcode };

  const fields = extractFields(block);
  if (fields) rule.fields = fields;

  const inputs = extractInputs(block, blocks, options, visited);
  if (inputs) rule.inputs = inputs;

  const substack = buildSubstackGroup(block, blocks, options, "SUBSTACK");
  if (substack?.blocks.length) rule.substack = substack;

  const substack2 = buildSubstackGroup(block, blocks, options, "SUBSTACK2");
  if (substack2?.blocks.length) rule.substack2 = substack2;

  return rule;
}

function extractFields(block: ScratchBlock) {
  if (!block.fields) return undefined;
  const result: Record<string, FieldRule> = {};
  for (const [name, raw] of Object.entries(block.fields)) {
    const value = readFieldValue(raw);
    if (value == null) continue;
    result[name] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function readFieldValue(raw: unknown): string | number | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const val = raw[0];
    if (typeof val === "string" || typeof val === "number") return val;
    return null;
  }
  if (typeof raw === "string" || typeof raw === "number") return raw;
  return null;
}

function extractInputs(
  block: ScratchBlock,
  blocks: Record<string, ScratchBlock>,
  options: GeneratorOptions,
  visited: Set<string>
) {
  if (!block.inputs) return undefined;
  const result: Record<string, InputRule> = {};
  for (const [name, raw] of Object.entries(block.inputs)) {
    if (name === "SUBSTACK" || name === "SUBSTACK2") continue;
    const input = readInput(raw);
    if (!input) continue;
    if (input.kind === "literal") {
      result[name] = input.value;
      continue;
    }
    const evaluated = evaluateExpression(input.blockId, blocks);
    if (evaluated != null) {
      result[name] = evaluated;
      continue;
    }
    result[name] = buildInlineRule(input.blockId, blocks, options, visited);
  }
  return Object.keys(result).length ? result : undefined;
}

function buildInlineRule(
  blockId: string,
  blocks: Record<string, ScratchBlock>,
  options: GeneratorOptions,
  visited: Set<string>
): BlockRule {
  const rule = buildBlockRule(blockId, blocks, options, visited);
  return rule;
}

function buildSubstackGroup(
  block: ScratchBlock,
  blocks: Record<string, ScratchBlock>,
  options: GeneratorOptions,
  key: string
) {
  const input = readInput(block.inputs?.[key]);
  if (!input || input.kind !== "block") return undefined;
  const chain = linearizeChain(input.blockId, blocks);
  const mode = options.substackMode ?? "unordered";
  return {
    mode,
    blocks: chain.map((id) => buildBlockRule(id, blocks, options, new Set())),
  } satisfies GroupRule;
}

type ReadInputResult =
  | { kind: "block"; blockId: string }
  | { kind: "literal"; value: ScratchInputValue };

function readInput(raw: unknown): ReadInputResult | null {
  if (!Array.isArray(raw)) return null;
  const input = raw[1];
  const shadow = raw[2];
  if (typeof input === "string") return { kind: "block", blockId: input };
  if (Array.isArray(input)) return { kind: "literal", value: parseLiteral(input) };
  if (typeof shadow === "string") return { kind: "block", blockId: shadow };
  if (Array.isArray(shadow)) return { kind: "literal", value: parseLiteral(shadow) };
  return null;
}

function parseLiteral(lit: unknown): ScratchInputValue {
  if (!Array.isArray(lit)) return null;
  const value = lit[1];
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    if (!Number.isNaN(num) && value.trim() !== "") return num;
    return value;
  }
  return null;
}

function evaluateExpression(blockId: string, blocks: Record<string, ScratchBlock>): ScratchInputValue {
  const block = blocks[blockId];
  if (!block) return null;

  switch (block.opcode) {
    case "operator_add":
      return calcBinary(block, blocks, (a, b) => a + b);
    case "operator_subtract":
      return calcBinary(block, blocks, (a, b) => a - b);
    case "operator_multiply":
      return calcBinary(block, blocks, (a, b) => a * b);
    case "operator_divide":
      return calcBinary(block, blocks, (a, b) => a / b);
    case "operator_mod":
      return calcBinary(block, blocks, (a, b) => a % b);
    case "operator_round": {
      const value = evaluateInput(block, "NUM", blocks);
      if (typeof value !== "number") return null;
      return Math.round(value);
    }
    case "operator_mathop": {
      const op = readFieldValue(block.fields?.["OPERATOR"]);
      const value = evaluateInput(block, "NUM", blocks);
      if (typeof op !== "string" || typeof value !== "number") return null;
      return applyMathOp(op, value);
    }
    default:
      return null;
  }
}

function evaluateInput(block: ScratchBlock, name: string, blocks: Record<string, ScratchBlock>) {
  const input = readInput(block.inputs?.[name]);
  if (!input) return null;
  if (input.kind === "literal") return input.value;
  return evaluateExpression(input.blockId, blocks);
}

function calcBinary(
  block: ScratchBlock,
  blocks: Record<string, ScratchBlock>,
  fn: (a: number, b: number) => number
) {
  const a = evaluateInput(block, "NUM1", blocks);
  const b = evaluateInput(block, "NUM2", blocks);
  if (typeof a !== "number" || typeof b !== "number") return null;
  return fn(a, b);
}

function applyMathOp(op: string, value: number) {
  switch (op) {
    case "abs":
      return Math.abs(value);
    case "floor":
      return Math.floor(value);
    case "ceiling":
      return Math.ceil(value);
    case "sqrt":
      return Math.sqrt(value);
    case "sin":
      return Math.sin((value * Math.PI) / 180);
    case "cos":
      return Math.cos((value * Math.PI) / 180);
    case "tan":
      return Math.tan((value * Math.PI) / 180);
    case "asin":
      return (Math.asin(value) * 180) / Math.PI;
    case "acos":
      return (Math.acos(value) * 180) / Math.PI;
    case "atan":
      return (Math.atan(value) * 180) / Math.PI;
    case "ln":
      return Math.log(value);
    case "log":
      return Math.log10(value);
    case "e ^":
      return Math.exp(value);
    case "10 ^":
      return Math.pow(10, value);
    default:
      return null;
  }
}
