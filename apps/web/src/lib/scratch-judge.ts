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

export type ScratchScoreRuleItem = {
  score: number;
  rule: ScratchRuleSet;
};

export type ScratchScoreRuleSet = {
  role: string;
  rules: ScratchScoreRuleItem[];
  totalScore?: number;
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
  | { opcode: string } & Partial<BlockRule>;

type BindingState = {
  values: Map<string, string>;
  reverse: Map<string, string>;
};

type MatchContext = {
  blocks: Record<string, ScratchBlock>;
  bindings: BindingState;
};

export type ScratchJudgeResult = {
  ok: boolean;
  errors: string[];
};

export type ScratchScoreResult = {
  score: number;
  total: number;
  passed: number;
  errors: string[];
};

const PLACEHOLDER_PREFIX = "$";

export function judgeScratchProject(project: ScratchProject, rules: ScratchRuleSet): ScratchJudgeResult {
  if (!project?.targets?.length) {
    return { ok: false, errors: ["project_invalid"] };
  }

  const target = project.targets.find((t) => t.name === rules.role);
  if (!target) {
    return { ok: false, errors: ["role_not_found"] };
  }

  const scripts = extractScripts(target.blocks);
  const ctx: MatchContext = {
    blocks: target.blocks,
    bindings: { values: new Map(), reverse: new Map() },
  };

  for (const scriptRule of rules.scripts) {
    if (!matchScriptRule(scripts, scriptRule, ctx)) {
      return { ok: false, errors: ["script_rule_not_matched"] };
    }
  }

  return { ok: true, errors: [] };
}

export function scoreScratchProject(project: ScratchProject, ruleSet: ScratchScoreRuleSet): ScratchScoreResult {
  if (!project?.targets?.length) {
    return { score: 0, total: ruleSet.totalScore ?? 0, passed: 0, errors: ["project_invalid"] };
  }

  const target = project.targets.find((t) => t.name === ruleSet.role);
  if (!target) {
    return { score: 0, total: ruleSet.totalScore ?? 0, passed: 0, errors: ["role_not_found"] };
  }

  const scripts = extractScripts(target.blocks);
  const total = ruleSet.totalScore ?? ruleSet.rules.reduce((sum, item) => sum + (item.score ?? 0), 0);
  let score = 0;
  let passed = 0;
  const errors: string[] = [];

  for (const item of ruleSet.rules) {
    const ctx: MatchContext = {
      blocks: target.blocks,
      bindings: { values: new Map(), reverse: new Map() },
    };
    const ok = item.rule.scripts.every((scriptRule) =>
      matchScriptRule(scripts, scriptRule, ctx)
    );
    if (ok) {
      score += item.score ?? 0;
      passed += 1;
    } else {
      errors.push("script_rule_not_matched");
    }
  }

  return { score, total, passed, errors };
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

function matchScriptRule(
  scripts: { hatId: string; hatOpcode: string; chain: string[] }[],
  scriptRule: ScriptRule,
  ctx: MatchContext
) {
  const hats = Array.isArray(scriptRule.hat) ? scriptRule.hat : [scriptRule.hat];
  const candidates = scripts.filter((s) => hats.includes(s.hatOpcode));
  for (const script of candidates) {
    const attempt = matchGroupsInChain(script.chain, scriptRule.groups, ctx);
    if (attempt) return true;
  }
  return false;
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

function matchGroupsInChain(chain: string[], groups: GroupRule[], ctx: MatchContext) {
  let cursor = 0;
  for (const group of groups) {
    const mode = group.mode ?? "ordered";
    const res = mode === "unordered"
      ? matchUnorderedGroup(chain, cursor, group.blocks, ctx)
      : matchOrderedGroup(chain, cursor, group.blocks, ctx);
    if (!res) return false;
    cursor = res;
  }
  return true;
}

function matchOrderedGroup(
  chain: string[],
  start: number,
  blocks: BlockRule[],
  ctx: MatchContext
) {
  let cursor = start;
  for (const rule of blocks) {
    let found = false;
    for (let i = cursor; i < chain.length; i++) {
      if (matchBlock(chain[i], rule, ctx)) {
        cursor = i + 1;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return cursor;
}

function matchUnorderedGroup(
  chain: string[],
  start: number,
  blocks: BlockRule[],
  ctx: MatchContext
) {
  const used = new Set<number>();
  let maxIndex = start - 1;
  for (const rule of blocks) {
    let foundIndex: number | null = null;
    for (let i = start; i < chain.length; i++) {
      if (used.has(i)) continue;
      if (matchBlock(chain[i], rule, ctx)) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex === null) return false;
    used.add(foundIndex);
    if (foundIndex > maxIndex) maxIndex = foundIndex;
  }
  return maxIndex + 1;
}

function matchBlock(blockId: string, rule: BlockRule, ctx: MatchContext): boolean {
  const block = ctx.blocks[blockId];
  if (!block || block.opcode !== rule.opcode) return false;

  if (rule.fields) {
    for (const [fieldName, fieldRule] of Object.entries(rule.fields)) {
      const actual = readFieldValue(block, fieldName);
      if (actual == null) return false;
      if (!matchField(actual, fieldRule, ctx.bindings)) return false;
    }
  }

  if (rule.inputs) {
    for (const [inputName, inputRule] of Object.entries(rule.inputs)) {
      if (!matchInput(block, inputName, inputRule, ctx)) return false;
    }
  }

  if (rule.substack) {
    const subchain = getSubstackChain(block, "SUBSTACK", ctx.blocks);
    if (!matchGroupsInChain(subchain, [rule.substack], ctx)) return false;
  }

  if (rule.substack2) {
    const subchain = getSubstackChain(block, "SUBSTACK2", ctx.blocks);
    if (!matchGroupsInChain(subchain, [rule.substack2], ctx)) return false;
  }

  return true;
}

function getSubstackChain(block: ScratchBlock, key: string, blocks: Record<string, ScratchBlock>) {
  const input = readInput(block, key);
  if (!input || input.kind !== "block") return [];
  return linearizeChain(input.blockId, blocks);
}

function readFieldValue(block: ScratchBlock, name: string): string | number | null {
  const raw = block.fields?.[name];
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw[0] as string | number;
  }
  if (typeof raw === "string" || typeof raw === "number") return raw;
  return null;
}

function matchField(
  actual: string | number,
  rule: FieldRule,
  bindings: BindingState
) {
  const expected = typeof rule === "object" && rule !== null && "value" in rule ? rule.value : rule;
  if (typeof expected === "string" && expected.startsWith(PLACEHOLDER_PREFIX)) {
    const key = expected.slice(PLACEHOLDER_PREFIX.length);
    return bindPlaceholder(key, String(actual), bindings);
  }
  return String(actual) === String(expected);
}

function bindPlaceholder(key: string, actual: string, bindings: BindingState) {
  const existing = bindings.values.get(key);
  if (existing && existing !== actual) return false;
  const reverse = bindings.reverse.get(actual);
  if (reverse && reverse !== key) return false;
  bindings.values.set(key, actual);
  bindings.reverse.set(actual, key);
  return true;
}

function matchInput(block: ScratchBlock, name: string, rule: InputRule, ctx: MatchContext) {
  if (rule && typeof rule === "object" && "opcode" in rule) {
    const input = readInput(block, name);
    if (!input || input.kind !== "block") return false;
    return matchBlock(input.blockId, rule as BlockRule, ctx);
  }

  const expected = extractInputValue(rule);
  const actual = evaluateInput(block, name, ctx.blocks);
  if (actual == null) return false;
  return compareValues(actual, expected);
}

function extractInputValue(rule: InputRule): ScratchInputValue {
  if (rule && typeof rule === "object" && "value" in rule) {
    return rule.value as ScratchInputValue;
  }
  if (typeof rule === "string" || typeof rule === "number" || typeof rule === "boolean") {
    return rule;
  }
  return null;
}

function compareValues(actual: ScratchInputValue, expected: ScratchInputValue) {
  if (expected == null) return actual == null;
  if (typeof expected === "number") {
    const actualNum = typeof actual === "number" ? actual : Number(actual);
    if (Number.isNaN(actualNum)) return false;
    return Math.abs(actualNum - expected) < 1e-9;
  }
  return String(actual) === String(expected);
}

function evaluateInput(block: ScratchBlock, name: string, blocks: Record<string, ScratchBlock>) {
  const input = readInput(block, name);
  if (!input) return null;
  if (input.kind === "literal") return input.value;
  return evaluateExpression(input.blockId, blocks);
}

function readInput(block: ScratchBlock, name: string) {
  const raw = block.inputs?.[name];
  if (!Array.isArray(raw)) return null;
  const input = raw[1];
  const shadow = raw[2];
  if (typeof input === "string") return { kind: "block" as const, blockId: input };
  if (Array.isArray(input)) return { kind: "literal" as const, value: parseLiteral(input) };
  if (typeof shadow === "string") return { kind: "block" as const, blockId: shadow };
  if (Array.isArray(shadow)) return { kind: "literal" as const, value: parseLiteral(shadow) };
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
      const op = readFieldValue(block, "OPERATOR");
      const value = evaluateInput(block, "NUM", blocks);
      if (typeof op !== "string" || typeof value !== "number") return null;
      return applyMathOp(op, value);
    }
    default:
      return null;
  }
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
