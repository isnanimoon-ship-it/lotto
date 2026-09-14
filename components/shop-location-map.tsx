"use client";

import { useEffect, useRef, useState } from "react";

type Props = { name: string; address: string; latitude: number | null; longitude: number | null };

export function ShopLocationMap({ name, address, latitude, longitude }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const hasCoordinates = latitude !== null && longitude !== null
    && Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!hasCoordinates) return;
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      setStatus("error");
      return;
    }
    let disposed = false;
    let marker: any = null;
    let map: any = null;
    const initialize = () => {
      if (disposed || !elementRef.current || !window.naver?.maps) {
        if (!disposed) setStatus("error");
        return;
      }
      const position = new naver.maps.LatLng(latitude, longitude);
      map = new naver.maps.Map(elementRef.current, {
        center: position, zoom: 16, minZoom: 10,
        mapTypeControl: false, scaleControl: false,
        logoControlOptions: { position: naver.maps.Position.BOTTOM_RIGHT },
      });
      marker = new naver.maps.Marker({ map, position, title: name });
      setStatus("ready");
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
    const script = existing ?? document.createElement("script");
    if (window.naver?.maps) initialize();
    else {
      script.addEventListener("load", initialize);
      script.addEventListener("error", onError);
      if (!existing) {
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
        script.async = true;
        document.head.appendChild(script);
      }
    }
    function onError() { if (!disposed) setStatus("error"); }
    return () => {
      disposed = true;
      script.removeEventListener("load", initialize);
      script.removeEventListener("error", onError);
      marker?.setMap(null);
      if (map) naver.maps.Event.clearInstanceListeners(map);
    };
  }, [hasCoordinates, latitude, longitude, name]);

  if (!hasCoordinates) {
    return <p className="shop-location-unavailable">이 판매점은 좌표 정보가 없어 지도를 표시할 수 없습니다. 아래 주소로 위치를 확인해 주세요: {address}</p>;
  }
  return <div className="shop-location-frame">
    <div ref={elementRef} className="shop-location-canvas" aria-label={`${name} 위치 지도`} />
    {status !== "ready" && <p className="shop-location-status" role="status">
      {status === "loading" ? "판매점 위치 지도를 불러오는 중..." : "지도를 불러오지 못했습니다. 네이버 지도에서 주소를 확인해 주세요."}
    </p>}
  </div>;
}
