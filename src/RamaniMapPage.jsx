import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const tileSources = {
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, HERE, Garmin, USGS, Intermap, and the GIS User Community',
  },
  hybrid: {
    name: 'Hybrid',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
};

const savedLayerKey = 'agrinest-ramani-drawn-fields';
const tanzaniaCenter = [-7.77, 35.69];

function RamaniLeafletControl({ children, position = 'bottomright' }) {
  const map = useMap();
  const [container, setContainer] = useState(null);

  useEffect(() => {
    const control = L.control({ position });
    control.onAdd = () => {
      const node = L.DomUtil.create('div', 'ramani-leaflet-control');
      L.DomEvent.disableScrollPropagation(node);
      setContainer(node);
      return node;
    };
    control.addTo(map);
    return () => control.remove();
  }, [map, position]);

  return container ? createPortal(children, container) : null;
}

function toValidCoordinates(latitude, longitude) {
  if (latitude === '' || latitude === null || latitude === undefined || longitude === '' || longitude === null || longitude === undefined) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? [lat, lon]
    : null;
}

function MapLibreTerrain({ center, zoom, mapCommandsRef, onViewChange, onError }) {
  const containerRef = useRef(null);
  const onViewChangeRef = useRef(onViewChange);
  const onErrorRef = useRef(onError);
  const initialViewRef = useRef({ center, zoom });

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
    onErrorRef.current = onError;
  }, [onError, onViewChange]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let isCurrent = true;
    let map;
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([maplibreModule]) => {
      if (!isCurrent || !containerRef.current) return;
      const maplibregl = maplibreModule.default;
      map = new maplibregl.Map({
        container: containerRef.current,
        center: [initialViewRef.current.center[1], initialViewRef.current.center[0]],
        zoom: Math.max(initialViewRef.current.zoom, 15),
        pitch: 64,
        bearing: -18,
        maxPitch: 75,
        attributionControl: true,
        logoControl: false,
        style: 'https://tiles.openfreemap.org/styles/liberty',
      });
      map.on('load', () => {
        map.addSource('ramani-terrain', {
          type: 'raster-dem',
          tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 15,
        });
        map.setTerrain({ source: 'ramani-terrain', exaggeration: 1.35 });
        if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', '#10243b');
        if (map.getLayer('building-3d')) {
          map.setPaintProperty('building-3d', 'fill-extrusion-color', '#c7cad2');
          map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.96);
        }
      });
      mapCommandsRef.current = {
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut(),
        flyTo: (coordinates) => map.flyTo({ center: [coordinates[1], coordinates[0]], zoom: Math.max(map.getZoom(), 15), duration: 800 }),
      };
      map.on('moveend', () => {
        const mapCenter = map.getCenter();
        onViewChangeRef.current?.({ center: [mapCenter.lat, mapCenter.lng], zoom: map.getZoom() });
      });
    }).catch((error) => {
      console.error('MapLibre terrain failed to load:', error);
      if (isCurrent) onErrorRef.current?.();
    });
    return () => {
      isCurrent = false;
      map?.remove();
      mapCommandsRef.current = null;
    };
  }, [mapCommandsRef]);

  return <div className="ramani-3d-map" ref={containerRef} aria-label="3D OpenStreetMap terrain" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

