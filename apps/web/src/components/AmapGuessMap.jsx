import { useCallback, useEffect, useRef, useState } from "react";
import { gcj02ToWgs84, wgs84ToGcj02 } from "../services/coordTransform.js";
import { loadAmap } from "../services/amapLoader.js";

export default function AmapGuessMap({ value, onChange, apiKey }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [loadError, setLoadError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  // 保持 onChange 引用最新，避免因父组件重渲染导致地图重建
  onChangeRef.current = onChange;

  // 用 ref 包裹 click handler，避免闭包陈旧引用
  const handleMapClick = useCallback((event) => {
    const clickedGcj = event.lnglat;
    const clickedWgs = gcj02ToWgs84(clickedGcj.lng, clickedGcj.lat);
    onChangeRef.current({
      lat: clickedWgs.lat,
      lng: clickedWgs.lng
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    loadAmap(apiKey)
      .then((AMap) => {
        if (!mounted || mapRef.current || !containerRef.current) {
          return;
        }

        const map = new AMap.Map(containerRef.current, {
          viewMode: "2D",
          zoom: 1,
          center: [0, 20],
          mapStyle: "amap://styles/whitesmoke"
        });

        map.on("click", handleMapClick);

        mapRef.current = map;
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
      markerRef.current = null;
      setMapReady(false);
    };
  }, [apiKey]); // 移除 onChange 依赖 —— 通过 ref 始终保持最新

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.AMap) {
      return;
    }

    if (!value) {
      if (markerRef.current) {
        mapRef.current.remove(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    const gcjPoint = wgs84ToGcj02(value.lng, value.lat);
    const center = [gcjPoint.lng, gcjPoint.lat];

    if (!markerRef.current) {
      markerRef.current = new window.AMap.CircleMarker({
        center,
        radius: 9,
        strokeColor: "#fff8ef",
        strokeWeight: 3,
        fillColor: "#244c47",
        fillOpacity: 1,
        zIndex: 200
      });
      mapRef.current.add(markerRef.current);
    } else {
      markerRef.current.setCenter(center);
    }

    mapRef.current.setCenter(center);
  }, [value, mapReady]);

  if (!apiKey) {
    return (
      <section className="card map-card mini-map-card amap-card-empty">
        <div className="streetview-empty">
          <strong>缺少高德地图 Key</strong>
          <p>请在 `apps/web/.env.local` 中配置 `VITE_AMAP_API_KEY` 以加载小地图。</p>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="card map-card mini-map-card amap-card-empty">
        <div className="streetview-empty">
          <strong>高德地图加载失败</strong>
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card map-card mini-map-card amap-card">
      <div ref={containerRef} className="map-view amap-view" />
    </section>
  );
}
