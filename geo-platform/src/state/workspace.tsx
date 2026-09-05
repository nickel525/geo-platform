import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Position } from 'geojson'

import { loadCatalog } from '../data/loadCatalog'
import { createAoi, entitiesInsideAoi, pointCoordinates } from '../lib/geo'
import { directNeighborhood, traverseImpact } from '../lib/graph'
import type {
  AreaOfInterest,
  Entity,
  EntityKind,
  Selection,
  WorkspaceView,
} from '../types/domain'
import { WorkspaceContext, type WorkspaceValue } from './context'

const AOI_KEY = 'atlas.aois.v1'
const catalog = loadCatalog()

function readAois(): AreaOfInterest[] {
  try {
    const raw = localStorage.getItem(AOI_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AreaOfInterest[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function matchesQuery(entity: Entity, query: string): boolean {
  if (!query) return true
  const original =
    typeof entity.metadata.originalName === 'string' ? entity.metadata.originalName : ''
  return `${entity.name} ${entity.kind} ${original}`.toLowerCase().includes(query)
}

function inBbox(
  entity: Entity,
  bbox: [number, number, number, number] | null,
): boolean {
  if (!bbox) return true
  const point = pointCoordinates(entity.geometry)
  if (!point) return false
  const [lng, lat] = point
  const [west, south, east, north] = bbox
  return lng >= west && lng <= east && lat >= south && lat <= north
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [aois, setAois] = useState<AreaOfInterest[]>(readAois)
  const [selection, setSelection] = useState<Selection>(null)
  const [view, setView] = useState<WorkspaceView>('map')
  const [isDrawing, setIsDrawing] = useState(false)
  const [draftPositions, setDraftPositions] = useState<Position[]>([])
  const [disruptedIds, setDisruptedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<EntityKind | 'all'>('all')
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [graphFocusId, setGraphFocusId] = useState<string | null>(null)

  const draftRef = useRef(draftPositions)
  const entities = catalog.entities
  const relationships = catalog.relationships
  const evidence = catalog.evidence
  const events = useMemo(() => [], [])

  useEffect(() => {
    draftRef.current = draftPositions
  }, [draftPositions])

  useEffect(() => {
    localStorage.setItem(AOI_KEY, JSON.stringify(aois))
  }, [aois])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(null), 3400)
    return () => window.clearTimeout(timer)
  }, [status])

  const filteredEntities = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entities
      .filter((entity) => kindFilter === 'all' || entity.kind === kindFilter)
      .filter((entity) => matchesQuery(entity, q))
      .sort((a, b) => {
        const aGeo = a.geometry ? 0 : 1
        const bGeo = b.geometry ? 0 : 1
        if (aGeo !== bGeo) return aGeo - bGeo
        return a.name.localeCompare(b.name)
      })
  }, [entities, kindFilter, query])

  const mapEntities = useMemo(() => {
    const mapped = entities.filter((entity) => entity.geometry)
    const visible = mapped.filter(
      (entity) =>
        (kindFilter === 'all' || entity.kind === kindFilter) && inBbox(entity, bbox),
    )
    const pinned = new Set(disruptedIds)
    if (selection?.kind === 'entity') pinned.add(selection.id)
    return [
      ...visible,
      ...mapped.filter((entity) => pinned.has(entity.id) && !visible.some((item) => item.id === entity.id)),
    ]
  }, [entities, kindFilter, bbox, disruptedIds, selection])

  const affectedIds = useMemo(() => {
    if (disruptedIds.length === 0) return []
    const ids = new Set<string>()
    for (const id of disruptedIds) {
      for (const hop of traverseImpact(id, relationships)) {
        if (hop.depth > 0) ids.add(hop.entityId)
      }
    }
    return [...ids]
  }, [disruptedIds, relationships])

  const selectedEntity =
    selection?.kind === 'entity'
      ? (entities.find((entity) => entity.id === selection.id) ?? null)
      : null
  const selectedAoi =
    selection?.kind === 'aoi' ? (aois.find((aoi) => aoi.id === selection.id) ?? null) : null
  const selectedRelationship =
    selection?.kind === 'relationship'
      ? (relationships.find((rel) => rel.id === selection.id) ?? null)
      : null

  const entitiesInSelectedAoi = useMemo(() => {
    if (!selectedAoi) return []
    return entitiesInsideAoi(entities, selectedAoi)
  }, [entities, selectedAoi])

  const graphSlice = useMemo(() => {
    if (view !== 'network' || !graphFocusId) {
      return { entities: [] as Entity[], relationships }
    }
    const focus = entities.find((entity) => entity.id === graphFocusId)
    const slice = directNeighborhood(graphFocusId, relationships, focus?.kind)
    return {
      entities: entities.filter((entity) => slice.entityIds.includes(entity.id)),
      relationships: slice.relationships,
    }
  }, [view, graphFocusId, entities, relationships])

  const value: WorkspaceValue = {
    aois,
    entities,
    relationships,
    events,
    evidence,
    selection,
    view,
    isDrawing,
    draftPositions,
    disruptedIds,
    affectedIds,
    query,
    kindFilter,
    status,
    selectedEntity,
    selectedAoi,
    selectedRelationship,
    selectedEvent: null,
    visibleEntities: filteredEntities,
    entitiesInSelectedAoi,
    graphFocusId,
    graphEntities: graphSlice.entities,
    graphRelationships: graphSlice.relationships,
    mapEntities,
    loading: false,
    error: null,
    setViewportBbox: setBbox,
    setView,
    setQuery,
    setKindFilter,
    select: (next) => {
      setSelection(next)
      if (next?.kind === 'entity') setGraphFocusId(next.id)
    },
    startDrawing: () => {
      setIsDrawing(true)
      setSelection(null)
      setView('map')
    },
    cancelDrawing: () => {
      setIsDrawing(false)
      setDraftPositions([])
    },
    addVertex: (position) => {
      setDraftPositions((prev) => {
        const next = [...prev, position]
        draftRef.current = next
        return next
      })
    },
    undoVertex: () => {
      setDraftPositions((prev) => {
        const next = prev.slice(0, -1)
        draftRef.current = next
        return next
      })
    },
    finishAoi: () => {
      const draft = createAoi(draftRef.current, `AOI ${aois.length + 1}`)
      if (!draft) return
      setAois((prev) => [...prev, draft])
      setDraftPositions([])
      setIsDrawing(false)
      setSelection({ kind: 'aoi', id: draft.id })
      setStatus(`Saved ${draft.name}`)
    },
    renameAoi: (name) => {
      if (selection?.kind !== 'aoi') return
      const id = selection.id
      setAois((prev) => prev.map((aoi) => (aoi.id === id ? { ...aoi, name } : aoi)))
    },
    deleteAoi: () => {
      if (selection?.kind !== 'aoi') return
      const id = selection.id
      setAois((prev) => prev.filter((aoi) => aoi.id !== id))
      setSelection(null)
      setStatus('AOI deleted')
    },
    toggleDisruption: () => {
      if (selection?.kind !== 'entity') return
      const id = selection.id
      const clearing = disruptedIds.includes(id)
      setDisruptedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      )
      setStatus(
        clearing
          ? 'Disruption cleared'
          : `Marked ${selectedEntity?.name ?? 'entity'} disrupted`,
      )
    },
    clearDisruption: () => {
      setDisruptedIds([])
      setStatus('All disruptions cleared')
    },
  }

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}
