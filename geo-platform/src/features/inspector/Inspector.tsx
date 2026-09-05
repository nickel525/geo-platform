import { formatArea } from '../../lib/geo'
import {
  downstreamIds,
  operatedSiteIds,
  operatorIds,
  relationshipLabel,
  relationshipsFor,
  upstreamIds,
} from '../../lib/graph'
import { useWorkspace } from '../../state/useWorkspace'
import type { Entity, Evidence, Relationship } from '../../types/domain'

export function Inspector() {
  const workspace = useWorkspace()
  const {
    selection,
    selectedEntity,
    selectedAoi,
    selectedRelationship,
    selectedEvent,
    entities,
    relationships,
    evidence,
    events,
    entitiesInSelectedAoi,
    disruptedIds,
    affectedIds,
    select,
    setView,
    renameAoi,
    deleteAoi,
    toggleDisruption,
  } = workspace

  if (!selection) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p className="muted">
          Select an AOI, entity, relationship, or event. The map is the viewport;
          this panel is the record.
        </p>
      </aside>
    )
  }

  if (selectedAoi) {
    const inside = entitiesInSelectedAoi
    return (
      <aside className="inspector">
        <h2>AOI</h2>
        <h3>{selectedAoi.name}</h3>
        <dl className="meta">
          <div>
            <dt>Area</dt>
            <dd>{formatArea(selectedAoi.geometry)}</dd>
          </div>
          <div>
            <dt>Entities inside</dt>
            <dd>{inside.length}</dd>
          </div>
        </dl>
        <h4>Inside this box</h4>
        <ul className="link-list">
          {inside.length === 0 && <li className="muted">No mapped entities.</li>}
          {inside.map((entity) => (
            <li key={entity.id}>
              <button type="button" onClick={() => select({ kind: 'entity', id: entity.id })}>
                {entity.name}
                <em>{entity.kind}</em>
              </button>
            </li>
          ))}
        </ul>
        <div className="stack">
          <input
            type="text"
            value={selectedAoi.name}
            onChange={(event) => renameAoi(event.target.value)}
            aria-label="AOI name"
          />
          <button type="button" className="is-danger" onClick={deleteAoi}>
            Delete AOI
          </button>
        </div>
      </aside>
    )
  }

  if (selectedEntity) {
    const rels = relationshipsFor(selectedEntity.id, relationships)
    const up = upstreamIds(selectedEntity.id, relationships)
    const down = downstreamIds(selectedEntity.id, relationships)
    const sites = operatedSiteIds(selectedEntity.id, relationships)
    const operators = operatorIds(selectedEntity.id, relationships)
    const relatedEvents = events.filter((event) =>
      event.entityIds.includes(selectedEntity.id),
    )
    const disrupted = disruptedIds.includes(selectedEntity.id)
    const affected = affectedIds.includes(selectedEntity.id)

    return (
      <aside className="inspector">
        <div className="inspector-kicker">
          <span className={`kind-dot kind-${selectedEntity.kind}`} />
          {selectedEntity.kind}
          {disrupted && <span className="pill pill-hot">disrupted</span>}
          {!disrupted && affected && <span className="pill pill-warn">affected</span>}
        </div>
        <h3>{selectedEntity.name}</h3>
        <p>{selectedEntity.description}</p>
        <dl className="meta">
          {typeof selectedEntity.metadata.originalName === 'string' &&
            selectedEntity.metadata.originalName !== selectedEntity.name && (
              <div>
                <dt>Source name</dt>
                <dd>{selectedEntity.metadata.originalName}</dd>
              </div>
            )}
          {selectedEntity.geometry?.type === 'Point' && (
            <div>
              <dt>Coordinates</dt>
              <dd>
                {selectedEntity.geometry.coordinates[1].toFixed(5)},{' '}
                {selectedEntity.geometry.coordinates[0].toFixed(5)}
              </dd>
            </div>
          )}
          {selectedEntity.metadata.reviewFlag ? (
            <div>
              <dt>Match status</dt>
              <dd>Needs review — not merged with a similar name</dd>
            </div>
          ) : null}
          <MetaLine label="Address" value={selectedEntity.metadata.address} />
          <MetaLine label="Country" value={selectedEntity.metadata.countryName} />
          <MetaLine label="Parent company" value={selectedEntity.metadata.parentCompany} />
          <MetaLine label="Sector" value={selectedEntity.metadata.sector} />
          <MetaLine label="Product" value={selectedEntity.metadata.productType} />
          <MetaLine label="Workers" value={selectedEntity.metadata.workers} />
          <MetaLine label="OS ID" value={selectedEntity.metadata.osId} />
          {typeof selectedEntity.metadata.sourceUrl === 'string' && (
            <div>
              <dt>Source</dt>
              <dd>
                <a href={selectedEntity.metadata.sourceUrl} target="_blank" rel="noreferrer">
                  Open Supply Hub profile
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="stack">
          <button type="button" onClick={toggleDisruption}>
            {disrupted ? 'Clear disruption' : 'Simulate disruption'}
          </button>
          <button type="button" onClick={() => setView('network')}>
            Open dependency graph
          </button>
        </div>

        {sites.length > 0 && (
          <>
            <h4>Sites</h4>
            <EntityIdList
              ids={sites}
              entities={entities}
              onPick={(id) => select({ kind: 'entity', id })}
            />
          </>
        )}
        {operators.length > 0 && (
          <>
            <h4>Operator</h4>
            <EntityIdList
              ids={operators}
              entities={entities}
              onPick={(id) => select({ kind: 'entity', id })}
            />
          </>
        )}

        <h4>Upstream</h4>
        <EntityIdList ids={up} entities={entities} onPick={(id) => select({ kind: 'entity', id })} />
        <h4>Downstream / at risk</h4>
        <EntityIdList
          ids={down}
          entities={entities}
          onPick={(id) => select({ kind: 'entity', id })}
        />

        <h4>Relationships</h4>
        <ul className="link-list">
          {rels.map((rel) => (
            <RelationshipRow
              key={rel.id}
              rel={rel}
              selfId={selectedEntity.id}
              entities={entities}
              evidence={evidence}
              onSelectRel={() => select({ kind: 'relationship', id: rel.id })}
              onSelectEntity={(id) => select({ kind: 'entity', id })}
            />
          ))}
        </ul>

        <h4>Events</h4>
        <ul className="link-list">
          {relatedEvents.length === 0 && <li className="muted">None linked.</li>}
          {relatedEvents.map((event) => (
            <li key={event.id}>
              <button type="button" onClick={() => select({ kind: 'event', id: event.id })}>
                {event.title}
                <em>{event.severity}</em>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  if (selectedRelationship) {
    const from = entities.find((entity) => entity.id === selectedRelationship.fromId)
    const to = entities.find((entity) => entity.id === selectedRelationship.toId)
    const proofs = evidence.filter((item) =>
      selectedRelationship.evidenceIds.includes(item.id),
    )
    return (
      <aside className="inspector">
        <h2>Relationship</h2>
        <h3>
          {from?.name} {relationshipLabel(selectedRelationship.type)} {to?.name}
        </h3>
        <dl className="meta">
          <div>
            <dt>Type</dt>
            <dd>{selectedRelationship.type}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{Math.round(selectedRelationship.confidence * 100)}% that this link is real</dd>
          </div>
        </dl>
        {selectedRelationship.note && <p>{selectedRelationship.note}</p>}
        <div className="stack">
          {from && (
            <button type="button" onClick={() => select({ kind: 'entity', id: from.id })}>
              Open {from.name}
            </button>
          )}
          {to && (
            <button type="button" onClick={() => select({ kind: 'entity', id: to.id })}>
              Open {to.name}
            </button>
          )}
        </div>
        <h4>Evidence</h4>
        <ul className="evidence">
          {proofs.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <span>
                {item.source}
                {item.sourceRecordId ? ` · ${item.sourceRecordId}` : ''}
                {item.publishedAt ? ` · ${item.publishedAt}` : ''}
              </span>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  Source
                </a>
              )}
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  if (selectedEvent) {
    return (
      <aside className="inspector">
        <div className="inspector-kicker">
          <span className={`severity sev-${selectedEvent.severity}`} />
          {selectedEvent.severity} event
        </div>
        <h3>{selectedEvent.title}</h3>
        <p>{selectedEvent.description}</p>
        <dl className="meta">
          <div>
            <dt>Occurred</dt>
            <dd>{new Date(selectedEvent.occurredAt).toLocaleString()}</dd>
          </div>
        </dl>
        <h4>Linked entities</h4>
        <EntityIdList
          ids={selectedEvent.entityIds}
          entities={entities}
          onPick={(id) => select({ kind: 'entity', id })}
        />
      </aside>
    )
  }

  return (
    <aside className="inspector">
      <p className="muted">Record not found.</p>
    </aside>
  )
}

function MetaLine({ label, value }: { label: string; value: unknown }) {
  if (typeof value !== 'string' || !value.trim()) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function EntityIdList({
  ids,
  entities,
  onPick,
}: {
  ids: string[]
  entities: Entity[]
  onPick: (id: string) => void
}) {
  if (ids.length === 0) return <p className="muted">None.</p>
  return (
    <ul className="link-list">
      {ids.map((id) => {
        const entity = entities.find((item) => item.id === id)
        if (!entity) return null
        return (
          <li key={id}>
            <button type="button" onClick={() => onPick(id)}>
              {entity.name}
              <em>{entity.kind}</em>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function RelationshipRow({
  rel,
  selfId,
  entities,
  evidence,
  onSelectRel,
  onSelectEntity,
}: {
  rel: Relationship
  selfId: string
  entities: { id: string; name: string }[]
  evidence: Evidence[]
  onSelectRel: () => void
  onSelectEntity: (id: string) => void
}) {
  const otherId = rel.fromId === selfId ? rel.toId : rel.fromId
  const other = entities.find((entity) => entity.id === otherId)
  const direction = rel.fromId === selfId ? 'out' : 'in'
  const proofs = evidence.filter((item) => rel.evidenceIds.includes(item.id))
  return (
    <li>
      <div className="rel-row">
        <button type="button" onClick={onSelectRel}>
          <strong>
            {direction === 'out' ? relationshipLabel(rel.type) : `← ${relationshipLabel(rel.type)}`}
          </strong>
          <em>
            {Math.round(rel.confidence * 100)}% confidence · {proofs.length} source
            {proofs.length === 1 ? '' : 's'}
          </em>
        </button>
        {other && (
          <button type="button" onClick={() => onSelectEntity(other.id)}>
            {other.name}
          </button>
        )}
      </div>
    </li>
  )
}
