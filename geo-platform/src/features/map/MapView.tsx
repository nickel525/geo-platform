import { useRef, useEffect} from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { AreaOfInterest } from '../aois/types';
import type { Position } from 'geojson';

type MapViewProps = {
    aois: AreaOfInterest[];
    isDrawing: boolean;
    onVertexAdd: (position: Position) => void;
    draftPositions: Position[];
    onAoiSelect: (id: string | null) => void;
}
maplibregl.setWorkerUrl(workerUrl);

export function MapView({ aois, isDrawing, onVertexAdd, draftPositions, onAoiSelect }: MapViewProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    const isDrawingRef = useRef<boolean>(isDrawing);
    isDrawingRef.current = isDrawing;

    const onVertexAddRef = useRef(onVertexAdd);
    onVertexAddRef.current = onVertexAdd

    const onAoiSelectRef = useRef(onAoiSelect);
    onAoiSelectRef.current = onAoiSelect;

    
    useEffect(() => {
        const container = mapContainerRef.current;
        if (!container) return;

        const map = new maplibregl.Map({
            container: container,
            style: 'https://demotiles.maplibre.org/style.json',
            center: [0, 0],
            zoom: 1,
        })

        map.on('click', (e) => {
          if (isDrawingRef.current) {
            onVertexAddRef.current([e.lngLat.lng, e.lngLat.lat]);
          } else {
            const features = map.queryRenderedFeatures(e.point, {layers: ['aois-fill']});
            const aoiId = features.length > 0 ? String(features[0].properties?.id) : null;
            onAoiSelectRef.current(aoiId);
          }
        });

        map.on('mousemove', (e) => {
          if (!map.getLayer('aois-fill')) return
          if (isDrawingRef.current) {
            map.getCanvas().style.cursor = 'crosshair'
            return
          }
          const features = map.queryRenderedFeatures(e.point, {layers: ['aois-fill']});
          if (features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
          } else {
            map.getCanvas().style.cursor = '';
          }
        })

        map.on('load', () => {
            const collection = aoisToFeatureCollection(aois);
          
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

            map.addSource('draft', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: []},
            })

            map.addLayer({
              id: 'draft-line',
              type: 'line',
              source: 'draft',
              paint: {
                'line-color': '#000000',
                'line-width': 2,
              },
            })

            map.addLayer({
              id: 'draft-points',
              type: 'circle',
              source: 'draft',
              paint: {
                'circle-radius': 5,
                'circle-color': '#000000',
              }
            })

          })

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        }
    }, []);

    useEffect(() => {
      const source = mapRef.current?.getSource('aois');
      if (source?.type !== 'geojson') return;
      (source as maplibregl.GeoJSONSource).setData(aoisToFeatureCollection(aois));
    }, [aois]);

    useEffect(() => {
      const source = mapRef.current?.getSource('draft');
      if (source?.type !== 'geojson') return;
      (source as maplibregl.GeoJSONSource).setData(draftToGeoJSON(draftPositions) as GeoJSON.FeatureCollection);
    }, [draftPositions]);

    useEffect(() => {
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor = isDrawing ? 'crosshair' : '';
      }
    }, [isDrawing]);

    return (
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    )
}

function draftToGeoJSON(positions: Position[]) {
  if (positions.length === 0) return { type: 'FeatureCollection', features: []};

  const points = positions.map((coordinates) => ({
    type: 'Feature' as const,
    geometry: {type: 'Point', coordinates: coordinates},
    properties: {},
  }))

  if (positions.length === 1) return { type: 'FeatureCollection', features: points};

  const line = {
    type: 'Feature' as const,
    geometry: {type: 'LineString', coordinates: positions},
    properties: {},
  }

  return { type: 'FeatureCollection', features: [...points, line]};

}

function aoisToFeatureCollection(aois: AreaOfInterest[]): GeoJSON.FeatureCollection {
  const features = {
    type: 'FeatureCollection' as const,
    features: aois.map((aoi) => ({
      type: 'Feature' as const,
      id: aoi.id,
      geometry: aoi.geometry,
      properties: { id: aoi.id,name: aoi.name },
    })),
  }
  return features;
}