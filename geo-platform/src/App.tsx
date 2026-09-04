import { useState } from 'react'
import { MapView } from './features/map/MapView'
import { AoiInspector } from './features/aois/AoiInspector'
import type { AreaOfInterest } from './features/aois/types'
import type { Position } from 'geojson'

function App() {
  const [aois, setAois] = useState<AreaOfInterest[]>([])
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPositions, setDraftPositions] = useState<Position[]>([]);
  const [selectedAoiId, setSelectedAoiId] = useState<string | null>(null);
  const [isInspectorVisible, setIsInspectorVisible] = useState(true);

  const handleNameChange = (name: string) => {
    setAois((prev) => prev.map((aoi) => aoi.id === selectedAoiId ? { ...aoi, name } : aoi))
  }
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
  const selectedAoi = selectedAoiId ? aois.find((aoi) => aoi.id === selectedAoiId) ?? null : null;

  return (
    <div className="app">
      <header>ATLAS</header>
      <div className="toolbar">
        <button type="button" onClick={() => setIsInspectorVisible((prev) => !prev)}>Toggle Inspector</button>
        <button type="button" onClick={handleDrawButtonClick}>{isDrawing ? 'Cancel Drawing' : 'Draw AOI'}</button>
        {isDrawing && (
          <button type="button" disabled={draftPositions.length < 3} onClick={handleSaveButtonClick}>Finish AOI</button>
        )}
      </div>
      
      <div className="workspace">
        
        <main>
          <MapView aois={aois} isDrawing={isDrawing} onAoiSelect={handleAoiSelect} onVertexAdd={handleVertexAdd} draftPositions={draftPositions}/>
        </main>
        {isInspectorVisible && <AoiInspector aoi={selectedAoi} onNameChange={handleNameChange}/>}
      </div>
    </div>
  );
}

export default App;
