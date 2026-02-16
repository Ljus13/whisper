export type TravelResource = 'travel' | 'spirit'

export type TravelRule = {
  resource: TravelResource
  moveCost: number
  crossMapCost: number
}

export const DEFAULT_TRAVEL_RULE: TravelRule = {
  resource: 'travel',
  moveCost: 1,
  crossMapCost: 3,
}

type TravelRuleConfig = {
  pathwayName: string
  minSeq: number
  maxSeq: number
  resource: TravelResource
  moveCost: number
  crossMapCost: number
}

const SPECIAL_TRAVEL_RULES: TravelRuleConfig[] = [
  { pathwayName: 'ลูกศิษย์', minSeq: 0, maxSeq: 5, resource: 'spirit', moveCost: 1, crossMapCost: 1 },
]

export type PathwayRow = {
  pathway?: { name: string } | { name: string }[] | null
  sequence?: { seq_number: number } | { seq_number: number }[] | null
}

export function normalizePathwayRows(rows: PathwayRow[]) {
  return rows.map(row => {
    const pathway = Array.isArray(row.pathway) ? row.pathway[0] : row.pathway
    const sequence = Array.isArray(row.sequence) ? row.sequence[0] : row.sequence
    return {
      pathwayName: pathway?.name,
      seqNumber: sequence?.seq_number,
    }
  })
}

export function resolveTravelRule(entries: { pathwayName?: string | null; seqNumber?: number | null }[]): TravelRule {
  for (const rule of SPECIAL_TRAVEL_RULES) {
    const matched = entries.some(e =>
      e.pathwayName === rule.pathwayName &&
      typeof e.seqNumber === 'number' &&
      e.seqNumber >= rule.minSeq &&
      e.seqNumber <= rule.maxSeq
    )
    if (matched) {
      return {
        resource: rule.resource,
        moveCost: rule.moveCost,
        crossMapCost: rule.crossMapCost,
      }
    }
  }
  return DEFAULT_TRAVEL_RULE
}
