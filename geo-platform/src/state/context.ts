import { createContext } from 'react'
import type { Position } from 'geojson'
import type {
  AreaOfInterest,
  AtlasEvent,
  Entity,
  EntityKind,
  Evidence,
  Relationship,
  Selection,
  WorkspaceView,
} from '../types/domain'

export type WorkspaceValue = {
  aois: AreaOfInterest[]
  entities: Entity[]
  relationships: Relationship[]
  events: AtlasEvent[]
  evidence: Evidence[]
  selection: Selection
  view: WorkspaceView
  isDrawing: boolean
  draftPositions: Position[]
  disruptedIds: string[]
  affectedIds: string[]
  query: string
  kindFilter: EntityKind | 'all'
  status: string | null
  selectedEntity: Entity | null
  selectedAoi: AreaOfInterest | null
  selectedRelationship: Relationship | null
  selectedEvent: AtlasEvent | null
  visibleEntities: Entity[]
  entitiesInSelectedAoi: Entity[]
  graphFocusId: string | null
  graphEntities: Entity[]
  graphRelationships: Relationship[]
  mapEntities: Entity[]
  loading: boolean
  error: string | null
  setViewportBbox: (bbox: [number, number, number, number]) => void
  setView: (view: WorkspaceView) => void
  setQuery: (query: string) => void
  setKindFilter: (kind: EntityKind | 'all') => void
  select: (selection: Selection) => void
  startDrawing: () => void
  cancelDrawing: () => void
  addVertex: (position: Position) => void
  undoVertex: () => void
  finishAoi: () => void
  renameAoi: (name: string) => void
  deleteAoi: () => void
  toggleDisruption: () => void
  clearDisruption: () => void
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)