function MapInteractions({ drawing, enabled, onAddPoint, onGpsLocation, onGpsError, onViewChange, mapCommandsRef }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return undefined;
    mapCommandsRef.current = {
      locate: () => map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true }),
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      flyTo: (coordinates) => map.flyTo(coordinates, Math.max(map.getZoom(), 15), { duration: 0.8 }),
    };
    map.invalidateSize();
    return () => { mapCommandsRef.current = null; };
  }, [enabled, map, mapCommandsRef]);

  useMapEvents({
    moveend() {
      const center = map.getCenter();
      onViewChange?.({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
    click(event) {
      if (drawing && !event.originalEvent.target.closest('.leaflet-control')) {
        onAddPoint([event.latlng.lat, event.latlng.lng]);
      }
    },
    locationfound(event) {
      onGpsLocation([event.latlng.lat, event.latlng.lng]);
    },
    locationerror() {
      onGpsError('Location permission was unavailable. Use your saved profile coordinates or move the map manually.');
    },
  });

  return null;
}

function RestoreLeafletView({ isThreeDimensional, view }) {
  const map = useMap();
  const wasThreeDimensional = useRef(isThreeDimensional);

  useEffect(() => {
    if (wasThreeDimensional.current && !isThreeDimensional) {
      map.setView(view.center, view.zoom, { animate: false });
    }
    wasThreeDimensional.current = isThreeDimensional;
  }, [isThreeDimensional, map, view.center, view.zoom]);

  return null;
}

function coordinatesToGeoJson(fields, farmLocation) {
  const features = fields.map((field, index) => ({
    type: 'Feature',
    properties: { name: field.name || `Drawn field ${index + 1}`, source: 'local-map-draft' },
    geometry: {
      type: 'Polygon',
      coordinates: [[...field.points.map(([latitude, longitude]) => [longitude, latitude]), [field.points[0][1], field.points[0][0]]]],
    },
  }));
  if (farmLocation) {
    features.push({
      type: 'Feature',
      properties: { name: 'Saved profile location', source: 'farmer-profile' },
      geometry: { type: 'Point', coordinates: [farmLocation[1], farmLocation[0]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export default function RamaniMapPage({ profile, search = '', onSearch = () => {} }) {
  const profileLocation = useMemo(() => toValidCoordinates(profile.latitude, profile.longitude), [profile.latitude, profile.longitude]);
  const [selectedLayer, setSelectedLayer] = useState('satellite');
  const [isThreeDimensional, setIsThreeDimensional] = useState(false);
  const [showFarmLocation, setShowFarmLocation] = useState(true);
  const [showFieldBoundaries, setShowFieldBoundaries] = useState(true);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [drawnFields, setDrawnFields] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(savedLayerKey) || '[]');
      return Array.isArray(saved) ? saved.filter((field) => Array.isArray(field.points) && field.points.length >= 3) : [];
    } catch {
      return [];
    }
  });
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [status, setStatus] = useState('');
  const [mapView, setMapView] = useState(() => ({ center: profileLocation || tanzaniaCenter, zoom: profileLocation ? 14 : 11 }));
  const mapCommandsRef = useRef(null);
  const mapCenter = profileLocation || tanzaniaCenter;

  const handleMapViewChange = (nextView) => setMapView(nextView);

  const selectMapLayer = (layer) => {
    setSelectedLayer(layer);
    setIsThreeDimensional(false);
  };

  const zoomIn = () => mapCommandsRef.current?.zoomIn();

  useEffect(() => {
    try {
      window.localStorage.setItem(savedLayerKey, JSON.stringify(drawnFields));
    } catch {
      setStatus('Could not save field drafts in this browser. Export the layer to keep a copy.');
    }
  }, [drawnFields]);

  useEffect(() => {
    const query = search.trim();
    if (!query) return;
    let isCurrent = true;
    let timeoutId;
    const coordinates = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinates) {
      const target = toValidCoordinates(coordinates[1], coordinates[2]);
      if (target) mapCommandsRef.current?.flyTo(target);
      else setStatus('Enter valid latitude and longitude values.');
      return undefined;
    }
    const isRegionMatch = [profile.region, profile.city, profile.district, profile.location].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()));
    if (isRegionMatch && profileLocation) {
      mapCommandsRef.current?.flyTo(profileLocation);
      return undefined;
    }
    timeoutId = window.setTimeout(async () => {
      try {
        const parameters = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'tz', q: query });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`, { headers: { 'Accept-Language': 'en,sw' } });
        if (!response.ok) throw new Error('Place search unavailable.');
        const [result] = await response.json();
        if (!isCurrent) return;
        const target = result ? toValidCoordinates(result.lat, result.lon) : null;
        if (target) {
          mapCommandsRef.current?.flyTo(target);
          setStatus(`Showing ${result.display_name.split(',').slice(0, 2).join(',')}.`);
        } else {
          setStatus('No matching place found in Tanzania. Try a region, district, ward, or coordinates.');
        }
      } catch {
        if (isCurrent) setStatus('Place search is unavailable. Search by latitude and longitude instead.');
      }
    }, 650);
    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [search, profile.region, profile.city, profile.district, profile.location, profileLocation]);

  const finishDrawing = () => {
    if (draftPoints.length < 3) {
      setStatus('Add at least three points to finish a field boundary.');
      return;
    }
    const name = `Field draft ${drawnFields.length + 1}`;
    setDrawnFields((current) => [...current, { name, points: draftPoints }]);
    setSelectedFieldIndex(drawnFields.length);
    setDraftPoints([]);
    setIsDrawing(false);
    setStatus(`${name} saved on this device. Export GeoJSON to share it.`);
  };

  const cancelDrawing = () => {
    setDraftPoints([]);
    setIsDrawing(false);
    setStatus('Field drawing cancelled.');
  };

  const exportLayerData = () => {
    const blob = new Blob([JSON.stringify(coordinatesToGeoJson(drawnFields, profileLocation), null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'agrinest-ramani-fields.geojson';
    download.click();
    URL.revokeObjectURL(url);
    setStatus('GeoJSON layer exported.');
  };

  const selectedField = selectedFieldIndex === null ? null : drawnFields[selectedFieldIndex];
  const tileSource = tileSources[selectedLayer];

  return (
    <section className="ramani-page" aria-label="Ramani GIS map">
      <MapContainer
        className="ramani-leaflet-map"
        center={mapView.center}
        zoom={mapView.zoom}
        minZoom={3}
        maxZoom={19}
        scrollWheelZoom
        style={{ visibility: isThreeDimensional ? 'hidden' : 'visible' }}
        doubleClickZoom={!isDrawing}
        zoomControl={false}
        attributionControl
      >
        <TileLayer key={selectedLayer} url={tileSource.url} attribution={tileSource.attribution} maxZoom={19} />
        {selectedLayer === 'hybrid' && <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Labels &copy; Esri" maxZoom={19} />}
        <MapInteractions
          drawing={isDrawing}
          enabled={!isThreeDimensional}
          onAddPoint={(point) => setDraftPoints((current) => [...current, point])}
          onGpsLocation={(point) => { setGpsLocation(point); setStatus('Current GPS position shown on map.'); }}
          onGpsError={setStatus}
          onViewChange={handleMapViewChange}
          mapCommandsRef={mapCommandsRef}
        />
        <RestoreLeafletView isThreeDimensional={isThreeDimensional} view={mapView} />
        {showFarmLocation && profileLocation && (
          <CircleMarker center={profileLocation} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#e1a83b', fillOpacity: 1 }}>
            <Popup><strong>Saved farm location</strong><br />{profile.location || `${profileLocation[0].toFixed(5)}, ${profileLocation[1].toFixed(5)}`}</Popup>
          </CircleMarker>
        )}
        {gpsLocation && <CircleMarker center={gpsLocation} radius={8} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#17885a', fillOpacity: 1 }}><Popup>Current GPS position</Popup></CircleMarker>}
        {showFieldBoundaries && drawnFields.map((field, index) => (
          <Polygon
            key={`${field.name}-${index}`}
            positions={field.points}
            pathOptions={{ color: selectedFieldIndex === index ? '#f1c75b' : '#54d69a', weight: 2, fillColor: '#48ba7e', fillOpacity: 0.2 }}
            eventHandlers={{ click: () => setSelectedFieldIndex(index) }}
          >
            <Popup>{field.name}<br />Local draft · not synced</Popup>
          </Polygon>
        ))}
        {isDrawing && draftPoints.length > 0 && <Polygon positions={draftPoints} pathOptions={{ color: '#f1c75b', dashArray: '6 6', fillColor: '#f1c75b', fillOpacity: 0.16 }} />}
        <RamaniLeafletControl>
          <div className="ramani-control-tools">
            <div className="ramani-tool-group">
              <button type="button" title="Draw field boundary" aria-label="Draw field boundary" className={isDrawing ? 'active' : ''} onClick={() => { setIsDrawing(true); setDraftPoints([]); setSelectedFieldIndex(null); setStatus('Click the map to add boundary points. Finish after at least three points.'); }}><span className="material-symbols-outlined">draw</span></button>
              <button type="button" title="Show my current GPS location" aria-label="Show my current GPS location" onClick={() => mapCommandsRef.current?.locate()}><span className="material-symbols-outlined">gps_fixed</span></button>
              {isDrawing && <div className="ramani-draw-actions"><button type="button" onClick={finishDrawing} disabled={draftPoints.length < 3}>Finish field</button><button type="button" onClick={cancelDrawing}>Cancel</button><span>{draftPoints.length} points</span></div>}
            </div>
            <div className="ramani-tool-group ramani-zoom-tools">
              <button type="button" title="Zoom in" aria-label="Zoom in" onClick={zoomIn}><span className="material-symbols-outlined">add</span></button>
              <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => mapCommandsRef.current?.zoomOut()}><span className="material-symbols-outlined">remove</span></button>
            </div>
          </div>
        </RamaniLeafletControl>
        <RamaniLeafletControl position="bottomleft">
          <div className="ramani-map-footer">
            <div><span className="material-symbols-outlined">location_on</span><span>{gpsLocation ? 'Current GPS' : profile.region || 'Iringa Region'}</span></div>
            <div className="ramani-map-modes" role="group" aria-label="Map style">
              {Object.entries(tileSources).map(([key, source]) => <button type="button" key={key} className={selectedLayer === key ? 'active' : ''} onClick={() => selectMapLayer(key)}>{source.name}</button>)}
              <button type="button" title="3D buildings view" aria-label="3D buildings view" className={isThreeDimensional ? 'active' : ''} onClick={() => { setIsThreeDimensional(true); setStatus('3D building view enabled.'); }}>3D</button>
            </div>
          </div>
        </RamaniLeafletControl>
      </MapContainer>
      {isThreeDimensional && (
        <>
          <MapLibreTerrain
            center={mapView.center}
            zoom={mapView.zoom}
            mapCommandsRef={mapCommandsRef}
            onViewChange={handleMapViewChange}
            onError={() => { setIsThreeDimensional(false); setStatus('3D terrain is unavailable. Returned to the 2D map.'); }}
          />
          <div className="ramani-3d-badge"><span className="material-symbols-outlined">3d_rotation</span>3D TERRAIN</div>
          <div className="ramani-3d-controls" aria-label="3D map controls">
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => mapCommandsRef.current?.zoomIn()}><span className="material-symbols-outlined">add</span></button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => mapCommandsRef.current?.zoomOut()}><span className="material-symbols-outlined">remove</span></button>
            <button type="button" title="Return to 2D map" aria-label="Return to 2D map" onClick={() => { setIsThreeDimensional(false); setStatus('Returned to 2D map view.'); }}><span className="material-symbols-outlined">map</span></button>
          </div>
        </>
      )}

      <div className="ramani-overlay ramani-layer-panel">
        <div className="ramani-panel-heading"><div><span>GIS DASHBOARD</span><h2>Active layers</h2></div><span className="material-symbols-outlined">layers</span></div>
        <label className="ramani-mobile-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search coordinates or place" aria-label="Search map coordinates or locations" /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot profile-dot" />Saved farm location</span><input type="checkbox" checked={showFarmLocation && Boolean(profileLocation)} onChange={(event) => setShowFarmLocation(event.target.checked)} disabled={!profileLocation} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot field-dot" />Field boundaries ({drawnFields.length})</span><input type="checkbox" checked={showFieldBoundaries} onChange={(event) => setShowFieldBoundaries(event.target.checked)} /></label>
        <div className="ramani-layer-note">Field drafts are stored on this device until exported.</div>
        <button type="button" className="ramani-export-button" onClick={exportLayerData}><span className="material-symbols-outlined">ios_share</span>Export GeoJSON</button>
      </div>

      <div className="ramani-overlay ramani-insight-panel">
        <div className="ramani-insight-heading"><div><span>Current selection</span><h2>{selectedField?.name || 'Field insight'}</h2></div><span className={profileLocation ? 'ramani-data-badge' : 'ramani-data-badge muted'}>{profileLocation ? 'PROFILE GPS' : 'NO GPS'}</span></div>
        {selectedField ? (
          <div className="ramani-field-stats"><div><span>Boundary vertices</span><strong>{selectedField.points.length}</strong></div><div><span>Data source</span><strong>Local draft</strong></div><p>This boundary is saved in this browser only. Export GeoJSON to transfer it.</p><button type="button" onClick={() => { setDrawnFields((current) => current.filter((_, index) => index !== selectedFieldIndex)); setSelectedFieldIndex(null); }}>Delete selected draft</button></div>
        ) : profileLocation ? (
          <div className="ramani-field-stats"><div><span>Registered location</span><strong>{profile.location || profile.region || 'Farm location'}</strong></div><div><span>Coordinates</span><strong>{profileLocation[0].toFixed(5)}, {profileLocation[1].toFixed(5)}</strong></div><p>GPS point saved in your AGRI-NEST profile.</p></div>
        ) : (
          <div className="ramani-no-data"><span className="material-symbols-outlined">location_searching</span><p>No farm GPS is saved in this profile yet.</p><button type="button" onClick={() => { setStatus('Save farm coordinates in Profile → Edit address and GPS details.'); }}>View location setup</button></div>
        )}
      </div>

      {status && <div className="ramani-status" role="status"><span>{status}</span><button type="button" aria-label="Dismiss map message" onClick={() => setStatus('')}><span className="material-symbols-outlined">close</span></button></div>}
    </section>
  );
}
