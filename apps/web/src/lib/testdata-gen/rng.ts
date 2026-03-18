import type { NumericRangeSpec } from "@/lib/testdata-gen/types"

function hashSeed(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let index = 0; index < seed.length; index += 1) {
    h = Math.imul(h ^ seed.charCodeAt(index), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

export function createRandom(seed: string) {
  const nextSeed = hashSeed(seed)
  let state = nextSeed()
  return {
    float() {
      state += 0x6d2b79f5
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    int(min: number, max: number) {
      if (min > max) {
        throw new Error("random_range_invalid")
      }
      return Math.floor(this.float() * (max - min + 1)) + min
    },
    pick<T>(items: T[]) {
      if (items.length === 0) {
        throw new Error("random_pick_empty")
      }
      return items[this.int(0, items.length - 1)]
    },
  }
}

export function pickNumberFromRange(spec: NumericRangeSpec, seed: string) {
  const random = createRandom(seed)
  if (spec.values?.length) {
    return random.pick(spec.values)
  }
  if (spec.min === undefined || spec.max === undefined) {
    throw new Error("numeric_range_invalid")
  }
  return random.int(spec.min, spec.max)
}

export function resolveRangeBounds(spec: NumericRangeSpec) {
  if (spec.values?.length) {
    return {
      min: Math.min(...spec.values),
      max: Math.max(...spec.values),
    }
  }

  if (spec.min === undefined || spec.max === undefined) {
    throw new Error("numeric_range_invalid")
  }

  return { min: spec.min, max: spec.max }
}
