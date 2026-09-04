import { useState } from 'react';

import type { AreaOfInterest } from "./types";

type AoiInspectorProps = {
    aoi: AreaOfInterest | null;
    onNameChange: (name: string) => void;
}

export function AoiInspector({aoi, onNameChange}: AoiInspectorProps) {
    const [renameToggle, setRenameToggle] = useState(false);
    const handleRenameToggle = () => {
        setRenameToggle((prev) => !prev);
    }
    return (
        <aside className="aoi-inspector-container">
            <h2 className="aoi-inspector-title">AOI Inspector</h2>
            <div className="aoi-inspector-main">
                <p>Selected AOI:</p>
                {aoi ? 
                <div>
                    <h2>{aoi.name}</h2>
                    <button type="button" onClick={handleRenameToggle}>{renameToggle ? 'Save' : 'Rename'}</button>
                    {renameToggle ? <input type="text" value={aoi.name} onChange={(e) => onNameChange(e.target.value)} /> : null}
                    <p>{`${aoi.geometry.coordinates[0].length - 1} vertices`}</p>
                    <p>{`Created at ${new Date(aoi.createdAt).toLocaleString()}`}</p>
                </div>
                : 
                <div>
                    <p>No AOI selected</p>
                </div>}
            </div>
        </aside>
    )
}