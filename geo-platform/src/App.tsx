import { useState } from 'react'
import { MapView } from './features/map/MapView'
import type { AreaOfInterest } from './features/aois/types'

function App() {
  const [aois] = useState<AreaOfInterest[]>([{
    id: crypto.randomUUID(),
    name: 'Area of Interest 1',
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [50, 0], [50, 50], [0, 50], [0, 0]]]
    },
    createdAt: new Date().toISOString(),
  }])

  return (
    <div className="app">
      <header>ATLAS {aois[0].name}</header>
      <main>
        <MapView aois={aois}/>
      </main>
    </div>
  )
}

export default App
