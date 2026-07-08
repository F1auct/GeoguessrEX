import { useEffect, useRef, useState } from "react";
import { loadAmap } from "../services/amapLoader.js";
import { wgs84ToGcj02 } from "../services/coordTransform.js";

export default function AmapResultMap({ result, apiKey }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [loadError, setLoadError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadAmap(apiKey)
      .then((AMap) => {
        if (!mounted || mapRef.current || !containerRef.current) {
          return;
        }

        mapRef.current = new AMap.Map(containerRef.current, {
          viewMode: "2D",
          zoom: 1,
          center: [0, 20],
          mapStyle: "amap://styles/whitesmoke"
        });
        setMapReady(true);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setLoadError(error.message);
      });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      overlaysRef.current = [];
      setMapReady(false);
    };
  }, [apiKey]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.AMap || !result) {
      return;
    }

    const guessGcj = wgs84ToGcj02(result.guess.lng, result.guess.lat);
    const answerGcj = wgs84ToGcj02(result.answer.lng, result.answer.lat);

    if (overlaysRef.current.length) {
      mapRef.current.remove(overlaysRef.current);
      overlaysRef.current = [];
    }

    const guessMarker = new window.AMap.CircleMarker({
      center: [guessGcj.lng, guessGcj.lat],
      radius: 9,
      strokeColor: "#fff8ef",
      strokeWeight: 3,
      fillColor: "#244c47",
      fillOpacity: 1,
      zIndex: 200
    });

    const answerMarker = new window.AMap.CircleMarker({
      center: [answerGcj.lng, answerGcj.lat],
      radius: 9,
      strokeColor: "#fff8ef",
      strokeWeight: 3,
      fillColor: "#b44d28",
      fillOpacity: 1,
      zIndex: 200
    });

    const polyline = new window.AMap.Polyline({
      path: [
        [guessGcj.lng, guessGcj.lat],
        [answerGcj.lng, answerGcj.lat]
      ],
      strokeColor: "#b44d28",
      strokeWeight: 4,
      strokeStyle: "dashed",
      strokeOpacity: 0.9
    });

    overlaysRef.current = [guessMarker, answerMarker, polyline];
    mapRef.current.add(overlaysRef.current);
    mapRef.current.resize();
    window.requestAnimationFrame(() => {
      if (!mapRef.current) {
        return;
      }
      mapRef.current.setFitView(overlaysRef.current, false, [50, 50, 50, 50]);
    });
  }, [result, mapReady]);

  if (!apiKey) {
    return (
      <section className="card map-card result-map-card amap-card-empty">
        <div className="streetview-empty">
          <strong>缺少高德地图 Key</strong>
          <p>请在 `apps/web/.env.local` 中配置 `VITE_AMAP_API_KEY`。</p>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="card map-card result-map-card amap-card-empty">
        <div className="streetview-empty">
          <strong>高德地图加载失败</strong>
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card map-card result-map-card amap-card">
      <div className="eyebrow">结果地图</div>
      <div ref={containerRef} className="map-view amap-view" />
    </section>
  );
}
