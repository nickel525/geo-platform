import type { AreaOfInterest, AtlasEvent, Entity, Evidence, Relationship } from './types.ts'

const point = (lng: number, lat: number) =>
  ({ type: 'Point' as const, coordinates: [lng, lat] as [number, number] })

export const catalogEntities: Entity[] = [
  {
    id: 'ent-tsmc',
    name: 'TSMC',
    kind: 'company',
    description:
      'Taiwan Semiconductor Manufacturing Company. Foundry that produces advanced logic chips for NVIDIA and others.',
    geometry: point(121.014, 24.773),
    createdAt: '2024-01-12T00:00:00.000Z',
  },
  {
    id: 'ent-nvidia',
    name: 'NVIDIA',
    kind: 'company',
    description:
      'Designs GPUs and AI accelerators. Depends on TSMC for leading-edge wafer production.',
    geometry: point(-121.967, 37.371),
    createdAt: '2024-01-12T00:00:00.000Z',
  },
  {
    id: 'ent-msft',
    name: 'Microsoft',
    kind: 'company',
    description:
      'Cloud and AI provider. Azure GPU capacity depends on NVIDIA accelerators.',
    geometry: point(-122.137, 47.642),
    createdAt: '2024-01-12T00:00:00.000Z',
  },
  {
    id: 'ent-asml',
    name: 'ASML',
    kind: 'company',
    description:
      'Sole high-volume supplier of EUV lithography tools used in TSMC advanced nodes.',
    geometry: point(5.402, 51.407),
    createdAt: '2024-01-12T00:00:00.000Z',
  },
  {
    id: 'ent-fab18',
    name: 'TSMC Fab 18',
    kind: 'facility',
    description:
      'Advanced logic fab in Tainan Science Park. Produces 5nm/3nm wafers including AI accelerators.',
    geometry: point(120.272, 23.107),
    createdAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'ent-fab12',
    name: 'TSMC Fab 12',
    kind: 'facility',
    description: 'Hsinchu campus fab supporting mature and specialty process nodes.',
    geometry: point(121.02, 24.774),
    createdAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'ent-kaohsiung',
    name: 'Port of Kaohsiung',
    kind: 'port',
    description:
      'Primary export gateway for southern Taiwan electronics and fab equipment inbound.',
    geometry: point(120.279, 22.613),
    createdAt: '2024-03-01T00:00:00.000Z',
  },
  {
    id: 'ent-lapol',
    name: 'Port of Los Angeles',
    kind: 'port',
    description: 'West Coast inbound hub for finished electronics entering the US.',
    geometry: point(-118.265, 33.74),
    createdAt: '2024-03-01T00:00:00.000Z',
  },
  {
    id: 'ent-substation',
    name: 'Tainan 345kV Substation',
    kind: 'infrastructure',
    description:
      'High-voltage substation feeding Southern Taiwan Science Park industrial load.',
    geometry: point(120.255, 23.118),
    createdAt: '2024-03-15T00:00:00.000Z',
  },
  {
    id: 'ent-water',
    name: 'Tseng-Wen Industrial Water Line',
    kind: 'infrastructure',
    description:
      'Process water feed serving Fab 18 ultrapure water plants. Drought-sensitive.',
    geometry: point(120.236, 23.141),
    createdAt: '2024-03-15T00:00:00.000Z',
  },
]

export const catalogAois: AreaOfInterest[] = [
  {
    id: 'aoi-tainan-park',
    name: 'Tainan Science Park',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [120.22, 23.05],
        [120.34, 23.05],
        [120.34, 23.18],
        [120.22, 23.18],
        [120.22, 23.05],
      ]],
    },
    createdAt: '2024-04-01T00:00:00.000Z',
  },
  {
    id: 'aoi-kaohsiung-bay',
    name: 'Kaohsiung Harbor approaches',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [120.22, 22.52],
        [120.36, 22.52],
        [120.36, 22.68],
        [120.22, 22.68],
        [120.22, 22.52],
      ]],
    },
    createdAt: '2024-04-01T00:00:00.000Z',
  },
]

export const catalogEvidence: Evidence[] = [
  {
    id: 'evd-1',
    title: 'TSMC 2023 Annual Report — Fab 18 capacity',
    source: 'TSMC IR',
    url: 'https://investor.tsmc.com',
    publishedAt: '2024-03-12',
  },
  {
    id: 'evd-2',
    title: 'NVIDIA 10-K: foundry concentration risk',
    source: 'SEC EDGAR',
    publishedAt: '2024-02-21',
  },
  {
    id: 'evd-3',
    title: 'Taipower grid map — 345kV southern trunk',
    source: 'Taipower',
    publishedAt: '2023-11-04',
  },
  {
    id: 'evd-4',
    title: 'Kaohsiung Harbor Bureau cargo statistics',
    source: 'Taiwan International Ports',
    publishedAt: '2024-06-01',
  },
  {
    id: 'evd-5',
    title: 'ASML: TSMC as leading EUV customer',
    source: 'ASML Capital Markets Day',
    publishedAt: '2023-11-14',
  },
  {
    id: 'evd-6',
    title: 'Microsoft Azure AI capacity disclosures',
    source: 'Microsoft IR',
    publishedAt: '2024-07-18',
  },
]

