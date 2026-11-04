import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TANZANIA_CENTER = [-6.2, 35.5];

function FitRoute({ pickup, destination }) {
  const map = useMap();

  useEffect(() => {
    if (pickup && destination) {
      map.fitBounds([pickup, destination], { padding: [36, 36], maxZoom: 12 });
    } else if (pickup || destination) {
      map.setView(pickup || destination, 10);
    } else {
      map.setView(TANZANIA_CENTER, 6);
    }
  }, [destination, map, pickup]);

  return null;
}

export default function TransportRouteMap({ pickup, destination }) {
  return (
    <MapContainer
      center={TANZANIA_CENTER}
      zoom={6}
      scrollWheelZoom
      touchZoom
      className="transport-leaflet-map"
      aria-label="Map showing geocoded transport pickup and destination"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
        maxZoom={19}
      />
      <FitRoute pickup={pickup} destination={destination} />
      {pickup && <CircleMarker center={pickup} radius={8} pathOptions={{ color: '#126b49', fillColor: '#a1f0c5', fillOpacity: 1 }}>
        <Popup>Pickup location</Popup>
      </CircleMarker>}
      {destination && <CircleMarker center={destination} radius={8} pathOptions={{ color: '#b88a1e', fillColor: '#f5d875', fillOpacity: 1 }}>
        <Popup>Destination</Popup>
      </CircleMarker>}
      {pickup && destination && <Polyline positions={[pickup, destination]} pathOptions={{ color: '#126b49', dashArray: '7 8', weight: 3 }} />}
    </MapContainer>
  );
}
