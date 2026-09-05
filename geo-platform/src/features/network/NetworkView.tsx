import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { uniqueSupplyFlows } from '../../lib/graph'
import { useWorkspace } from '../../state/useWorkspace'
import type { Entity, Selection } from '../../types/domain'
import {
  NODE_HALF_H,
  NODE_HALF_W,
  layoutDependencyGraph,
  type GraphBounds,
  type GraphLayout,
} from './layout'

type Camera = { x: number; y: number; k: number }
type Viewport = { w: number; h: number }

const MAX_ZOOM = 2.8
const FIT_PADDING = 56

export function NetworkView() {
  const {
    graphFocusId,
    graphEntities,
    graphRelationships,
    selection,
    disruptedIds,
    affectedIds,
    select,
  } = useWorkspace()

  const focusId = graphFocusId

  const layout = useMemo(
    () => layoutDependencyGraph(graphEntities, graphRelationships, focusId),
    [graphEntities, graphRelationships, focusId],
  )
  const position = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  )
  const visibleFlows = useMemo(
    () =>
      uniqueSupplyFlows(graphRelationships).filter(
        (flow) => position.has(flow.upstream) && position.has(flow.downstream),
      ),
    [graphRelationships, position],
  )

  if (!focusId || graphEntities.length === 0) {
    return (
      <div className="network-view">
        <p className="network-hint">
          Select a company to see its suppliers and customers. Click another
          company to open that company's graph.
        </p>
      </div>
    )
  }

  const focusName = graphEntities.find((entity) => entity.id === focusId)?.name ?? 'this node'

  return (
    <div className="network-view">
      <GraphBoard
        key={focusId}
        layout={layout}
        position={position}
        visibleFlows={visibleFlows}
        graphEntities={graphEntities}
        focusId={focusId}
        focusName={focusName}
        selection={selection}
        disruptedIds={disruptedIds}
        affectedIds={affectedIds}
        onSelect={select}
      />
    </div>
  )
}

