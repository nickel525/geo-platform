import type { Polygon } from 'geojson';

export type AreaOfInterest = {
    id: string;
    name: string;
    geometry: Polygon;
    createdAt: string;
}