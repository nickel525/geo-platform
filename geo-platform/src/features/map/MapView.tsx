import { useRef, useEffect} from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { AreaOfInterest } from '../aois/types';

type MapViewProps = {
    aois: AreaOfInterest[];
}
maplibregl.setWorkerUrl(workerUrl);

export function MapView({ aois }: MapViewProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    
    useEffect(() => {
        const container = mapContainerRef.current;
        if (!container) return;

        const map = new maplibregl.Map({
            container: container,
            style: 'https://demotiles.maplibre.org/style.json',
            center: [0, 0],
            zoom: 1,
        })

        map.on('load', () => {
            const collection = {
              type: 'FeatureCollection' as const,
              features: aois.map((aoi) => ({
                type: 'Feature' as const,
                id: aoi.id,
                geometry: aoi.geometry,
                properties: { name: aoi.name },
              })),
            }
          
            map.addSource('aois', {
              type: 'geojson',
              data: collection,
            })
          
            map.addLayer({
              id: 'aois-fill',
              type: 'fill',
              source: 'aois',
              paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.1,
              },
            })
          
            map.addLayer({
              id: 'aois-outline',
              type: 'line',
              source: 'aois',
              paint: {
                'line-color': '#000000',
                'line-width': 2,
              },
            })
          })

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        }
    }, []);

    return (
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    )
}