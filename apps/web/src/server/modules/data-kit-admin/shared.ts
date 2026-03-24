import * as path from "node:path"

export class DataKitError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export type DataKitToolKind = "generator" | "validator"

export type DataKitToolDefinition = {
  id: string
  kind: DataKitToolKind
  fileName: string
  title: string
  description: string
  sampleParams: Record<string, string>
}

export const DATA_KIT_GENERATORS: DataKitToolDefinition[] = [
  {
    id: "array",
    kind: "generator",
    fileName: "gen_array.cpp",
    title: "数组 / 序列",
    description: "覆盖随机、单调、重复值和常见 hack 模式，适合数组、排序、双指针、前缀和题。",
    sampleParams: { mode: "anti_greedy", n: "24", l: "1", r: "100", seed: "1" },
  },
  {
    id: "permutation",
    kind: "generator",
    fileName: "gen_permutation.cpp",
    title: "排列 / 置换",
    description: "支持随机排列、单环、多小环和接近恒等置换。",
    sampleParams: { mode: "many_small_cycles", n: "18", cycle_len: "3", seed: "1" },
  },
  {
    id: "queries",
    kind: "generator",
    fileName: "gen_queries.cpp",
    title: "区间 / 查询",
    description: "适合线段树、树状数组、莫队和离线查询题。",
    sampleParams: { mode: "range_sum", n: "10", q: "16", l: "1", r: "50", seed: "1" },
  },
  {
    id: "tree",
    kind: "generator",
    fileName: "gen_tree.cpp",
    title: "树",
    description: "支持链、菊花、二叉树、扫把树和随机树。",
    sampleParams: { mode: "broom", n: "16", handle_len: "9", seed: "1" },
  },
  {
    id: "graph",
    kind: "generator",
    fileName: "gen_graph.cpp",
    title: "一般图",
    description: "支持连通图、DAG、多连通块、重边、自环和类 SPFA hack 数据。",
    sampleParams: { mode: "random_connected", n: "12", m: "20", weighted: "1", seed: "2" },
  },
  {
    id: "shortest-path",
    kind: "generator",
    fileName: "gen_shortest_path.cpp",
    title: "最短路",
    description: "支持正权、0-1 边、等长最短路和类 SPFA killer。",
    sampleParams: { mode: "many_equal_paths", n: "18", layers: "4", width: "4", seed: "3" },
  },
  {
    id: "string",
    kind: "generator",
    fileName: "gen_string.cpp",
    title: "字符串",
    description: "支持周期串、回文、前后缀密集和 anti-hash。",
    sampleParams: { mode: "anti_hash", n: "48", seed: "1" },
  },
  {
    id: "grid",
    kind: "generator",
    fileName: "gen_grid.cpp",
    title: "网格",
    description: "适合 BFS、最短路、迷宫和搜索类题目。",
    sampleParams: { mode: "snake_path", n: "8", m: "14", seed: "1" },
  },
  {
    id: "math",
    kind: "generator",
    fileName: "gen_math.cpp",
    title: "数学 / 数论",
    description: "支持质数密集、合数密集、幂次边界和溢出边界。",
    sampleParams: { mode: "overflow_edge", n: "12", seed: "1" },
  },
  {
    id: "geometry",
    kind: "generator",
    fileName: "gen_geometry.cpp",
    title: "计算几何",
    description: "支持共线、重合点、大坐标和随机点。",
    sampleParams: { mode: "large_coords", n: "20", seed: "1" },
  },
  {
    id: "flow",
    kind: "generator",
    fileName: "gen_flow.cpp",
    title: "网络流 / 匹配",
    description: "支持随机网络、分层图和二分图匹配风格数据。",
    sampleParams: { mode: "bipartite", left: "4", right: "5", density: "60", seed: "4" },
  },
]

export const DATA_KIT_VALIDATORS: DataKitToolDefinition[] = [
  {
    id: "array",
    kind: "validator",
    fileName: "validator_array.cpp",
    title: "数组校验器",
    description: "校验 n 与值域边界，适合一维数组输入。",
    sampleParams: { min_n: "1", max_n: "200000", min_a: "-1000000000", max_a: "1000000000" },
  },
  {
    id: "permutation",
    kind: "validator",
    fileName: "validator_permutation.cpp",
    title: "排列校验器",
    description: "校验输入是否为 1..n 的合法排列。",
    sampleParams: { min_n: "1", max_n: "200000" },
  },
  {
    id: "queries",
    kind: "validator",
    fileName: "validator_queries.cpp",
    title: "查询校验器",
    description: "按 mode 校验查询型输入结构。",
    sampleParams: { mode: "range_sum", min_n: "1", max_n: "200000", min_q: "1", max_q: "200000" },
  },
  {
    id: "tree",
    kind: "validator",
    fileName: "validator_tree.cpp",
    title: "树校验器",
    description: "校验节点数量、边数和点编号范围。",
    sampleParams: { min_n: "1", max_n: "200000", weighted: "0" },
  },
  {
    id: "graph",
    kind: "validator",
    fileName: "validator_graph.cpp",
    title: "图校验器",
    description: "支持校验有向/无向、重边、自环和权值范围。",
    sampleParams: { min_n: "1", max_n: "200000", min_m: "0", max_m: "400000", weighted: "1" },
  },
  {
    id: "shortest-path",
    kind: "validator",
    fileName: "validator_shortest_path.cpp",
    title: "最短路校验器",
    description: "校验最短路图输入，含点边范围与权值范围。",
    sampleParams: { min_n: "2", max_n: "200000", min_w: "0", max_w: "1000000000" },
  },
  {
    id: "string",
    kind: "validator",
    fileName: "validator_string.cpp",
    title: "字符串校验器",
    description: "校验长度和字符集范围。",
    sampleParams: { min_n: "1", max_n: "200000", charset: "abcde" },
  },
  {
    id: "grid",
    kind: "validator",
    fileName: "validator_grid.cpp",
    title: "网格校验器",
    description: "校验网格尺寸与允许字符集合。",
    sampleParams: { min_n: "1", max_n: "2000", min_m: "1", max_m: "2000", allowed: ".#" },
  },
  {
    id: "geometry",
    kind: "validator",
    fileName: "validator_geometry.cpp",
    title: "几何校验器",
    description: "校验点数量与坐标范围。",
    sampleParams: { min_n: "1", max_n: "200000", min_x: "-1000000000", max_x: "1000000000" },
  },
  {
    id: "flow",
    kind: "validator",
    fileName: "validator_flow.cpp",
    title: "网络流校验器",
    description: "校验源汇点、容量和费用范围。",
    sampleParams: { min_n: "2", max_n: "200000", min_m: "1", max_m: "400000", cost: "0" },
  },
]

export const DATA_KIT_DOCS = [
  { slug: "overview", title: "README", filePath: "README.md" },
  { slug: "quick-start", title: "快速上手", filePath: path.join("docs", "quick-start.zh-CN.md") },
  { slug: "workflow", title: "出题工作流", filePath: path.join("docs", "workflow.zh-CN.md") },
] as const

export function getGeneratorById(id: string) {
  return DATA_KIT_GENERATORS.find((item) => item.id === id)
}

export function getValidatorById(id: string) {
  return DATA_KIT_VALIDATORS.find((item) => item.id === id)
}
