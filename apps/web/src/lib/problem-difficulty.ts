export const LUOGU_DIFFICULTY_BANDS = [
  {
    id: "unrated",
    label: "暂无评定",
    fullLabel: "暂无评定",
    values: [0],
    textClassName: "text-slate-300",
    className: "border-slate-200 bg-slate-50 text-slate-400",
    solidClassName: "border-slate-300 bg-slate-200 text-slate-700",
  },
  {
    id: "red",
    label: "入门",
    fullLabel: "入门",
    values: [1],
    textClassName: "text-rose-500",
    className: "border-red-200 bg-red-50 text-red-700",
    solidClassName: "border-red-300 bg-red-500 text-white",
  },
  {
    id: "orange",
    label: "普及-",
    fullLabel: "普及-",
    values: [2],
    textClassName: "text-orange-500",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    solidClassName: "border-orange-300 bg-orange-500 text-white",
  },
  {
    id: "yellow",
    label: "普及/提高-",
    fullLabel: "普及/提高-",
    values: [3],
    textClassName: "text-amber-400",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    solidClassName: "border-amber-300 bg-amber-400 text-slate-900",
  },
  {
    id: "green",
    label: "普及+/提高",
    fullLabel: "普及+/提高",
    values: [4, 5],
    textClassName: "text-lime-500",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    solidClassName: "border-emerald-300 bg-emerald-500 text-white",
  },
  {
    id: "blue",
    label: "提高+/省选-",
    fullLabel: "提高+/省选-",
    values: [6, 7],
    textClassName: "text-sky-500",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    solidClassName: "border-sky-300 bg-sky-500 text-white",
  },
  {
    id: "purple",
    label: "省选/NOI-",
    fullLabel: "省选/NOI-",
    values: [8, 9],
    textClassName: "text-violet-600",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    solidClassName: "border-violet-300 bg-violet-500 text-white",
  },
  {
    id: "black",
    label: "NOI/NOI+/CTSC",
    fullLabel: "NOI/NOI+/CTSC",
    values: [10],
    textClassName: "text-indigo-950",
    className: "border-slate-700 bg-slate-100 text-slate-900",
    solidClassName: "border-indigo-950 bg-indigo-950 text-white",
  },
] as const

export type LuoguDifficultyBandId = (typeof LUOGU_DIFFICULTY_BANDS)[number]["id"]

export function isLuoguDifficultyBandId(value: string | null | undefined): value is LuoguDifficultyBandId {
  if (!value) return false
  return LUOGU_DIFFICULTY_BANDS.some((band) => band.id === value)
}

export function getLuoguDifficultyBandById(id: LuoguDifficultyBandId) {
  return LUOGU_DIFFICULTY_BANDS.find((band) => band.id === id) ?? LUOGU_DIFFICULTY_BANDS[0]
}

export function getDifficultyValuesForLuoguBand(id: LuoguDifficultyBandId) {
  return getLuoguDifficultyBandById(id).values
}

export function getLuoguDifficultyBandByDifficulty(difficulty: number | null | undefined) {
  if (difficulty === null || difficulty === undefined || !Number.isFinite(difficulty)) {
    return LUOGU_DIFFICULTY_BANDS[0]
  }

  const normalized = Math.round(difficulty as number)
  if (normalized <= 0) {
    return LUOGU_DIFFICULTY_BANDS[0]
  }

  const clamped = Math.min(Math.max(normalized, 1), 10)
  return (
    LUOGU_DIFFICULTY_BANDS.find((band) => band.values.includes(clamped)) ??
    LUOGU_DIFFICULTY_BANDS[LUOGU_DIFFICULTY_BANDS.length - 1]
  )
}

export function inferLuoguDifficultyBandFromDifficultyParam(raw: string | null | undefined) {
  if (!raw) return "all" as const

  const values = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.min(Math.max(Math.round(value), 1), 10))

  if (values.length === 0) return "all" as const

  const matchedBand = LUOGU_DIFFICULTY_BANDS.find((band) =>
    band.values.length === values.length && band.values.every((value) => values.includes(value))
  )

  if (matchedBand) return matchedBand.id

  if (values.length === 1) {
    return getLuoguDifficultyBandByDifficulty(values[0]).id
  }

  return "all" as const
}
