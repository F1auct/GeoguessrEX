let amapPromise = null;

export function loadAmap(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error("Missing AMap API key"));
  }

  if (typeof window === "undefined") {
    return Promise.reject(new Error("AMap can only load in the browser"));
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
      existing.addEventListener("error", () => reject(new Error("Failed to load AMap script")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.amapLoader = "true";
    script.onload = () => resolve(window.AMap);
    script.onerror = () => reject(new Error("Failed to load AMap script"));
    document.head.appendChild(script);
  });

  return amapPromise;
}
