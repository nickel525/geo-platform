import { useWorkspace } from '../../state/useWorkspace'
import type { EntityKind } from '../../types/domain'

const KINDS: Array<EntityKind | 'all'> = [
  'all',
  'company',
  'facility',
  'port',
  'airport',
  'power_infrastructure',
  'transport_infrastructure',
]

function kindLabel(kind: EntityKind | 'all'): string {
  return kind.replaceAll('_', ' ')
}

export function Sidebar() {
  const {
    view,
    setView,
    query,
    setQuery,
    kindFilter,
    setKindFilter,
    visibleEntities,
    aois,
    selection,
    select,
    events,
    disruptedIds,
    affectedIds,
  } = useWorkspace()

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">ATLAS</span>
        <span className="brand-sub">Supply-chain intelligence</span>
      </div>

      <nav className="side-nav">
        <button
          type="button"
          className={view === 'map' ? 'is-active' : undefined}
          onClick={() => setView('map')}
        >
          Map
        </button>
        <button
          type="button"
          className={view === 'network' ? 'is-active' : undefined}
          onClick={() => setView('network')}
        >
          Network
        </button>
      </nav>

      <label className="search">
        <span>Search</span>
        <input
          type="search"
          value={query}
          placeholder="Name, type, description"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="filters">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={kindFilter === kind ? 'is-active' : undefined}
            onClick={() => setKindFilter(kind)}
          >
            {kindLabel(kind)}
          </button>
        ))}
      </div>

      <section className="side-section">
        <h2>Entities</h2>
        <ul className="side-list">
          {visibleEntities.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                className={
                  selection?.kind === 'entity' && selection.id === entity.id
                    ? 'is-selected'
                    : undefined
                }
                onClick={() => select({ kind: 'entity', id: entity.id })}
              >
                <span className={`kind-dot kind-${entity.kind}`} />
                <span className="side-list-copy">
                  <strong>{entity.name}</strong>
                  <em>{entity.kind}</em>
                </span>
                {disruptedIds.includes(entity.id) && (
                  <span className="pill pill-hot">down</span>
                )}
                {!disruptedIds.includes(entity.id) &&
                  affectedIds.includes(entity.id) && (
                    <span className="pill pill-warn">impact</span>
                  )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="side-section">
        <h2>AOIs</h2>
        <ul className="side-list">
          {aois.map((aoi) => (
            <li key={aoi.id}>
              <button
                type="button"
                className={
                  selection?.kind === 'aoi' && selection.id === aoi.id
                    ? 'is-selected'
                    : undefined
                }
                onClick={() => {
                  setView('map')
                  select({ kind: 'aoi', id: aoi.id })
                }}
              >
                <span className="kind-dot kind-aoi" />
                <span className="side-list-copy">
                  <strong>{aoi.name}</strong>
                  <em>area</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="side-section">
        <h2>Events</h2>
        <ul className="side-list">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className={
                  selection?.kind === 'event' && selection.id === event.id
                    ? 'is-selected'
                    : undefined
                }
                onClick={() => select({ kind: 'event', id: event.id })}
              >
                <span className={`severity sev-${event.severity}`} />
                <span className="side-list-copy">
                  <strong>{event.title}</strong>
                  <em>{event.severity}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
