let amapPromise = null;

export function loadAmap(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error("缺少高德地图 Key"));
  }

  if (typeof window === "undefined") {
    return Promise.reject(new Error("高德地图只能在浏览器环境中加载"));
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  if (amapPromise) {
    return amapPromise;
  }

  amapPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-amap-loader="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.AMap));
      existing.addEventListener("error", () => reject(new Error("高德地图脚本加载失败")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.amapLoader = "true";
    script.onload = () => resolve(window.AMap);
    script.onerror = () => reject(new Error("高德地图脚本加载失败"));
    document.head.appendChild(script);
  });

  return amapPromise;
}