export const catalogRelationships: Relationship[] = [
  {
    id: 'rel-tsmc-operates-fab18',
    fromId: 'ent-tsmc',
    toId: 'ent-fab18',
    type: 'operates',
    confidence: 0.98,
    evidenceIds: ['evd-1'],
    note: 'Fab 18 is a wholly operated TSMC 5/3nm site.',
  },
  {
    id: 'rel-tsmc-owns-fab18',
    fromId: 'ent-tsmc',
    toId: 'ent-fab18',
    type: 'owns',
    confidence: 0.97,
    evidenceIds: ['evd-1'],
  },
  {
    id: 'rel-tsmc-operates-fab12',
    fromId: 'ent-tsmc',
    toId: 'ent-fab12',
    type: 'operates',
    confidence: 0.95,
    evidenceIds: ['evd-1'],
  },
  {
    id: 'rel-fab18-depends-sub',
    fromId: 'ent-fab18',
    toId: 'ent-substation',
    type: 'depends_on',
    confidence: 0.86,
    evidenceIds: ['evd-3'],
    note: 'Park industrial feed; multi-hour outage stops EUV tools.',
  },
  {
    id: 'rel-fab18-depends-water',
    fromId: 'ent-fab18',
    toId: 'ent-water',
    type: 'depends_on',
    confidence: 0.81,
    evidenceIds: ['evd-1'],
  },
  {
    id: 'rel-fab18-depends-port',
    fromId: 'ent-fab18',
    toId: 'ent-kaohsiung',
    type: 'depends_on',
    confidence: 0.74,
    evidenceIds: ['evd-4'],
    note: 'Tool inbound and wafer outbound concentrate here.',
  },
  {
    id: 'rel-asml-supplies-tsmc',
    fromId: 'ent-asml',
    toId: 'ent-tsmc',
    type: 'supplies',
    confidence: 0.93,
    evidenceIds: ['evd-5'],
  },
  {
    id: 'rel-tsmc-supplies-nvidia',
    fromId: 'ent-tsmc',
    toId: 'ent-nvidia',
    type: 'supplies',
    confidence: 0.94,
    evidenceIds: ['evd-2'],
  },
  {
    id: 'rel-nvidia-depends-fab18',
    fromId: 'ent-nvidia',
    toId: 'ent-fab18',
    type: 'depends_on',
    confidence: 0.88,
    evidenceIds: ['evd-2'],
    note: 'Leading-edge GPU wafers are concentrated at Fab 18-class capacity.',
  },
  {
    id: 'rel-nvidia-supplies-msft',
    fromId: 'ent-nvidia',
    toId: 'ent-msft',
    type: 'supplies',
    confidence: 0.84,
    evidenceIds: ['evd-6'],
  },
  {
    id: 'rel-msft-depends-nvidia',
    fromId: 'ent-msft',
    toId: 'ent-nvidia',
    type: 'depends_on',
    confidence: 0.82,
    evidenceIds: ['evd-6'],
  },
  {
    id: 'rel-fab18-located-kaohsiung',
    fromId: 'ent-fab18',
    toId: 'ent-kaohsiung',
    type: 'located_at',
    confidence: 0.6,
    evidenceIds: ['evd-4'],
    note: 'Logistics footprint, not the fab site itself.',
  },
]

export const catalogEvents: AtlasEvent[] = [
  {
    id: 'evt-typhoon',
    title: 'Typhoon Krathon — southern grid stress',
    description:
      'High winds and flooding around Greater Tainan. Taipower reported switching on the 345kV southern trunk.',
    severity: 'high',
    entityIds: ['ent-substation', 'ent-fab18', 'ent-water'],
    geometry: point(120.26, 23.13),
    occurredAt: '2024-10-03T08:20:00.000Z',
  },
  {
    id: 'evt-port',
    title: 'Kaohsiung container backlog',
    description:
      'Berth congestion after equipment outage. Average dwell +2.4 days for electronics export.',
    severity: 'medium',
    entityIds: ['ent-kaohsiung', 'ent-fab18'],
    geometry: point(120.285, 22.61),
    occurredAt: '2025-01-18T14:00:00.000Z',
  },
  {
    id: 'evt-export',
    title: 'EUV tool licensing delay',
    description:
      'Additional end-use checks on a planned ASML shipment into Taiwan. Capacity expansion risk, not current output.',
    severity: 'medium',
    entityIds: ['ent-asml', 'ent-tsmc'],
    geometry: point(5.4, 51.41),
    occurredAt: '2025-06-09T00:00:00.000Z',
  },
]