function GraphBoard({
  layout,
  position,
  visibleFlows,
  graphEntities,
  focusId,
  focusName,
  selection,
  disruptedIds,
  affectedIds,
  onSelect,
}: {
  layout: GraphLayout
  position: Map<string, { x: number; y: number }>
  visibleFlows: ReturnType<typeof uniqueSupplyFlows>
  graphEntities: Entity[]
  focusId: string
  focusName: string
  selection: Selection
  disruptedIds: string[]
  affectedIds: string[]
  onSelect: (selection: Selection) => void
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, k: 1 })
  const userMovedRef = useRef(false)
  const pointerRef = useRef<{
    x: number
    y: number
    px: number
    py: number
    moved: boolean
  } | null>(null)

  const [viewport, setViewport] = useState<Viewport>({ w: 0, h: 0 })
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, k: 1 })
  const layoutRef = useRef(layout)
  const viewportRef = useRef(viewport)

  useEffect(() => {
    layoutRef.current = layout
    viewportRef.current = viewport
  }, [layout, viewport])

  const applyCamera = useCallback((next: Camera, fromUser = false) => {
    const limited = clampCamera(next, layoutRef.current.bounds, viewportRef.current)
    cameraRef.current = limited
    if (fromUser) userMovedRef.current = true
    setCamera(limited)
  }, [])

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const frame = () => {
      const rect = el.getBoundingClientRect()
      setViewport({ w: rect.width, h: rect.height })
    }
    frame()
    const observer = new ResizeObserver(frame)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (viewport.w < 8 || viewport.h < 8) return
    if (userMovedRef.current) {
      applyCamera(cameraRef.current)
      return
    }
    applyCamera(fitCamera(layout, viewport))
    // layout/viewport fit should not mark the user as having panned
    userMovedRef.current = false
  }, [applyCamera, layout, viewport])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      const factor = Math.exp(-event.deltaY * 0.0015)
      const prev = cameraRef.current
      const minK = minZoom(layout.bounds, viewport)
      const nextK = clamp(prev.k * factor, minK, MAX_ZOOM)
      const worldX = (mx - prev.x) / prev.k
      const worldY = (my - prev.y) / prev.k
      applyCamera(
        {
          k: nextK,
          x: mx - worldX * nextK,
          y: my - worldY * nextK,
        },
        true,
      )
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyCamera, layout, viewport])

  return (
    <div className="network-stage">
      <div className="network-overlay">
        <div className="network-meta">
          <strong>{focusName}</strong>
          <span>
            Suppliers on the left · customers on the right · {visibleFlows.length}{' '}
            links · click a company to open its graph
          </span>
        </div>
        <div className="network-tools">
          <button type="button" onClick={() => applyCamera(zoomAt(cameraRef.current, viewport, 1 / 1.2, layout.bounds), true)}>
            −
          </button>
          <button type="button" onClick={() => applyCamera(zoomAt(cameraRef.current, viewport, 1.2, layout.bounds), true)}>
            +
          </button>
          <button
            type="button"
            className="network-reset"
            onClick={() => {
              userMovedRef.current = false
              applyCamera(fitCamera(layout, viewport))
              userMovedRef.current = false
            }}
          >
            Fit
          </button>
        </div>
      </div>
      <div
        ref={canvasRef}
        className="network-canvas"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const prev = cameraRef.current
          pointerRef.current = {
            x: prev.x,
            y: prev.y,
            px: event.clientX,
            py: event.clientY,
            moved: false,
          }
        }}
        onPointerMove={(event) => {
          const pointer = pointerRef.current
          if (!pointer) return
          const dx = event.clientX - pointer.px
          const dy = event.clientY - pointer.py
          if (!pointer.moved && Math.hypot(dx, dy) < 4) return
          if (!pointer.moved) {
            pointer.moved = true
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          applyCamera(
            { k: cameraRef.current.k, x: pointer.x + dx, y: pointer.y + dy },
            true,
          )
        }}
        onPointerUp={(event) => {
          const pointer = pointerRef.current
          pointerRef.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          if (!pointer || pointer.moved) return
          const hit = hitAtPoint(event.clientX, event.clientY)
          if (hit.entityId) onSelect({ kind: 'entity', id: hit.entityId })
          else if (hit.relId) onSelect({ kind: 'relationship', id: hit.relId })
        }}
      >
        <svg className="network-svg" role="img" aria-label="Dependency graph">
          <defs>
            <marker
              id="edge-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="context-stroke" />
            </marker>
          </defs>
          <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
            {layout.columns.map((column) => (
              <g key={column.rank} className="graph-column" pointerEvents="none">
                <rect
                  className={`column-band role-${column.rank < 0 ? 'upstream' : column.rank > 0 ? 'downstream' : 'focus'}`}
                  x={column.x - NODE_HALF_W - 28}
                  y={layout.bounds.minY + 8}
                  width={NODE_HALF_W * 2 + 56}
                  height={layout.bounds.maxY - layout.bounds.minY - 16}
                  rx={14}
                />
                <text className="column-label" x={column.x} y={layout.bounds.minY + 28}>
                  {column.rank === 0 ? truncate(focusName, 22) : column.label}
                </text>
              </g>
            ))}

            {visibleFlows.map((flow) => {
              const from = position.get(flow.upstream)
              const to = position.get(flow.downstream)
              if (!from || !to) return null
              const curve = supplyCurve(from, to)
              const selected =
                selection?.kind === 'relationship' && selection.id === flow.rel.id
              const onImpactPath =
                (disruptedIds.includes(flow.upstream) ||
                  affectedIds.includes(flow.upstream)) &&
                (disruptedIds.includes(flow.downstream) ||
                  affectedIds.includes(flow.downstream))
              return (
                <g key={flow.rel.id}>
                  <path d={curve.d} className="edge-hit" data-rel-id={flow.rel.id} />
                  <path
                    d={curve.d}
                    className={
                      selected ? 'edge is-selected' : onImpactPath ? 'edge is-impact' : 'edge'
                    }
                    markerEnd="url(#edge-arrow)"
                    data-rel-id={flow.rel.id}
                    fill="none"
                  />
                </g>
              )
            })}

            {layout.nodes.map((node) => {
              const entity = graphEntities.find((item) => item.id === node.id)
              if (!entity) return null
              const isFocus = entity.id === focusId
              const isSelected = selection?.kind === 'entity' && selection.id === entity.id
              const disrupted = disruptedIds.includes(entity.id)
              const affected = affectedIds.includes(entity.id)
              return (
                <g
                  key={entity.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="graph-node"
                  data-entity-id={entity.id}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect({ kind: 'entity', id: entity.id })
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onSelect({ kind: 'entity', id: entity.id })
                  }}
                >
                  <rect
                    x={-NODE_HALF_W}
                    y={-NODE_HALF_H}
                    width={NODE_HALF_W * 2}
                    height={NODE_HALF_H * 2}
                    rx={6}
                    data-entity-id={entity.id}
                    className={[
                      'node-card',
                      `kind-${entity.kind}`,
                      `role-${node.role}`,
                      isSelected || isFocus ? 'is-selected' : '',
                      disrupted ? 'is-disrupted' : '',
                      !disrupted && affected ? 'is-affected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <text className="node-name" y={-2}>
                    {truncate(entity.name, isFocus ? 22 : 24)}
                  </text>
                  <text className="node-kind" y={14}>
                    {nodeCaption(entity, node.role, disrupted, affected)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}

function hitAtPoint(x: number, y: number): { entityId?: string; relId?: string } {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof Element)) continue
    const host = el.closest('[data-entity-id], [data-rel-id]')
    if (!(host instanceof Element)) continue
    const entityId = host.getAttribute('data-entity-id')
    const relId = host.getAttribute('data-rel-id')
    if (entityId) return { entityId }
    if (relId) return { relId }
  }
  return {}
}

function nodeCaption(
  entity: Entity,
  role: 'upstream' | 'focus' | 'downstream',
  disrupted: boolean,
  affected: boolean,
): string {
  if (disrupted) return 'disrupted'
  if (affected) return 'at risk'
  if (role === 'focus') return 'selected'
  if (role === 'upstream') return 'supplier'
  if (role === 'downstream') return 'customer'
  return entity.kind.replaceAll('_', ' ')
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function worldSize(bounds: GraphBounds): { w: number; h: number } {
  return {
    w: Math.max(1, bounds.maxX - bounds.minX),
    h: Math.max(1, bounds.maxY - bounds.minY),
  }
}

function minZoom(bounds: GraphBounds, viewport: Viewport): number {
  if (viewport.w < 8 || viewport.h < 8) return 0.05
  const size = worldSize(bounds)
  const fit = Math.min(viewport.w / size.w, viewport.h / size.h)
  return clamp(fit * 0.35, 0.04, 0.4)
}

function zoomAt(
  camera: Camera,
  viewport: Viewport,
  factor: number,
  bounds: GraphBounds,
): Camera {
  const mx = viewport.w / 2
  const my = viewport.h / 2
  const nextK = clamp(camera.k * factor, minZoom(bounds, viewport), MAX_ZOOM)
  const worldX = (mx - camera.x) / camera.k
  const worldY = (my - camera.y) / camera.k
  return {
    k: nextK,
    x: mx - worldX * nextK,
    y: my - worldY * nextK,
  }
}

function fitCamera(layout: GraphLayout, viewport: Viewport): Camera {
  if (viewport.w < 8 || viewport.h < 8) return { x: 0, y: 0, k: 1 }
  const size = worldSize(layout.bounds)
  const fitW = (viewport.w - FIT_PADDING * 2) / size.w
  const fitH = (viewport.h - FIT_PADDING * 2) / size.h
  const readable = 0.78
  const k = clamp(Math.min(fitW, Math.max(fitH, readable), 1.1), minZoom(layout.bounds, viewport), 1.1)
  return {
    k,
    x: viewport.w / 2 - layout.focus.x * k,
    y: viewport.h / 2 - layout.focus.y * k,
  }
}

function clampCamera(camera: Camera, bounds: GraphBounds, viewport: Viewport): Camera {
  if (viewport.w < 8 || viewport.h < 8) return camera
  const k = clamp(camera.k, minZoom(bounds, viewport), MAX_ZOOM)
  const keep = 72
  const xMin = keep - bounds.maxX * k
  const xMax = viewport.w - keep - bounds.minX * k
  const yMin = keep - bounds.maxY * k
  const yMax = viewport.h - keep - bounds.minY * k
  return {
    k,
    x: xMin > xMax ? (xMin + xMax) / 2 : clamp(camera.x, xMin, xMax),
    y: yMin > yMax ? (yMin + yMax) / 2 : clamp(camera.y, yMin, yMax),
  }
}

function supplyCurve(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { d: string } {
  const x1 = from.x + NODE_HALF_W
  const y1 = from.y
  const x2 = to.x - NODE_HALF_W
  const y2 = to.y
  const span = Math.max(64, (x2 - x1) * 0.5)
  const c1x = x1 + span
  const c2x = x2 - span
  return {
    d: `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`,
  }
}
