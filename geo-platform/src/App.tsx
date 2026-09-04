import { useState } from 'react'
import { MapView } from './features/map/MapView'
import type { AreaOfInterest } from './features/aois/types'
import type { Position } from 'geojson'

function App() {
  const [aois, setAois] = useState<AreaOfInterest[]>([])
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPositions, setDraftPositions] = useState<Position[]>([]);
  const [selectedAoiId, setSelectedAoiId] = useState<string | null>(null);

  const handleAoiSelect = (id: string | null) => {
    setSelectedAoiId(id);
  }
  const handleVertexAdd = (position: Position): void => {
    setDraftPositions((prev) => [...prev, position]);
  }

  const handleDrawButtonClick = () => {
    setIsDrawing((prev) => !prev);
    if (isDrawing) {
      setDraftPositions([]);
    }
  }
  const handleSaveButtonClick = () => {
    if (draftPositions.length < 3) return;
    const newAoi: AreaOfInterest = {
      id: crypto.randomUUID(),
      name: `AOI ${aois.length + 1}`,
      geometry: {
        type: 'Polygon',
        coordinates: [[...draftPositions, draftPositions[0]]],
      },
      createdAt: new Date().toISOString(),
    }
    setAois((prev) => [...prev, newAoi]);
    setDraftPositions([]);
    setIsDrawing(false);
  }

  return (
    <div className="app">
      <header>ATLAS
        <p>{selectedAoiId ? aois.find((aoi) => aoi.id === selectedAoiId)?.name : 'No AOI Selected'}</p>
      </header>
      <button type="button" onClick={handleDrawButtonClick}>{isDrawing ? 'Cancel Drawing' : 'Draw AOI'}</button>
      {isDrawing && (
        <button type="button" disabled={draftPositions.length < 3} onClick={handleSaveButtonClick}>Finish AOI</button>
      )}
      <main>
        <MapView aois={aois} isDrawing={isDrawing} onAoiSelect={handleAoiSelect} onVertexAdd={handleVertexAdd} draftPositions={draftPositions}/>
      </main>
    </div>
  );
}

export default App;
