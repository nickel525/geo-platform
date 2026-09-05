import { uniqueSupplyFlows } from '../../lib/graph'
import type { Entity, Relationship } from '../../types/domain'

export type NodeRole = 'upstream' | 'focus' | 'downstream'

export type LaidOutNode = {
  id: string
  x: number
  y: number
  rank: number
  role: NodeRole
}

export type GraphColumn = {
  rank: number
  x: number
  label: string
}

export type GraphBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type GraphLayout = {
  nodes: LaidOutNode[]
  columns: GraphColumn[]
  bounds: GraphBounds
  width: number
  height: number
  focus: { x: number; y: number }
}

export const NODE_HALF_W = 92
export const NODE_HALF_H = 26

const COL_GAP = 320
const ROW_GAP = 72
const HEADER = 36

export function layoutDependencyGraph(
  entities: Entity[],
  relationships: Relationship[],
  focusId: string | null,
): GraphLayout {
  const ids = entities.map((entity) => entity.id)
  if (ids.length === 0 || !focusId || !ids.includes(focusId)) {
    return emptyLayout()
  }

  const names = new Map(entities.map((entity) => [entity.id, entity.name]))
  const flows = uniqueSupplyFlows(relationships).filter(
    (flow) => ids.includes(flow.upstream) && ids.includes(flow.downstream),
  )
  const ranks = assignRanks(focusId, ids, flows)
  const order = orderColumns(ids, ranks, flows, names)
  const nodes = placeNodes(order, focusId)
  const bounds = boundsOf(nodes)
  const columns = [...new Set(ranks.values())]
    .sort((a, b) => a - b)
    .map((rank) => ({
      rank,
      x: rank * COL_GAP,
      label: columnLabel(rank),
    }))

  return {
    nodes,
    columns,
    bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    focus: { x: 0, y: 0 },
  }
}

function emptyLayout(): GraphLayout {
  return {
    nodes: [],
    columns: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    width: 0,
    height: 0,
    focus: { x: 0, y: 0 },
  }
}

function assignRanks(
  focusId: string,
  ids: string[],
  flows: Array<{ upstream: string; downstream: string }>,
): Map<string, number> {
  const ranks = new Map<string, number>([[focusId, 0]])
  const queue = [focusId]
  const present = new Set(ids)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const rank = ranks.get(current) ?? 0
    for (const flow of flows) {
      let next: string | null = null
      let nextRank = rank
      if (flow.downstream === current && present.has(flow.upstream)) {
        next = flow.upstream
        nextRank = rank - 1
      } else if (flow.upstream === current && present.has(flow.downstream)) {
        next = flow.downstream
        nextRank = rank + 1
      }
      if (!next || ranks.has(next)) continue
      ranks.set(next, nextRank)
      queue.push(next)
    }
  }

  for (const id of ids) {
    if (!ranks.has(id)) ranks.set(id, 1)
  }
  return ranks
}

function orderColumns(
  ids: string[],
  ranks: Map<string, number>,
  flows: Array<{ upstream: string; downstream: string }>,
  names: Map<string, string>,
): Map<number, string[]> {
  const byRank = new Map<number, string[]>()
  for (const id of ids) {
    const rank = ranks.get(id) ?? 0
    const column = byRank.get(rank) ?? []
    column.push(id)
    byRank.set(rank, column)
  }

  const nameOf = (id: string) => names.get(id) ?? id
  for (const column of byRank.values()) {
    column.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  }

  const ranksSorted = [...byRank.keys()].sort((a, b) => a - b)
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const forward = sweep % 2 === 0
    const walk = forward ? ranksSorted : [...ranksSorted].reverse()
    for (const rank of walk) {
      const column = byRank.get(rank)
      if (!column || column.length < 2) continue
      const neighborRank = forward ? rank + 1 : rank - 1
      const neighbor = byRank.get(neighborRank)
      if (!neighbor || neighbor.length === 0) continue
      const indexOf = new Map(neighbor.map((id, index) => [id, index]))
      column.sort((a, b) => {
        const da = barycenter(a, flows, indexOf) - barycenter(b, flows, indexOf)
        if (da !== 0) return da
        return nameOf(a).localeCompare(nameOf(b))
      })
    }
  }

  return byRank
}

function barycenter(
  id: string,
  flows: Array<{ upstream: string; downstream: string }>,
  neighborIndex: Map<string, number>,
): number {
  const hits: number[] = []
  for (const flow of flows) {
    if (flow.upstream === id && neighborIndex.has(flow.downstream)) {
      hits.push(neighborIndex.get(flow.downstream) ?? 0)
    }
    if (flow.downstream === id && neighborIndex.has(flow.upstream)) {
      hits.push(neighborIndex.get(flow.upstream) ?? 0)
    }
  }
  if (hits.length === 0) return 0
  return hits.reduce((sum, value) => sum + value, 0) / hits.length
}

function placeNodes(
  order: Map<number, string[]>,
  focusId: string,
): LaidOutNode[] {
  const nodes: LaidOutNode[] = []
  for (const [rank, column] of order) {
    column.forEach((id, index) => {
      const y =
        id === focusId ? 0 : (index - (column.length - 1) / 2) * ROW_GAP
      const role: NodeRole = rank < 0 ? 'upstream' : rank > 0 ? 'downstream' : 'focus'
      nodes.push({
        id,
        x: rank * COL_GAP,
        y,
        rank,
        role: id === focusId ? 'focus' : role,
      })
    })
  }
  return nodes
}

function columnLabel(rank: number): string {
  if (rank === 0) return 'Selected'
  if (rank === -1) return 'Suppliers'
  if (rank === 1) return 'Customers'
  if (rank < 0) return `Tier ${-rank}`
  return `Downstream ${rank}`
}

function boundsOf(nodes: LaidOutNode[]): GraphBounds {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x - NODE_HALF_W)
    maxX = Math.max(maxX, node.x + NODE_HALF_W)
    minY = Math.min(minY, node.y - NODE_HALF_H)
    maxY = Math.max(maxY, node.y + NODE_HALF_H)
  }
  return {
    minX: minX - 72,
    minY: minY - 56 - HEADER,
    maxX: maxX + 72,
    maxY: maxY + 56,
  }
}
