export interface BMapPointLike {
  lng: number;
  lat: number;
}

export interface BMapMapLike {
  centerAndZoom: (point: BMapPointLike, zoom: number) => void;
  enableScrollWheelZoom: (enabled?: boolean) => void;
  setMinZoom?: (zoom: number) => void;
  setMaxZoom?: (zoom: number) => void;
  setCurrentCity?: (city: string) => void;
  setDisplayOptions?: (options: Record<string, unknown>) => void;
  setMapStyleV2?: (options: { styleId?: string }) => void;
  addControl: (control: unknown) => void;
  addOverlay: (overlay: unknown) => void;
  removeOverlay: (overlay: unknown) => void;
  clearOverlays?: () => void;
  panTo?: (point: BMapPointLike) => void;
  setZoom?: (zoom: number) => void;
}

export interface BMapPolygonLike {
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  setFillColor?: (value: string) => void;
  setFillOpacity?: (value: number) => void;
  setStrokeColor?: (value: string) => void;
  setStrokeWeight?: (value: number) => void;
  setStrokeOpacity?: (value: number) => void;
}

export interface BMapLabelLike {
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
  setStyle?: (styles: Record<string, string>) => void;
  setPosition?: (point: BMapPointLike) => void;
}

export interface BMapBoundaryResult {
  boundaries?: string[];
}

export interface BMapGLNamespace {
  Map: new (container: string | HTMLElement) => BMapMapLike;
  Point: new (lng: number, lat: number) => BMapPointLike;
  Size: new (width: number, height: number) => unknown;
  Label: new (content: string, options: { position: BMapPointLike; offset?: unknown }) => BMapLabelLike;
  Polygon: new (
    path: string[] | string,
    options?: {
      strokeColor?: string;
      strokeWeight?: number;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
    },
  ) => BMapPolygonLike;
  Boundary: new () => {
    get: (districtName: string, callback: (result: BMapBoundaryResult) => void) => void;
  };
  ScaleControl: new () => unknown;
  ZoomControl: new () => unknown;
}

declare global {
  interface Window {
    BMapGL?: BMapGLNamespace;
    __initBaiduMapGL__?: () => void;
  }
}

let baiduMapPromise: Promise<BMapGLNamespace> | null = null;
const boundaryPromiseCache = new Map<string, Promise<string[]>>();

export function loadBaiduMapGL(ak: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Baidu Map GL can only be loaded in the browser."));
  }

  if (!ak) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_BAIDU_MAP_AK."));
  }

  if (window.BMapGL) {
    return Promise.resolve(window.BMapGL);
  }

  if (baiduMapPromise) {
    return baiduMapPromise;
  }

  baiduMapPromise = new Promise<BMapGLNamespace>((resolve, reject) => {
    const callbackName = "__initBaiduMapGL__";
    window[callbackName] = () => {
      if (window.BMapGL) {
        resolve(window.BMapGL);
        return;
      }
      reject(new Error("Baidu Map GL loaded without a BMapGL global."));
    };

    const script = document.createElement("script");
    script.src = `https://api.map.baidu.com/api?type=webgl&v=1.0&ak=${encodeURIComponent(ak)}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      baiduMapPromise = null;
      reject(new Error("Failed to load the Baidu Map GL script."));
    };

    document.head.appendChild(script);
  });

  return baiduMapPromise;
}

export function fetchDistrictBoundaries(BMapGL: BMapGLNamespace, districtName: string) {
  if (!districtName) {
    return Promise.resolve<string[]>([]);
  }

  if (boundaryPromiseCache.has(districtName)) {
    return boundaryPromiseCache.get(districtName)!;
  }

  const promise = new Promise<string[]>((resolve, reject) => {
    const boundary = new BMapGL.Boundary();
    boundary.get(districtName, (result) => {
      const boundaries = result?.boundaries?.filter(Boolean) ?? [];
      if (boundaries.length > 0) {
        resolve(boundaries);
        return;
      }
      reject(new Error(`No administrative boundaries returned for ${districtName}.`));
    });
  });

  boundaryPromiseCache.set(districtName, promise);
  return promise;
}

export function buildBMapPoint(BMapGL: BMapGLNamespace, center: [number, number]) {
  return new BMapGL.Point(center[0], center[1]);
}
