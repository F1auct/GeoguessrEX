import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import L from "leaflet";

const guessIcon = L.divIcon({
  className: "pin-shell",
  html: '<div class="pin pin-guess"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const answerIcon = L.divIcon({
  className: "pin-shell",
  html: '<div class="pin pin-answer"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function ResultMap({ result }) {
  return (
    <section className="card map-card result-map-card">
      <div className="eyebrow">Result Map</div>
      <MapContainer center={[20, 0]} zoom={2} className="map-view">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[result.guess.lat, result.guess.lng]} icon={guessIcon} />
        <Marker position={[result.answer.lat, result.answer.lng]} icon={answerIcon} />
        <Polyline
          positions={[
            [result.guess.lat, result.guess.lng],
            [result.answer.lat, result.answer.lng]
          ]}
          pathOptions={{ color: "#f25c54", weight: 3, dashArray: "10 8" }}
        />
      </MapContainer>
    </section>
  );
}
