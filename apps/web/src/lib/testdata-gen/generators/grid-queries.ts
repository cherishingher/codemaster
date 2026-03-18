import { z } from "zod"
import { createRandom, pickNumberFromRange } from "@/lib/testdata-gen/rng"
import type {
  GeneratedCase,
  GeneratorContext,
  GridQueriesGeneratorParams,
  TestdataGenerator,
} from "@/lib/testdata-gen/types"

const NumericRangeSchema = z.object({
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  values: z.array(z.number().int()).min(1).optional(),
})

const GridQueriesParamsSchema = z.object({
  n: NumericRangeSchema,
  m: NumericRangeSchema,
  q: NumericRangeSchema,
  blockedValue: z.number().int().optional(),
  movableValue: z.number().int().optional(),
  movableCellRatio: z.number().positive().max(1).optional(),
  maxMovableCells: z.number().int().positive().optional(),
  queryArity: z.number().int().positive().optional(),
  distinctCoordinatePairs: z.boolean().optional(),
})

type Cell = {
  row: number
  col: number
}

function buildMovableBoard(
  random: ReturnType<typeof createRandom>,
  n: number,
  m: number,
  movableCellRatio: number,
  blockedValue: number,
  movableValue: number,
  minMovableCells: number,
  maxMovableCells?: number
) {
  const board = Array.from({ length: n }, () => Array.from({ length: m }, () => blockedValue))
  const movableCells: Cell[] = []

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < m; col += 1) {
      if (random.float() <= movableCellRatio) {
        board[row][col] = movableValue
        movableCells.push({ row: row + 1, col: col + 1 })
      }
    }
  }

  if (maxMovableCells && movableCells.length > maxMovableCells) {
    while (movableCells.length > maxMovableCells) {
      const index = random.int(0, movableCells.length - 1)
      const cell = movableCells[index]
      board[cell.row - 1][cell.col - 1] = blockedValue
      movableCells.splice(index, 1)
    }
  }

  let cursor = 0
  while (movableCells.length < minMovableCells) {
    const row = cursor % n
    const col = Math.floor(cursor / n) % m
    if (board[row][col] !== movableValue) {
      board[row][col] = movableValue
      movableCells.push({ row: row + 1, col: col + 1 })
    }
    cursor += 1
  }

  return {
    board,
    movableCells,
  }
}

function pickMovableCell(
  random: ReturnType<typeof createRandom>,
  cells: Cell[]
) {
  return cells[random.int(0, cells.length - 1)]
}

function buildQueryLine(
  random: ReturnType<typeof createRandom>,
  movableCells: Cell[],
  queryArity: number,
  distinctCoordinatePairs: boolean
) {
  const pairCount = Math.max(1, Math.floor(queryArity / 2))
  const chosen: Cell[] = []

  while (chosen.length < pairCount) {
    const next = pickMovableCell(random, movableCells)
    if (
      distinctCoordinatePairs &&
      chosen.some((item) => item.row === next.row && item.col === next.col)
    ) {
      continue
    }
    chosen.push(next)
  }

  return chosen.flatMap((cell) => [cell.row, cell.col]).join(" ")
}

export const gridQueriesGenerator: TestdataGenerator<GridQueriesGeneratorParams> = {
  type: "grid_queries",
  validateParams(params: unknown) {
    return GridQueriesParamsSchema.parse(params)
  },
  generate(context: GeneratorContext, params: GridQueriesGeneratorParams): GeneratedCase {
    const random = createRandom(context.seed)
    const n = pickNumberFromRange(params.n, `${context.seed}:n`)
    const m = pickNumberFromRange(params.m, `${context.seed}:m`)
    const q = pickNumberFromRange(params.q, `${context.seed}:q`)
    const blockedValue = params.blockedValue ?? 0
    const movableValue = params.movableValue ?? 1
    const queryArity = params.queryArity ?? 6
    const pairCount = Math.max(1, Math.floor(queryArity / 2))
    const distinctCoordinatePairs = params.distinctCoordinatePairs ?? true
    const movableCellRatio = params.movableCellRatio ?? 0.72
    const maxMovableCells = params.maxMovableCells

    // Keep enough movable cells so coordinate-based queries always reference legal positions.
    const { board, movableCells } = buildMovableBoard(
      random,
      n,
      m,
      movableCellRatio,
      blockedValue,
      movableValue,
      pairCount,
      maxMovableCells
    )

    const boardLines = board.map((row) => row.join(" "))
    const queryLines = Array.from({ length: q }, () =>
      buildQueryLine(random, movableCells, queryArity, distinctCoordinatePairs)
    )

    return {
      input: `${n} ${m} ${q}\n${boardLines.join("\n")}\n${queryLines.join("\n")}\n`,
      metadata: {
        n,
        m,
        q,
        queryArity,
        movableCells: movableCells.length,
      },
    }
  },
}
