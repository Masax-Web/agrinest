import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
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
  streets: {
    name: 'Roads',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  hybrid: {
    name: 'Hybrid',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
};

const savedLayerKey = 'agrinest-ramani-drawn-fields';
const trainingLayerKey = 'agrinest-ramani-training-samples';
const mapDrawingsKey = 'agrinest-ramani-map-drawings';
const mapNotesKey = 'agrinest-ramani-field-notes';
const weatherCacheKey = 'agrinest-ramani-weather-cache';
const tanzaniaCenter = [-7.77, 35.69];
const earthRadiusMeters = 6371008.8;
const trainingLabels = {
  'farm-field': 'Farm field',
  'non-farm': 'Not a farm field',
};
const landmarkTypes = {
  water: { label: 'Water source', icon: 'water_drop', color: '#158bb4' },
  gate: { label: 'Gate / entrance', icon: 'meeting_room', color: '#aa712c' },
  store: { label: 'Store / shed', icon: 'warehouse', color: '#7558a8' },
  road: { label: 'Road access', icon: 'route', color: '#68736c' },
  hazard: { label: 'Hazard', icon: 'warning', color: '#c83d42' },
  equipment: { label: 'Equipment', icon: 'agriculture', color: '#3e7d48' },
  market: { label: 'Market / service', icon: 'storefront', color: '#3175bb' },
  drainage: { label: 'Drainage', icon: 'water', color: '#3f91a5' },
};
const noteTypes = ['Planting', 'Fertilizer', 'Pest / disease', 'Flooding / weather', 'Harvest', 'General'];

function createMapId() {
  return globalThis.crypto?.randomUUID?.() || `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalJson(key, fallback) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || 'null');
    return stored ?? fallback;
  } catch {
    return fallback;
  }
}

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

function hasValidPolygonPoints(points) {
  return hasValidMapPoints(points, 3);
}

function hasValidMapPoints(points, minimumPoints = 1) {
  return Array.isArray(points)
    && points.length >= minimumPoints
    && points.every((point) => Array.isArray(point)
      && Number.isFinite(point[0])
      && Number.isFinite(point[1])
      && Math.abs(point[0]) <= 90
      && Math.abs(point[1]) <= 180);
}

function distanceBetweenPoints([latitudeA, longitudeA], [latitudeB, longitudeB]) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function pathLengthMeters(points) {
  return points.slice(1).reduce((total, point, index) => total + distanceBetweenPoints(points[index], point), 0);
}

function polygonAreaSquareMeters(points) {
  const area = points.reduce((total, [latitude, longitude], index) => {
    const [nextLatitude, nextLongitude] = points[(index + 1) % points.length];
    const latitudeRadians = latitude * Math.PI / 180;
    const nextLatitudeRadians = nextLatitude * Math.PI / 180;
    const longitudeDelta = (nextLongitude - longitude) * Math.PI / 180;
    return total + longitudeDelta * (2 + Math.sin(latitudeRadians) + Math.sin(nextLatitudeRadians));
  }, 0);
  return Math.abs(area * earthRadiusMeters ** 2 / 2);
}

function circleBoundary(center, radiusMeters, segments = 64) {
  const [latitude, longitude] = center;
  const angularDistance = radiusMeters / earthRadiusMeters;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeRadians = longitude * Math.PI / 180;
  return Array.from({ length: segments }, (_, index) => {
    const bearing = 2 * Math.PI * index / segments;
    const destinationLatitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance)
      + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destinationLongitude = longitudeRadians + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(destinationLatitude),
    );
    return [destinationLatitude * 180 / Math.PI, destinationLongitude * 180 / Math.PI];
  });
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

function formatAreaInBothUnits(squareMeters) {
  return `${(squareMeters / 10000).toFixed(2)} ha · ${(squareMeters / 4046.8564224).toFixed(2)} acres`;
}

function polygonCenter(points) {
  if (!points?.length) return null;
  return points.reduce(([lat, lon], point) => [lat + point[0] / points.length, lon + point[1] / points.length], [0, 0]);
}

function bearingBetweenPoints([latitudeA, longitudeA], [latitudeB, longitudeB]) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const toDegrees = (radians) => radians * 180 / Math.PI;
  const latitudeARadians = toRadians(latitudeA);
  const latitudeBRadians = toRadians(latitudeB);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeBRadians);
  const x = Math.cos(latitudeARadians) * Math.sin(latitudeBRadians)
    - Math.sin(latitudeARadians) * Math.cos(latitudeBRadians) * Math.cos(longitudeDelta);
  const direction = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(direction / 45) % 8];
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
      if (drawing && !event.originalEvent.target.closest('.leaflet-control, .ramani-overlay')) {
        onAddPoint([event.latlng.lat, event.latlng.lng]);
      }
    },
    locationfound(event) {
      onGpsLocation([event.latlng.lat, event.latlng.lng], event.accuracy);
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

function coordinatesToGeoJson(fields, farmLocation, drawings = []) {
  const features = fields.map((field, index) => ({
    type: 'Feature',
    properties: {
      name: field.name || `Drawn field ${index + 1}`,
      shape: 'field-boundary',
      source: 'local-map-draft',
      crop: field.crop || '',
      plantingDate: field.plantingDate || '',
      season: field.season || '',
      saved: Boolean(field.saved),
      areaSquareMeters: polygonAreaSquareMeters(field.points),
      boundaryMethod: field.boundarySource || 'manual',
      gpsAccuracyMeters: field.gpsAccuracy || null,
    },
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
  drawings.forEach((drawing, index) => {
    let geometry;
    if (drawing.type === 'point' || drawing.type === 'landmark') {
      geometry = { type: 'Point', coordinates: [drawing.points[0][1], drawing.points[0][0]] };
    } else {
      const points = drawing.type === 'circle' ? circleBoundary(drawing.center, drawing.radiusMeters) : drawing.points;
      if (drawing.type === 'circle' || drawing.type === 'area') {
        geometry = {
          type: 'Polygon',
          coordinates: [[...points.map(([latitude, longitude]) => [longitude, latitude]), [points[0][1], points[0][0]]]],
        };
      } else {
        geometry = { type: 'LineString', coordinates: points.map(([latitude, longitude]) => [longitude, latitude]) };
      }
    }
    features.push({
      type: 'Feature',
      properties: { name: drawing.name || `Map drawing ${index + 1}`, shape: drawing.type, category: drawing.category || '', description: drawing.description || '', source: 'local-map-drawing' },
      geometry,
    });
  });
  return { type: 'FeatureCollection', features };
}

function trainingSamplesToGeoJson(samples) {
  return {
    type: 'FeatureCollection',
    features: samples.map((sample, index) => ({
      type: 'Feature',
      properties: {
        name: sample.name || `Training sample ${index + 1}`,
        label: sample.label,
        source: 'ramani-map-annotation',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[...sample.points.map(([latitude, longitude]) => [longitude, latitude]), [sample.points[0][1], sample.points[0][0]]]],
      },
    })),
  };
}

export default function RamaniMapPage({ profile, search = '', onSearch = () => {}, compact = false, focusPlotName = '', initialLayer = 'satellite' }) {
  const profileLocation = useMemo(() => toValidCoordinates(profile.latitude, profile.longitude), [profile.latitude, profile.longitude]);
  const [selectedLayer, setSelectedLayer] = useState(initialLayer);
  const [isThreeDimensional, setIsThreeDimensional] = useState(false);
  const [showFarmLocation, setShowFarmLocation] = useState(true);
  const [showFieldBoundaries, setShowFieldBoundaries] = useState(true);
  const [showTrainingSamples, setShowTrainingSamples] = useState(true);
  const [showMapDrawings, setShowMapDrawings] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator?.onLine !== false);
  const [includeFarmLocation, setIncludeFarmLocation] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isGpsTracing, setIsGpsTracing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState('field');
  const [trainingLabel, setTrainingLabel] = useState('farm-field');
  const [landmarkType, setLandmarkType] = useState('water');
  const [weatherSnapshot, setWeatherSnapshot] = useState(() => readLocalJson(weatherCacheKey, null));
  const [weatherStatus, setWeatherStatus] = useState('Loading local forecast…');
  const [weatherRefreshToken, setWeatherRefreshToken] = useState(0);
  const [landmarksQuery, setLandmarksQuery] = useState([]);
  const [landmarksStatus, setLandmarksStatus] = useState('');
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [shareAudience, setShareAudience] = useState('extension');
  const [shareIncludeNotes, setShareIncludeNotes] = useState(false);
  const [shareIncludeLocation, setShareIncludeLocation] = useState(false);
  const [shareIncludeBoundaries, setShareIncludeBoundaries] = useState(false);
  const [shareConsent, setShareConsent] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [plotDetails, setPlotDetails] = useState({ name: '', crop: '', plantingDate: '', season: '' });
  const [boundaryEditIndex, setBoundaryEditIndex] = useState(null);
  const [boundaryEditPoints, setBoundaryEditPoints] = useState(null);
  const [noteDraft, setNoteDraft] = useState({ category: 'General', text: '', date: new Date().toISOString().slice(0, 10), reminderDate: '', image: '' });
  const [mapDrawings, setMapDrawings] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(mapDrawingsKey) || '[]');
      return Array.isArray(saved)
        ? saved.filter((drawing) => {
          if (drawing.type === 'point') return hasValidMapPoints(drawing.points);
          if (drawing.type === 'circle') return toValidCoordinates(drawing.center?.[0], drawing.center?.[1]) && Number.isFinite(drawing.radiusMeters) && drawing.radiusMeters > 0;
          const minimumPoints = drawing.type === 'area' ? 3 : 2;
          if (drawing.type === 'landmark') return toValidCoordinates(drawing.points?.[0]?.[0], drawing.points?.[0]?.[1]) && landmarkTypes[drawing.category];
          return ['line', 'distance', 'area'].includes(drawing.type) && hasValidMapPoints(drawing.points, minimumPoints);
        })
        : [];
    } catch {
      return [];
    }
  });
  const [drawnFields, setDrawnFields] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(savedLayerKey) || '[]');
      return Array.isArray(saved) ? saved.filter((field) => hasValidPolygonPoints(field.points)) : [];
    } catch {
      return [];
    }
  });
  const [trainingSamples, setTrainingSamples] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(trainingLayerKey) || '[]');
      return Array.isArray(saved)
        ? saved.filter((sample) => trainingLabels[sample.label] && hasValidPolygonPoints(sample.points))
        : [];
    } catch {
      return [];
    }
  });
  const [fieldNotes, setFieldNotes] = useState(() => {
    const saved = readLocalJson(mapNotesKey, []);
    return Array.isArray(saved) ? saved.filter((note) => note && typeof note.text === 'string') : [];
  });
  const [nearbyFeatures, setNearbyFeatures] = useState([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(() => {
    const index = drawnFields.findIndex((field) => field.saved && field.name?.trim().toLowerCase() === focusPlotName.trim().toLowerCase());
    return index < 0 ? null : index;
  });
  const [selectedTrainingIndex, setSelectedTrainingIndex] = useState(null);
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(null);
  const [status, setStatus] = useState('');
  const [mapView, setMapView] = useState(() => {
    const focusedField = drawnFields.find((field) => field.saved && field.name?.trim().toLowerCase() === focusPlotName.trim().toLowerCase());
    return focusedField
      ? { center: polygonCenter(focusedField.points), zoom: 16 }
      : { center: profileLocation || tanzaniaCenter, zoom: profileLocation ? 14 : 11 };
  });
  const mapCommandsRef = useRef(null);
  const gpsTraceWatchRef = useRef(null);
  const selectedField = selectedFieldIndex === null ? null : drawnFields[selectedFieldIndex];
  const selectedTrainingSample = selectedTrainingIndex === null ? null : trainingSamples[selectedTrainingIndex];
  const selectedDrawing = selectedDrawingIndex === null ? null : mapDrawings[selectedDrawingIndex];
  const weatherLocation = selectedField ? polygonCenter(selectedField.points) : profileLocation || gpsLocation;
  const selectedFieldNotes = selectedField ? fieldNotes.filter((note) => note.plotId === (selectedField.id || selectedField.name)) : [];
  const reminderHorizon = new Date();
  reminderHorizon.setDate(reminderHorizon.getDate() + 14);
  const selectedReminders = selectedFieldNotes.filter((note) => note.reminderDate && note.reminderDate <= reminderHorizon.toISOString().slice(0, 10));
  const selectedNavigationTarget = selectedField
    ? polygonCenter(selectedField.points)
    : selectedDrawing?.type === 'landmark'
      ? selectedDrawing.points[0]
      : selectedDrawing?.type === 'point'
        ? selectedDrawing.points[0]
        : null;
  const directionsUrl = gpsLocation && selectedNavigationTarget
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`${gpsLocation[0]},${gpsLocation[1]};${selectedNavigationTarget[0]},${selectedNavigationTarget[1]}`)}`
    : null;

  const handleMapViewChange = (nextView) => setMapView(nextView);

  useEffect(() => {
    setSelectedLayer(initialLayer);
  }, [initialLayer]);

  const selectMapLayer = (layer) => {
    setSelectedLayer(layer);
    setIsThreeDimensional(false);
  };

  const zoomIn = () => mapCommandsRef.current?.zoomIn();

  useEffect(() => {
    if (!selectedField) {
      setPlotDetails({ name: '', crop: '', plantingDate: '', season: '' });
      return;
    }
    setPlotDetails({
      name: selectedField.name || '',
      crop: selectedField.crop || '',
      plantingDate: selectedField.plantingDate || '',
      season: selectedField.season || '',
    });
  }, [selectedFieldIndex]);

  const savePlotDetails = (event) => {
    event.preventDefault();
    if (selectedFieldIndex === null || !plotDetails.name.trim()) {
      setStatus('Enter a plot name before saving its farm record.');
      return;
    }
    setDrawnFields((current) => current.map((field, index) => index === selectedFieldIndex
      ? { ...field, ...plotDetails, name: plotDetails.name.trim(), saved: true, id: field.id || field.name, areaSquareMeters: polygonAreaSquareMeters(field.points), updatedAt: new Date().toISOString() }
      : field));
    setStatus(`${plotDetails.name.trim()} saved as a named farm plot on this device.`);
  };

  const deleteSelectedPlot = () => {
    if (selectedFieldIndex === null) return;
    const field = drawnFields[selectedFieldIndex];
    const plotId = field?.id || field?.name;
    setDrawnFields((current) => current.filter((_, index) => index !== selectedFieldIndex));
    setFieldNotes((current) => current.filter((note) => note.plotId !== plotId));
    setSelectedFieldIndex(null);
    setBoundaryEditIndex(null);
    setBoundaryEditPoints(null);
    setStatus('Plot and its attached local notes were deleted from this device.');
  };

  const saveFieldNote = async (event) => {
    event.preventDefault();
    if (!selectedField || !noteDraft.text.trim()) {
      setStatus('Choose a plot and enter a note before saving.');
      return;
    }
    const plotId = selectedField.id || selectedField.name;
    if (!selectedField.id) setDrawnFields((current) => current.map((field, index) => index === selectedFieldIndex ? { ...field, id: plotId } : field));
    const note = {
      id: createMapId(),
      plotId,
      plotName: selectedField.name,
      category: noteDraft.category,
      text: noteDraft.text.trim(),
      date: noteDraft.date,
      reminderDate: noteDraft.reminderDate || '',
      image: noteDraft.image || '',
      savedAt: new Date().toISOString(),
    };
    setFieldNotes((current) => [note, ...current]);
    setNoteDraft({ category: 'General', text: '', date: new Date().toISOString().slice(0, 10), reminderDate: '', image: '' });
    setStatus('Field note saved on this device and available offline.');
  };

  const attachNotePhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Choose an image file for a field note.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setStatus('Choose an image smaller than 1 MB so it can be saved offline on this device.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setNoteDraft((current) => ({ ...current, image: String(reader.result || '') }));
    reader.onerror = () => setStatus('Could not read the selected image. Try another file.');
    reader.readAsDataURL(file);
  };

  const fetchNearbyFeatures = async () => {
    const center = weatherLocation || mapView.center;
    const latitude = Number(center[0].toFixed(2));
    const longitude = Number(center[1].toFixed(2));
    const bounds = [latitude - 0.025, longitude - 0.025, latitude + 0.025, longitude + 0.025];
    const query = `[out:json][timeout:18];(node["amenity"~"marketplace|clinic|hospital|school|extension_office|drinking_water"](${bounds.join(',')});way["amenity"~"marketplace|clinic|hospital|school|extension_office"](${bounds.join(',')});node["natural"="water"](${bounds.join(',')});way["waterway"](${bounds.join(',')});way["highway"~"primary|secondary|tertiary"](${bounds.join(',')}););out center tags 100;`;
    setIsLoadingNearby(true);
    setLandmarksStatus('Searching OpenStreetMap for nearby roads, services, and water features…');
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}` });
      if (!response.ok) throw new Error(`OpenStreetMap query failed (${response.status}).`);
      const result = await response.json();
      const features = (result.elements || []).map((element) => {
        const point = toValidCoordinates(element.lat ?? element.center?.lat, element.lon ?? element.center?.lon);
        return point ? { id: `${element.type}-${element.id}`, name: element.tags?.name || element.tags?.highway || element.tags?.waterway || element.tags?.amenity || 'Nearby map feature', point, tags: element.tags || {} } : null;
      }).filter(Boolean);
      setNearbyFeatures(features);
      setLandmarksStatus(features.length ? `${features.length} nearby OpenStreetMap features · retrieved ${new Date().toLocaleString()}.` : 'No mapped features found in this area. Check coverage or add farm landmarks manually.');
    } catch (error) {
      console.error('Nearby map features could not be loaded:', error);
      setLandmarksStatus(isOnline ? 'Nearby map features are unavailable right now. Use the Terrain basemap or add a landmark manually.' : 'Offline · nearby services need an internet connection.');
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const navigateToSelected = () => {
    if (!gpsLocation || !selectedNavigationTarget) {
      setStatus('Find your GPS location and select a plot or saved place to view its bearing.');
      return;
    }
    const direction = bearingBetweenPoints(gpsLocation, selectedNavigationTarget);
    setStatus(`${formatDistance(distanceBetweenPoints(gpsLocation, selectedNavigationTarget))} ${direction} in a straight line. This is not a road route.`);
    mapCommandsRef.current?.flyTo(selectedNavigationTarget);
  };

  const shareFarmSummary = () => {
    const chosenPlots = drawnFields.filter((field) => field.saved);
    if (!chosenPlots.length) {
      setStatus('Save at least one named plot before preparing a share file.');
      return;
    }
    const payload = {
      title: 'AGRI-NEST farm summary',
      audience: shareAudience,
      createdAt: new Date().toISOString(),
      sharingNotice: 'User-approved local export. No account access is granted by this file.',
      farmLocation: shareIncludeLocation ? profileLocation : null,
      plots: chosenPlots.map((field) => ({
        name: field.name,
        crop: field.crop || '',
        areaHectares: Number((polygonAreaSquareMeters(field.points) / 10000).toFixed(2)),
        areaAcres: Number((polygonAreaSquareMeters(field.points) / 4046.8564224).toFixed(2)),
        plantingDate: field.plantingDate || '',
        season: field.season || '',
        ...(shareIncludeBoundaries ? { boundary: field.points.map(([latitude, longitude]) => [longitude, latitude]) } : {}),
        ...(shareIncludeNotes ? { notes: fieldNotes.filter((note) => note.plotId === (field.id || field.name)).map(({ category, text, date, reminderDate }) => ({ category, text, date, reminderDate })) } : {}),
      })),
    };
    if (!shareConsent) {
      setStatus('Confirm that you have permission to share this farm summary before preparing the file.');
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = `agrinest-farm-summary-${shareAudience}.json`;
    download.click();
    URL.revokeObjectURL(url);
    setStatus(`Private summary file prepared for ${shareAudience}. Review the file and share it yourself; no access was granted in AGRI-NEST.`);
  };

  const startDrawing = (mode) => {
    if (gpsTraceWatchRef.current !== null) {
      globalThis.navigator?.geolocation?.clearWatch(gpsTraceWatchRef.current);
      gpsTraceWatchRef.current = null;
      setIsGpsTracing(false);
    }
    setDrawingMode(mode);
    setIsDrawing(true);
    setDraftPoints([]);
    setSelectedFieldIndex(null);
    setSelectedTrainingIndex(null);
    setSelectedDrawingIndex(null);
    const instructions = {
      field: 'Click the map to outline a field boundary.',
      training: `Click the map to outline a ${trainingLabels[trainingLabel].toLowerCase()}.`,
      landmark: `Click the map to place a ${landmarkTypes[landmarkType].label.toLowerCase()}.`,
      point: 'Click the map to place a point.',
      line: 'Click the map to add line vertices.',
      circle: 'Click the center, then a point on the edge of the circle.',
      distance: 'Click the map to add distance measurement points.',
      area: 'Click the map to outline an area to measure.',
    };
    setStatus(`${instructions[mode]} ${['point', 'circle'].includes(mode) ? '' : 'Finish when ready.'}`);
  };

  const startGpsTrace = () => {
    if (!globalThis.navigator?.geolocation) {
      setStatus('This device does not provide GPS location. Draw the plot boundary manually instead.');
      return;
    }
    if (gpsTraceWatchRef.current !== null) globalThis.navigator.geolocation.clearWatch(gpsTraceWatchRef.current);
    setDrawingMode('field');
    setIsDrawing(true);
    setIsGpsTracing(true);
    setDraftPoints([]);
    setSelectedFieldIndex(null);
    setSelectedTrainingIndex(null);
    setSelectedDrawingIndex(null);
    setStatus('Walk the plot edge with location permission enabled. GPS points are added when you move at least 5 m.');
    gpsTraceWatchRef.current = globalThis.navigator.geolocation.watchPosition((position) => {
      const point = [position.coords.latitude, position.coords.longitude];
      setGpsLocation(point);
      setGpsAccuracy(position.coords.accuracy);
      setDraftPoints((current) => current.length && distanceBetweenPoints(current[current.length - 1], point) < 5 ? current : [...current, point]);
    }, (error) => {
      console.error('GPS field trace failed:', error);
      if (gpsTraceWatchRef.current !== null) globalThis.navigator.geolocation.clearWatch(gpsTraceWatchRef.current);
      gpsTraceWatchRef.current = null;
      setIsGpsTracing(false);
      setStatus(`GPS trace stopped: ${error.message || 'location permission is unavailable'}. You can continue drawing manually.`);
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(savedLayerKey, JSON.stringify(drawnFields));
    } catch {
      setStatus('Could not save field drafts in this browser. Export the layer to keep a copy.');
    }
  }, [drawnFields]);

  useEffect(() => {
    try {
      window.localStorage.setItem(trainingLayerKey, JSON.stringify(trainingSamples));
    } catch {
      setStatus('Could not save training samples in this browser. Export the training data to keep a copy.');
    }
  }, [trainingSamples]);

  useEffect(() => {
    try {
      window.localStorage.setItem(mapDrawingsKey, JSON.stringify(mapDrawings));
    } catch {
      setStatus('Could not save map drawings in this browser. Export GeoJSON to keep a copy.');
    }
  }, [mapDrawings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(mapNotesKey, JSON.stringify(fieldNotes));
    } catch {
      setStatus('Could not save field notes on this device. Export the farm map to keep a copy.');
    }
  }, [fieldNotes]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(globalThis.navigator?.onLine !== false);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  useEffect(() => () => {
    if (gpsTraceWatchRef.current !== null) globalThis.navigator?.geolocation?.clearWatch(gpsTraceWatchRef.current);
  }, []);

  useEffect(() => {
    if (!weatherLocation) {
      setWeatherStatus('Add a farm GPS location or select a plot for local weather.');
      return undefined;
    }
    const latitude = Number(weatherLocation[0].toFixed(2));
    const longitude = Number(weatherLocation[1].toFixed(2));
    const roundedLocation = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    let active = true;
    const cached = readLocalJson(weatherCacheKey, null);
    if (cached?.location === roundedLocation) setWeatherSnapshot(cached);
    if (!globalThis.navigator?.onLine) {
      setWeatherStatus(cached?.location === roundedLocation ? 'Offline · showing saved forecast' : 'Offline · no saved forecast for this location');
      return undefined;
    }
    setWeatherStatus('Updating forecast…');
    const parameters = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
      daily: 'weather_code,precipitation_sum',
      timezone: 'auto',
      forecast_days: '5',
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Forecast request failed (${response.status}).`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const snapshot = {
          location: roundedLocation,
          updatedAt: new Date().toISOString(),
          source: 'Open-Meteo',
          temperature: data.current?.temperature_2m,
          humidity: data.current?.relative_humidity_2m,
          precipitation: data.current?.precipitation,
          wind: data.current?.wind_speed_10m,
          currentDate: data.current?.time || new Date().toISOString(),
          days: (data.daily?.time || []).map((date, index) => ({
            date,
            rainfall: data.daily?.precipitation_sum?.[index],
            code: data.daily?.weather_code?.[index],
          })),
        };
        setWeatherSnapshot(snapshot);
        try {
          window.localStorage.setItem(weatherCacheKey, JSON.stringify(snapshot));
          setWeatherStatus('Forecast updated');
        } catch (error) {
          console.error('Farm weather forecast could not be cached:', error);
          setWeatherStatus('Forecast updated · local cache unavailable');
        }
      })
      .catch((error) => {
        console.error('Farm weather forecast failed:', error);
        if (!active) return;
        setWeatherStatus(cached?.location === roundedLocation ? 'Forecast unavailable · showing saved forecast' : 'Forecast unavailable · check your connection');
      });
    return () => { active = false; };
  }, [weatherLocation?.[0], weatherLocation?.[1], isOnline, weatherRefreshToken]);

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
    const requiredPoints = { field: 3, training: 3, point: 1, landmark: 1, line: 2, circle: 2, distance: 2, area: 3 }[drawingMode] || 3;
    if (draftPoints.length < requiredPoints) {
      setStatus(`Add at least ${requiredPoints} map point${requiredPoints === 1 ? '' : 's'} to finish this drawing.`);
      return;
    }
    const boundarySource = isGpsTracing ? 'gps-trace' : 'map-click';
    if (gpsTraceWatchRef.current !== null) globalThis.navigator?.geolocation?.clearWatch(gpsTraceWatchRef.current);
    gpsTraceWatchRef.current = null;
    setIsGpsTracing(false);
    if (drawingMode === 'training') {
      const name = `Training sample ${trainingSamples.length + 1}`;
      setTrainingSamples((current) => [...current, { name, label: trainingLabel, points: draftPoints }]);
      setSelectedTrainingIndex(trainingSamples.length);
      setSelectedFieldIndex(null);
      setDraftPoints([]);
      setIsDrawing(false);
      setStatus(`${trainingLabels[trainingLabel]} sample saved on this device. Export the training GeoJSON to use it for model training.`);
      return;
    }
    if (drawingMode === 'point' || drawingMode === 'line' || drawingMode === 'circle' || drawingMode === 'distance' || drawingMode === 'area') {
      const circleRadius = drawingMode === 'circle' ? distanceBetweenPoints(draftPoints[0], draftPoints[1]) : 0;
      if (drawingMode === 'circle' && circleRadius <= 0) {
        setStatus('Choose a point away from the circle center to set its radius.');
        return;
      }
      if (drawingMode === 'landmark') {
        const landmark = { type: 'landmark', category: landmarkType, name: `${landmarkTypes[landmarkType].label} ${mapDrawings.length + 1}`, points: draftPoints };
        setMapDrawings((current) => [...current, landmark]);
        setSelectedDrawingIndex(mapDrawings.length);
        setSelectedFieldIndex(null);
        setSelectedTrainingIndex(null);
        setDraftPoints([]);
        setIsDrawing(false);
        setStatus(`${landmark.name} saved on this device. Add a description from its map details.`);
        return;
      }
      if (drawingMode === 'area' && polygonAreaSquareMeters(draftPoints) <= 0) {
        setStatus('Add map points that enclose an area before finishing the measurement.');
        return;
      }
      const drawing = drawingMode === 'circle'
        ? { type: 'circle', name: `Circle ${mapDrawings.length + 1}`, center: draftPoints[0], radiusMeters: circleRadius }
        : {
          type: drawingMode,
          name: `${{ point: 'Point', line: 'Line', distance: 'Distance', area: 'Area' }[drawingMode]} ${mapDrawings.length + 1}`,
          points: draftPoints,
        };
      setMapDrawings((current) => [...current, drawing]);
      setSelectedDrawingIndex(mapDrawings.length);
      setSelectedFieldIndex(null);
      setSelectedTrainingIndex(null);
      setDraftPoints([]);
      setIsDrawing(false);
      const detail = drawing.type === 'circle'
        ? `Radius ${formatDistance(drawing.radiusMeters)} · area ${formatAreaInBothUnits(Math.PI * drawing.radiusMeters ** 2)}`
        : drawing.type === 'distance'
          ? `Distance ${formatDistance(pathLengthMeters(drawing.points))}`
          : drawing.type === 'area'
            ? `Area ${formatAreaInBothUnits(polygonAreaSquareMeters(drawing.points))}`
            : `${drawing.type === 'point' ? 'Point' : 'Line'} saved on this device.`;
      setStatus(`${drawing.name} complete. ${detail}`);
      return;
    }
    const name = `Field draft ${drawnFields.length + 1}`;
    setDrawnFields((current) => [...current, { id: createMapId(), name, saved: false, boundarySource, gpsAccuracy: isGpsTracing ? gpsAccuracy : null, points: draftPoints }]);
    setSelectedFieldIndex(drawnFields.length);
    setSelectedTrainingIndex(null);
    setSelectedDrawingIndex(null);
    setDraftPoints([]);
    setIsDrawing(false);
    setStatus(isGpsTracing
      ? `${name} GPS trace saved with ${draftPoints.length} points. Approximate GPS accuracy ±${Math.round(gpsAccuracy || 0)} m; review and correct the boundary before use.`
      : `${name} saved on this device. Export GeoJSON to share it.`);
  };

  const cancelDrawing = () => {
    if (gpsTraceWatchRef.current !== null) globalThis.navigator?.geolocation?.clearWatch(gpsTraceWatchRef.current);
    gpsTraceWatchRef.current = null;
    setIsGpsTracing(false);
    setDraftPoints([]);
    setIsDrawing(false);
    setStatus(`${drawingMode === 'training' ? 'Training sample' : 'Field drawing'} cancelled.`);
  };

  const exportLayerData = () => {
    const blob = new Blob([JSON.stringify(coordinatesToGeoJson(drawnFields, includeFarmLocation ? profileLocation : null, mapDrawings), null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'agrinest-ramani-fields.geojson';
    download.click();
    URL.revokeObjectURL(url);
    setStatus('GeoJSON layer exported.');
  };

  const exportTrainingData = () => {
    if (!trainingSamples.length) {
      setStatus('Add at least one labeled training sample before exporting.');
      return;
    }
    const blob = new Blob([JSON.stringify(trainingSamplesToGeoJson(trainingSamples), null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'agrinest-ramani-training-samples.geojson';
    download.click();
    URL.revokeObjectURL(url);
    setStatus(`${trainingSamples.length} labeled training sample${trainingSamples.length === 1 ? '' : 's'} exported. This dataset does not train a model by itself.`);
  };

  const importGeoJson = async (file) => {
    if (!file) return;
    try {
      const document = JSON.parse(await file.text());
      if (document.type !== 'FeatureCollection' || !Array.isArray(document.features)) throw new Error('Choose a valid GeoJSON FeatureCollection.');
      const importedFields = [];
      const importedDrawings = [];
      document.features.forEach((feature) => {
        const coordinates = feature?.geometry?.coordinates;
        const properties = feature?.properties || {};
        if (feature?.geometry?.type === 'Polygon' && Array.isArray(coordinates?.[0])) {
          const points = coordinates[0].slice(0, -1).map(([longitude, latitude]) => [latitude, longitude]);
          if (!hasValidPolygonPoints(points) || properties.source === 'ramani-map-annotation') return;
          if (properties.shape === 'area' || properties.shape === 'circle') {
            importedDrawings.push({ id: createMapId(), type: 'area', name: String(properties.name || `Imported area ${importedDrawings.length + 1}`), points });
          } else {
            importedFields.push({ id: createMapId(), name: String(properties.name || `Imported plot ${importedFields.length + 1}`), crop: String(properties.crop || ''), plantingDate: String(properties.plantingDate || ''), season: String(properties.season || ''), points, saved: Boolean(properties.saved || properties.crop || properties.season || properties.plantingDate), imported: true });
          }
        } else if (feature?.geometry?.type === 'Point' && Array.isArray(coordinates)) {
          const point = toValidCoordinates(coordinates[1], coordinates[0]);
          if (point && properties.source !== 'farmer-profile') importedDrawings.push({ id: createMapId(), type: properties.shape === 'landmark' && landmarkTypes[properties.category] ? 'landmark' : 'point', category: properties.category, name: String(properties.name || `Imported place ${importedDrawings.length + 1}`), description: String(properties.description || ''), points: [point] });
        } else if (feature?.geometry?.type === 'LineString' && Array.isArray(coordinates)) {
          const points = coordinates.map(([longitude, latitude]) => [latitude, longitude]);
          if (hasValidMapPoints(points, 2)) importedDrawings.push({ id: createMapId(), type: properties.shape === 'distance' ? 'distance' : 'line', name: String(properties.name || `Imported line ${importedDrawings.length + 1}`), points });
        }
      });
      if (!importedFields.length && !importedDrawings.length) throw new Error('No valid plot polygons, points, or lines were found in this GeoJSON.');
      setDrawnFields((current) => [...current, ...importedFields]);
      setMapDrawings((current) => [...current, ...importedDrawings]);
      setStatus(`Imported ${importedFields.length} plot${importedFields.length === 1 ? '' : 's'} and ${importedDrawings.length} map feature${importedDrawings.length === 1 ? '' : 's'} from GeoJSON. Review imported plot details before sharing.`);
    } catch (error) {
      console.error('Farm GeoJSON import failed:', error);
      setStatus(`GeoJSON import failed: ${error.message}`);
    }
  };

  const sharePrintableSummary = () => {
    window.print();
  };

  const draftCircleRadius = drawingMode === 'circle' && draftPoints.length >= 2 ? distanceBetweenPoints(draftPoints[0], draftPoints[1]) : 0;
  const draftMeasurement = drawingMode === 'distance' && draftPoints.length >= 2
    ? formatDistance(pathLengthMeters(draftPoints))
    : drawingMode === 'area' && draftPoints.length >= 3
      ? formatAreaInBothUnits(polygonAreaSquareMeters(draftPoints))
      : '';
  const tileSource = tileSources[selectedLayer];

  return (
    <section className={`ramani-page${compact ? ' ramani-compact' : ''}`} aria-label="Ramani GIS map">
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
        {tileSource && <TileLayer key={selectedLayer} url={tileSource.url} attribution={tileSource.attribution} maxZoom={19} />}
        {selectedLayer === 'hybrid' && <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Labels &copy; Esri" maxZoom={19} />}
        <MapInteractions
          drawing={isDrawing && !isGpsTracing}
          enabled={!isThreeDimensional}
          onAddPoint={(point) => setDraftPoints((current) => [...current, point])}
          onGpsLocation={(point, accuracy) => { setGpsLocation(point); setGpsAccuracy(accuracy); setStatus(`GPS location found · accuracy about ${Math.round(accuracy)} m.`); }}
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
        {gpsLocation && <>
          {gpsAccuracy > 0 && <Circle center={gpsLocation} radius={gpsAccuracy} pathOptions={{ color: '#17885a', weight: 1, fillColor: '#17885a', fillOpacity: 0.08 }} />}
          <CircleMarker center={gpsLocation} radius={8} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#17885a', fillOpacity: 1 }}><Popup>Current GPS position · approx. ±{Math.round(gpsAccuracy || 0)} m</Popup></CircleMarker>
        </>}
        {showFieldBoundaries && drawnFields.map((field, index) => (
          <Polygon
            key={`${field.name}-${index}`}
            positions={boundaryEditIndex === index ? boundaryEditPoints : field.points}
            pathOptions={{ color: selectedFieldIndex === index ? '#f1c75b' : field.saved ? '#176c4c' : '#54d69a', weight: selectedFieldIndex === index ? 3 : 2, dashArray: field.saved ? undefined : '6 5', fillColor: '#48ba7e', fillOpacity: 0.2 }}
            eventHandlers={{ click: () => { setSelectedFieldIndex(index); setSelectedTrainingIndex(null); setSelectedDrawingIndex(null); } }}
          >
            <Popup>{field.name}<br />{field.saved ? `Saved plot · ${field.crop || 'crop not set'}` : 'Unsaved plot draft'} · stored on this device</Popup>
          </Polygon>
        ))}
        {boundaryEditIndex !== null && boundaryEditPoints?.map((point, pointIndex) => (
          <Marker
            key={`boundary-handle-${pointIndex}`}
            position={point}
            icon={L.divIcon({ className: 'ramani-boundary-handle', html: '', iconSize: [18, 18], iconAnchor: [9, 9] })}
            draggable
            eventHandlers={{
              dragend(event) {
                const position = event.target.getLatLng();
                setBoundaryEditPoints((current) => current.map((item, index) => index === pointIndex ? [position.lat, position.lng] : item));
              },
            }}
          />
        ))}
        {showTrainingSamples && trainingSamples.map((sample, index) => (
          <Polygon
            key={`${sample.name}-${index}`}
            positions={sample.points}
            pathOptions={{
              color: selectedTrainingIndex === index ? '#f1c75b' : sample.label === 'farm-field' ? '#258e57' : '#c65358',
              weight: selectedTrainingIndex === index ? 3 : 2,
              dashArray: sample.label === 'non-farm' ? '6 4' : undefined,
              fillColor: sample.label === 'farm-field' ? '#48ba7e' : '#e16b71',
              fillOpacity: 0.24,
            }}
            eventHandlers={{ click: () => { setSelectedTrainingIndex(index); setSelectedFieldIndex(null); setSelectedDrawingIndex(null); } }}
          >
            <Popup>{sample.name}<br />Training label: {trainingLabels[sample.label]}</Popup>
          </Polygon>
        ))}
        {showLandmarks && mapDrawings.filter((drawing) => drawing.type === 'landmark').map((landmark) => {
          const meta = landmarkTypes[landmark.category] || landmarkTypes.water;
          return <CircleMarker key={landmark.id || landmark.name} center={landmark.points[0]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: meta.color, fillOpacity: 1 }} eventHandlers={{ click: () => { const index = mapDrawings.indexOf(landmark); setSelectedDrawingIndex(index); setSelectedFieldIndex(null); setSelectedTrainingIndex(null); } }}><Popup><strong>{landmark.name}</strong><br />{meta.label}{landmark.description ? <><br />{landmark.description}</> : null}</Popup></CircleMarker>;
        })}
        {nearbyFeatures.map((feature) => <CircleMarker key={feature.id} center={feature.point} radius={5} pathOptions={{ color: '#fff', weight: 1, fillColor: '#39739a', fillOpacity: 0.95 }}><Popup>{feature.name}<br />OpenStreetMap · nearby feature</Popup></CircleMarker>)}
        {showMapDrawings && mapDrawings.map((drawing, index) => {
          if (drawing.type === 'landmark') return null;
          const eventHandlers = { click: () => { setSelectedDrawingIndex(index); setSelectedFieldIndex(null); setSelectedTrainingIndex(null); } };
          const selected = selectedDrawingIndex === index;
          if (drawing.type === 'point') {
            return <CircleMarker key={`${drawing.name}-${index}`} center={drawing.points[0]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#2372bf', fillOpacity: 1 }} eventHandlers={eventHandlers}><Popup>{drawing.name}</Popup></CircleMarker>;
          }
          if (drawing.type === 'circle') {
            return <Circle key={`${drawing.name}-${index}`} center={drawing.center} radius={drawing.radiusMeters} pathOptions={{ color: selected ? '#f1c75b' : '#2372bf', weight: selected ? 3 : 2, fillColor: '#478fd1', fillOpacity: 0.16 }} eventHandlers={eventHandlers}><Popup>{drawing.name}<br />Radius {formatDistance(drawing.radiusMeters)}</Popup></Circle>;
          }
          if (drawing.type === 'area') {
            return <Polygon key={`${drawing.name}-${index}`} positions={drawing.points} pathOptions={{ color: selected ? '#f1c75b' : '#8d64c8', weight: selected ? 3 : 2, fillColor: '#8d64c8', fillOpacity: 0.16 }} eventHandlers={eventHandlers}><Popup>{drawing.name}<br />Area {formatAreaInBothUnits(polygonAreaSquareMeters(drawing.points))}</Popup></Polygon>;
          }
          return <Polyline key={`${drawing.name}-${index}`} positions={drawing.points} pathOptions={{ color: selected ? '#f1c75b' : drawing.type === 'distance' ? '#d87527' : '#2372bf', weight: selected ? 5 : 3, dashArray: drawing.type === 'distance' ? '7 6' : undefined }} eventHandlers={eventHandlers}><Popup>{drawing.name}<br />{drawing.type === 'distance' ? formatDistance(pathLengthMeters(drawing.points)) : 'Line drawing'}</Popup></Polyline>;
        })}
        {isDrawing && draftPoints.length > 0 && (
          drawingMode === 'point' || drawingMode === 'landmark'
            ? <CircleMarker center={draftPoints[0]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#f1c75b', fillOpacity: 1 }} />
            : drawingMode === 'circle' && draftPoints.length > 1
              ? <Circle center={draftPoints[0]} radius={draftCircleRadius} pathOptions={{ color: '#f1c75b', dashArray: '6 6', fillColor: '#f1c75b', fillOpacity: 0.14 }} />
              : drawingMode === 'line' || drawingMode === 'distance'
                ? <Polyline positions={draftPoints} pathOptions={{ color: '#f1c75b', dashArray: '6 6', weight: 3 }} />
                : <Polygon positions={draftPoints} pathOptions={{ color: '#f1c75b', dashArray: '6 6', fillColor: '#f1c75b', fillOpacity: 0.16 }} />
        )}
        <RamaniLeafletControl>
          <div className="ramani-control-tools">
            <div className="ramani-tool-group ramani-drawing-tools" aria-label="Drawing and measurement tools">
              {[
                ['field', 'Draw field boundary', 'pentagon'],
                ['point', 'Place point', 'location_on'],
                ['line', 'Draw line', 'timeline'],
                ['circle', 'Draw circle', 'radio_button_unchecked'],
                ['distance', 'Measure distance', 'straighten'],
                ['area', 'Measure area', 'square_foot'],
                ['landmark', 'Add farm landmark', 'add_location_alt'],
                ['gps-trace', 'Trace plot boundary with GPS', 'my_location'],
              ].map(([mode, label, icon]) => (
                <button type="button" key={mode} title={label} aria-label={label} className={mode === 'gps-trace' ? isGpsTracing ? 'active' : '' : isDrawing && drawingMode === mode ? 'active' : ''} onClick={() => mode === 'gps-trace' ? startGpsTrace() : startDrawing(mode)}>
                  <span className="material-symbols-outlined">{icon}</span>
                </button>
              ))}
              <button type="button" title="Show my current GPS location" aria-label="Show my current GPS location" onClick={() => mapCommandsRef.current?.locate()}><span className="material-symbols-outlined">gps_fixed</span></button>
              {isDrawing && <div className="ramani-draw-actions"><button type="button" onClick={finishDrawing} disabled={draftPoints.length < ({ field: 3, training: 3, point: 1, landmark: 1, line: 2, circle: 2, distance: 2, area: 3 }[drawingMode] || 3)}>Finish {drawingMode === 'training' ? 'sample' : drawingMode === 'field' ? 'field' : 'drawing'}</button><button type="button" onClick={cancelDrawing}>Cancel</button><span>{draftPoints.length} points{draftMeasurement ? ` · ${draftMeasurement}` : drawingMode === 'circle' && draftCircleRadius ? ` · radius ${formatDistance(draftCircleRadius)}` : ''}</span></div>}
            </div>
            {isDrawing && drawingMode === 'landmark' && <div className="ramani-tool-group ramani-landmark-picker"><label htmlFor="ramani-landmark-type">Place</label><select id="ramani-landmark-type" value={landmarkType} onChange={(event) => setLandmarkType(event.target.value)}>{Object.entries(landmarkTypes).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>}
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
              <button type="button" title="Use a blank basemap for offline field work" aria-label="Offline basemap" className={selectedLayer === 'offline' ? 'active' : ''} onClick={() => selectMapLayer('offline')}>Offline</button>
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
        <div className="ramani-panel-heading"><div><span>GIS DASHBOARD</span><h2>Farm map</h2></div><span className={isOnline ? 'ramani-data-badge' : 'ramani-data-badge muted'}>{isOnline ? 'ONLINE' : 'OFFLINE'}</span></div>
        <label className="ramani-mobile-search"><span className="material-symbols-outlined">search</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search coordinates or place" aria-label="Search map coordinates or locations" /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot profile-dot" />Saved farm location</span><input type="checkbox" checked={showFarmLocation && Boolean(profileLocation)} onChange={(event) => setShowFarmLocation(event.target.checked)} disabled={!profileLocation} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot field-dot" />Farm plots ({drawnFields.length})</span><input type="checkbox" checked={showFieldBoundaries} onChange={(event) => setShowFieldBoundaries(event.target.checked)} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot training-dot" />Training samples ({trainingSamples.length})</span><input type="checkbox" checked={showTrainingSamples} onChange={(event) => setShowTrainingSamples(event.target.checked)} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot drawing-dot" />Drawings &amp; measurements ({mapDrawings.length})</span><input type="checkbox" checked={showMapDrawings} onChange={(event) => setShowMapDrawings(event.target.checked)} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot landmark-dot" />Farm landmarks ({mapDrawings.filter((item) => item.type === 'landmark').length})</span><input type="checkbox" checked={showLandmarks} onChange={(event) => setShowLandmarks(event.target.checked)} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot weather-dot" />Farm weather</span><input type="checkbox" checked={showWeather} onChange={(event) => setShowWeather(event.target.checked)} /></label>
        <label className="ramani-layer-row"><span><i className="ramani-layer-dot map-dot" />Nearby roads &amp; services</span><input type="checkbox" checked={nearbyFeatures.length > 0} onChange={(event) => { if (!event.target.checked) setNearbyFeatures([]); else fetchNearbyFeatures(); }} /></label>
        <button type="button" className="ramani-layer-action" onClick={fetchNearbyFeatures} disabled={isLoadingNearby || !isOnline}>{isLoadingNearby ? 'Searching nearby…' : 'Find nearby roads & services'}</button>
        <div className="ramani-layer-note ramani-privacy-note">Nearby search sends an approximate map area to OpenStreetMap. Roads are also available in the Roads basemap.</div>
        {landmarksStatus && <div className="ramani-layer-note" role="status">{landmarksStatus}</div>}
        <div className="ramani-offline-note"><span className="material-symbols-outlined">{isOnline ? 'cloud_done' : 'cloud_off'}</span><span>{isOnline ? 'Farm records save on this device; no cloud sync is connected. Live weather uses an approximate location; map providers can see the visible map area.' : 'Offline · farm records remain on this device. Map imagery and live weather may be unavailable.'}</span></div>
        <label className="ramani-consent-option"><input type="checkbox" checked={includeFarmLocation} onChange={(event) => setIncludeFarmLocation(event.target.checked)} />Include saved farm GPS in GeoJSON export</label>
        <button type="button" className="ramani-export-button" onClick={exportLayerData}><span className="material-symbols-outlined">ios_share</span>Export GeoJSON</button>
        <label className="ramani-import-button"><span className="material-symbols-outlined">file_open</span>Import GeoJSON<input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => { importGeoJson(event.target.files?.[0]); event.target.value = ''; }} /></label>
        <button type="button" className="ramani-layer-action" onClick={sharePrintableSummary}>Print farm summary</button>
        <div className="ramani-training-tools">
          <strong>Share farm summary</strong>
          <p>Prepare a local file for a person you choose. This does not grant account access or upload farm data.</p>
          <label htmlFor="ramani-share-audience">Intended recipient</label>
          <select id="ramani-share-audience" value={shareAudience} onChange={(event) => setShareAudience(event.target.value)}>
            <option value="cooperative">Co-operative</option><option value="extension">Extension officer</option><option value="lender">Lender</option>
          </select>
          <label className="ramani-consent-option"><input type="checkbox" checked={shareIncludeNotes} onChange={(event) => setShareIncludeNotes(event.target.checked)} />Include plot notes (may contain sensitive details)</label>
          <label className="ramani-consent-option"><input type="checkbox" checked={shareIncludeLocation} onChange={(event) => setShareIncludeLocation(event.target.checked)} />Include saved farm GPS coordinates</label>
          <label className="ramani-consent-option"><input type="checkbox" checked={shareIncludeBoundaries} onChange={(event) => setShareIncludeBoundaries(event.target.checked)} />Include exact plot boundaries</label>
          <label className="ramani-consent-option"><input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} />I have permission to share this information with the selected recipient</label>
          <button type="button" className="ramani-training-start" onClick={shareFarmSummary} disabled={!shareConsent}>Prepare approved share file</button>
        </div>
        <div className="ramani-training-tools">
          <strong>Train field patterns</strong>
          <p>Label farm fields and nearby non-farm areas. Samples stay on this device; this collects data but does not detect or train automatically.</p>
          <label htmlFor="ramani-training-label">Sample label</label>
          <select id="ramani-training-label" value={trainingLabel} onChange={(event) => setTrainingLabel(event.target.value)}>
            {Object.entries(trainingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" className="ramani-training-start" onClick={() => {
            startDrawing('training');
          }}>Draw training sample</button>
          <button type="button" className="ramani-training-export" onClick={exportTrainingData} disabled={!trainingSamples.length}>Export training GeoJSON ({trainingSamples.length})</button>
        </div>
      </div>

      <div className="ramani-overlay ramani-insight-panel">
        <div className="ramani-insight-heading"><div><span>{isOnline ? 'Saved on this device' : 'Offline · local records'}</span><h2>{selectedField?.name || selectedDrawing?.name || 'Farm details'}</h2></div><span className={gpsAccuracy ? 'ramani-data-badge' : profileLocation ? 'ramani-data-badge' : 'ramani-data-badge muted'}>{gpsAccuracy ? `GPS ±${Math.round(gpsAccuracy)}m` : profileLocation ? 'PROFILE GPS' : 'NO GPS'}</span></div>
        {selectedField ? (
          <div className="ramani-field-stats">
            <div><span>Plot area</span><strong>{formatAreaInBothUnits(polygonAreaSquareMeters(boundaryEditIndex === selectedFieldIndex ? boundaryEditPoints : selectedField.points))}</strong></div>
            <div><span>Record status</span><strong>{selectedField.saved ? 'Named plot · local' : 'Unsaved boundary draft'}</strong></div>
            <div><span>Boundary vertices</span><strong>{selectedField.points.length}</strong></div>
            <div><span>Boundary capture</span><strong>{selectedField.boundarySource === 'gps-trace' ? `GPS trace · approx. ±${Math.round(selectedField.gpsAccuracy || 0)} m` : selectedField.boundarySource === 'manual-correction' ? 'GPS trace · manually corrected' : 'Manually mapped'}</strong></div>
            <button type="button" className="ramani-layer-action" onClick={() => mapCommandsRef.current?.flyTo(polygonCenter(selectedField.points))}>Find this plot</button>
            {boundaryEditIndex === selectedFieldIndex ? (
              <>
                <p>Drag the boundary handles to correct the plot outline.</p>
                <button type="button" onClick={() => { setDrawnFields((current) => current.map((field, index) => index === selectedFieldIndex ? { ...field, points: boundaryEditPoints, saved: false, boundarySource: 'manual-correction', updatedAt: new Date().toISOString() } : field)); setBoundaryEditIndex(null); setBoundaryEditPoints(null); setStatus('Boundary correction saved as a local draft. Review and save plot details again.'); }}>Save corrected boundary</button>
                <button type="button" onClick={() => { setBoundaryEditIndex(null); setBoundaryEditPoints(null); }}>Cancel boundary edit</button>
              </>
            ) : <button type="button" onClick={() => { setBoundaryEditIndex(selectedFieldIndex); setBoundaryEditPoints(selectedField.points.map((point) => [...point])); }}>Correct boundary</button>}
            <form className="ramani-plot-form" onSubmit={savePlotDetails}>
              <label>Plot name<input required value={plotDetails.name} onChange={(event) => setPlotDetails((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. North maize plot" /></label>
              <label>Crop<input value={plotDetails.crop} onChange={(event) => setPlotDetails((current) => ({ ...current, crop: event.target.value }))} placeholder="Maize, beans…" /></label>
              <label>Planting date<input type="date" value={plotDetails.plantingDate} onChange={(event) => setPlotDetails((current) => ({ ...current, plantingDate: event.target.value }))} /></label>
              <label>Season<input value={plotDetails.season} onChange={(event) => setPlotDetails((current) => ({ ...current, season: event.target.value }))} placeholder="e.g. 2026 short rains" /></label>
              <button type="submit">{selectedField.saved ? 'Update plot record' : 'Save as named plot'}</button>
            </form>
            <form className="ramani-note-form" onSubmit={saveFieldNote}>
              <strong>Field notes · {selectedFieldNotes.length}</strong>
              <label>Record type<select value={noteDraft.category} onChange={(event) => setNoteDraft((current) => ({ ...current, category: event.target.value }))}>{noteTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Date<input type="date" value={noteDraft.date} onChange={(event) => setNoteDraft((current) => ({ ...current, date: event.target.value }))} required /></label>
              <label>Reminder date (optional)<input type="date" min={noteDraft.date} value={noteDraft.reminderDate} onChange={(event) => setNoteDraft((current) => ({ ...current, reminderDate: event.target.value }))} /></label>
              <label>Note<textarea value={noteDraft.text} onChange={(event) => setNoteDraft((current) => ({ ...current, text: event.target.value }))} placeholder="What happened in this plot?" rows="2" required /></label>
              <label>Photo (optional, max 1 MB)<input type="file" accept="image/*" capture="environment" onChange={(event) => { attachNotePhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
              {noteDraft.image && <img className="ramani-note-preview" src={noteDraft.image} alt="Selected field note" />}
              <button type="submit">Save note on device</button>
              {selectedReminders.map((note) => <div className="ramani-reminder" key={`reminder-${note.id}`}><strong>Reminder · {note.reminderDate}</strong><span>{note.category}: {note.text}</span></div>)}
              {selectedFieldNotes.slice(0, 5).map((note) => <article className="ramani-note-entry" key={note.id}><strong>{note.category} · {note.date}</strong><p>{note.text}</p>{note.image && <img src={note.image} alt="" />}<button type="button" onClick={() => setFieldNotes((current) => current.filter((item) => item.id !== note.id))}>Delete note</button></article>)}
            </form>
            <button type="button" className="ramani-field-delete" onClick={deleteSelectedPlot}>Delete plot and its notes</button>
          </div>
        ) : selectedTrainingSample ? (
          <div className="ramani-field-stats"><div><span>Training label</span><strong>{trainingLabels[selectedTrainingSample.label]}</strong></div><div><span>Boundary vertices</span><strong>{selectedTrainingSample.points.length}</strong></div><p>Saved locally as a labeled example for a future detection model.</p><button type="button" onClick={() => { setTrainingSamples((current) => current.filter((_, index) => index !== selectedTrainingIndex)); setSelectedTrainingIndex(null); }}>Delete selected sample</button></div>
        ) : selectedDrawing ? (
          <div className="ramani-field-stats"><div><span>Drawing tool</span><strong>{selectedDrawing.type === 'landmark' ? landmarkTypes[selectedDrawing.category]?.label || 'Farm landmark' : ({ point: 'Point', line: 'Line', circle: 'Circle', distance: 'Distance', area: 'Area' })[selectedDrawing.type]}</strong></div><div><span>Measurement</span><strong>{selectedDrawing.type === 'circle' ? `Radius ${formatDistance(selectedDrawing.radiusMeters)}` : selectedDrawing.type === 'area' ? formatAreaInBothUnits(polygonAreaSquareMeters(selectedDrawing.points)) : selectedDrawing.type === 'point' || selectedDrawing.type === 'landmark' ? 'Map point' : formatDistance(pathLengthMeters(selectedDrawing.points))}</strong></div>{selectedDrawing.type === 'circle' && <div><span>Circle area</span><strong>{formatAreaInBothUnits(Math.PI * selectedDrawing.radiusMeters ** 2)}</strong></div>}<p>Saved on this device. Units are estimated from map coordinates.</p><button type="button" onClick={() => { setMapDrawings((current) => current.filter((_, index) => index !== selectedDrawingIndex)); setSelectedDrawingIndex(null); }}>Delete drawing</button></div>
        ) : profileLocation ? (
          <div className="ramani-field-stats"><div><span>Registered location</span><strong>{profile.location || profile.region || 'Farm location'}</strong></div><div><span>Coordinates</span><strong>{profileLocation[0].toFixed(5)}, {profileLocation[1].toFixed(5)}</strong></div><p>GPS point saved in your AGRI-NEST profile.</p></div>
        ) : (
          <div className="ramani-no-data"><span className="material-symbols-outlined">location_searching</span><p>No farm GPS is saved in this profile yet.</p><button type="button" onClick={() => { setStatus('Save farm coordinates in Profile → Edit address and GPS details.'); }}>View location setup</button></div>
        )}
        {showWeather && <div className="ramani-weather-card">
          <div className="ramani-weather-heading"><strong>Farm weather</strong><button type="button" aria-label="Refresh farm weather" title={weatherStatus} onClick={() => { if (isOnline) setWeatherRefreshToken((current) => current + 1); else setWeatherStatus('Offline · showing saved weather only.'); }}>{weatherStatus}</button></div>
          {weatherSnapshot && weatherLocation && weatherSnapshot.location === weatherLocation.map((coordinate) => coordinate.toFixed(2)).join(',') ? (
            <>
              <div className="ramani-weather-current"><strong>{Number.isFinite(weatherSnapshot.temperature) ? `${Math.round(weatherSnapshot.temperature)}°C` : '—'}</strong><span>Rain {Number.isFinite(weatherSnapshot.precipitation) ? `${weatherSnapshot.precipitation} mm` : '—'} · wind {Number.isFinite(weatherSnapshot.wind) ? `${Math.round(weatherSnapshot.wind)} km/h` : '—'} · humidity {Number.isFinite(weatherSnapshot.humidity) ? `${Math.round(weatherSnapshot.humidity)}%` : '—'}</span></div>
              <div className="ramani-weather-days">{weatherSnapshot.days?.slice(0, 4).map((day) => <span key={day.date}><strong>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</strong>{Number.isFinite(day.rainfall) ? `${day.rainfall} mm rain` : 'No rain data'}</span>)}</div>
              <small>Open-Meteo · forecast for {weatherSnapshot.location} · issued {new Date(weatherSnapshot.currentDate).toLocaleString()} · cached {new Date(weatherSnapshot.updatedAt).toLocaleString()}</small>
            </>
          ) : <p>{weatherStatus}</p>}
        </div>}
        {gpsLocation && <div className="ramani-gps-card"><strong>GPS fix</strong><span>Approx. accuracy ±{Math.round(gpsAccuracy || 0)} m · {gpsLocation[0].toFixed(5)}, {gpsLocation[1].toFixed(5)}</span></div>}
        {selectedNavigationTarget && <button type="button" className="ramani-layer-action" onClick={navigateToSelected}>Show straight-line distance from GPS</button>}
        {directionsUrl && <a className="ramani-layer-action" href={directionsUrl} target="_blank" rel="noopener noreferrer">Open road route in OpenStreetMap · shares GPS</a>}
        {selectedDrawing?.type === 'landmark' && <div className="ramani-field-stats">
          <div><span>Landmark</span><strong>{landmarkTypes[selectedDrawing.category]?.label || 'Farm place'}</strong></div>
          <label className="ramani-plot-form">Description<input value={selectedDrawing.description || ''} onChange={(event) => setMapDrawings((current) => current.map((item, index) => index === selectedDrawingIndex ? { ...item, description: event.target.value } : item))} placeholder="Optional detail" /></label>
          <button type="button" onClick={() => { setMapDrawings((current) => current.filter((_, index) => index !== selectedDrawingIndex)); setSelectedDrawingIndex(null); }}>Delete place</button>
        </div>}
      </div>

      <div className="ramani-print-summary">
        <h1>Farm summary</h1>
        <p>{profile.farm || 'Farm'} · {profile.region || profile.location || 'Tanzania'} · Printed {new Date().toLocaleDateString()}</p>
        <h2>Plots</h2>
        {drawnFields.filter((field) => field.saved).length ? drawnFields.filter((field) => field.saved).map((field) => <article key={field.id || field.name}><h3>{field.name}</h3><p>Crop: {field.crop || 'Not recorded'} · Area: {formatAreaInBothUnits(polygonAreaSquareMeters(field.points))} · Season: {field.season || 'Not recorded'} · Planting: {field.plantingDate || 'Not recorded'}</p><ul>{fieldNotes.filter((note) => note.plotId === (field.id || field.name)).map((note) => <li key={note.id}>{note.date} · {note.category}: {note.text}{note.reminderDate ? ` (Reminder ${note.reminderDate})` : ''}</li>)}</ul></article>) : <p>No named plots have been saved yet.</p>}
        <p>Farm records are stored locally on this device. Exact farm GPS is omitted from this print summary.</p>
      </div>

      {status && <div className="ramani-status" role="status"><span>{status}</span><button type="button" aria-label="Dismiss map message" onClick={() => setStatus('')}><span className="material-symbols-outlined">close</span></button></div>}
    </section>
  );
}
