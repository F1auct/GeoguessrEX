import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

const guessIcon = L.divIcon({
  className: "pin-shell",
  html: '<div class="pin pin-guess"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function ClickCapture({ value, onChange }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      });
    }
  });

  return value ? <Marker position={[value.lat, value.lng]} icon={guessIcon} /> : null;
}

export default function GuessMap({ value, onChange }) {
  return (
    <section className="card map-card mini-map-card">
      <MapContainer center={[20, 0]} zoom={2} className="map-view">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture value={value} onChange={onChange} />
      </MapContainer>
    </section>
  );
}
