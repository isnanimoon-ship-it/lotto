"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { MapShop, MapShopsResponse, ShopWin, ShopWinsResponse } from "../lib/map/types";

const REGIONS = [
  ["전국", 36.35, 127.8, 7], ["서울", 37.5666, 126.978, 11], ["경기", 37.41, 127.15, 9],
  ["인천", 37.4563, 126.7052, 11], ["부산", 35.1796, 129.0756, 11], ["대구", 35.8714, 128.6014, 11],
  ["광주", 35.1595, 126.8526, 11], ["대전", 36.3504, 127.3845, 11], ["울산", 35.5384, 129.3114, 11],
  ["세종", 36.48, 127.289, 11], ["강원", 37.8228, 128.1555, 9], ["충북", 36.6357, 127.4917, 9],
  ["충남", 36.6588, 126.6728, 9], ["전북", 35.8203, 127.1088, 9], ["전남", 34.8161, 126.463, 9],
  ["경북", 36.4919, 128.8889, 9], ["경남", 35.4606, 128.2132, 9], ["제주", 33.4996, 126.5312, 10],
] as const;

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character]!);

function winHistoryHtml(wins: ShopWin[]) {
  const firstRounds = wins.filter((win) => win.rank === 1).map((win) => `${win.round}회`);
  const secondRounds = wins.filter((win) => win.rank === 2).map((win) => `${win.round}회`);
  const row = (label: string, rounds: string[]) => `
    <div class="map-popup-history-row">
      <b>${label}</b><span>${rounds.length ? rounds.join(", ") : "없음"}</span>
    </div>`;
  return `<section class="map-popup-history">${row("1등", firstRounds)}${row("2등", secondRounds)}</section>`;
}

type Coordinates = { lat: number; lng: number };

function distanceKm(from: Coordinates, to: Coordinates) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(to.lng - from.lng);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(kilometers: number) {
  return kilometers < 1
    ? `${Math.max(1, Math.round(kilometers * 1_000))}m`
    : `${kilometers.toFixed(kilometers < 10 ? 1 : 0)}km`;
}

export function LotteryMap() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const shopsRef = useRef<Map<number, MapShop>>(new Map());
  const requestRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const filtersRef = useRef({ first: true, second: true });
  const selectedRef = useRef<MapShop | null>(null);
  const winsRequestRef = useRef<AbortController | null>(null);
  const winsCacheRef = useRef<Map<number, ShopWin[]>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const addressMarkerRef = useRef<any>(null);
  const userLocationRef = useRef<Coordinates | null>(null);
  const hasRequestedRef = useRef(false);
  const autoSearchNextIdleRef = useRef(false);
  const [shops, setShops] = useState<MapShop[]>([]);
  const [selected, setSelected] = useState<MapShop | null>(null);
  const [status, setStatus] = useState("지도를 준비하는 중...");
  const [loading, setLoading] = useState(false);
  const [first, setFirst] = useState(true);
  const [second, setSecond] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSearching, setAddressSearching] = useState(false);

  const displayedShops = useMemo(() => {
    if (!userLocation) return shops.map((shop) => ({ shop, distance: null }));
    return shops
      .map((shop) => ({
        shop,
        distance: distanceKm(userLocation, { lat: shop.lat, lng: shop.lng }),
      }))
      .sort((left, right) => left.distance - right.distance);
  }, [shops, userLocation]);

  const popupContent = useCallback((shop: MapShop, history: string) => {
    const current = userLocationRef.current;
    const routeParams = new URLSearchParams({
      dlat: String(shop.lat),
      dlng: String(shop.lng),
      dname: shop.name,
      appname: window.location.origin,
    });
    if (current) {
      routeParams.set("slat", String(current.lat));
      routeParams.set("slng", String(current.lng));
      routeParams.set("sname", "현재 위치");
    }
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const directionsUrl = mobile
      ? `nmap://route/public?${routeParams.toString()}`
      : `https://map.naver.com/p/search/${encodeURIComponent(shop.address)}`;
    const directionsAttributes = mobile ? "" : ' target="_blank" rel="noopener noreferrer"';
    const directionsLabel = mobile ? "네이버 지도 길찾기" : "네이버 지도에서 보기";
    return `
    <div class="map-popup">
      <p>당첨 판매점</p>
      <strong>${escapeHtml(shop.name)}</strong>
      <span>${escapeHtml(shop.address)}</span>
      <div class="map-popup-counts"><b>1등 ${shop.firstWinCount}건</b><b>2등 ${shop.secondWinCount}건</b><em>총 ${shop.totalWinCount}건</em></div>
      ${history}
      <a class="map-popup-detail" href="/shop/${shop.id}">판매점 상세 정보</a>
      <a class="map-popup-directions" href="${escapeHtml(directionsUrl)}"${directionsAttributes}>${directionsLabel}</a>
    </div>
  `;
  }, []);

  const openShopPopup = useCallback(async (shop: MapShop, marker: any) => {
    if (!mapRef.current) return;
    if (!infoWindowRef.current) {
      infoWindowRef.current = new naver.maps.InfoWindow({
        borderWidth: 0,
        backgroundColor: "transparent",
        disableAnchor: true,
        pixelOffset: new naver.maps.Point(0, -14),
      });
    }
    const cached = winsCacheRef.current.get(shop.id);
    infoWindowRef.current.setContent(popupContent(
      shop,
      cached ? winHistoryHtml(cached) : '<p class="map-popup-loading">전체 당첨 회차를 불러오는 중...</p>',
    ));
    infoWindowRef.current.open(mapRef.current, marker);
    selectedRef.current = shop;
    setSelected(shop);
    if (cached) return;

    winsRequestRef.current?.abort();
    const controller = new AbortController();
    winsRequestRef.current = controller;
    try {
      const response = await fetch(`/api/map/shops/${shop.id}/wins`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as ShopWinsResponse;
      winsCacheRef.current.set(shop.id, result.wins);
      if (selectedRef.current?.id === shop.id) {
        infoWindowRef.current?.setContent(popupContent(shop, winHistoryHtml(result.wins)));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to load shop wins", error);
      if (selectedRef.current?.id === shop.id) {
        infoWindowRef.current?.setContent(
          popupContent(shop, '<p class="map-popup-error">당첨 회차를 불러오지 못했습니다.</p>'),
        );
      }
    }
  }, [popupContent]);

  const approximateRadiusKm = (center: any, edge: any) => {
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const lat1 = toRadians(center.lat());
    const lat2 = toRadians(edge.lat());
    const deltaLat = lat2 - lat1;
    const deltaLng = toRadians(edge.lng() - center.lng());
    const value = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };

  const renderMarkers = useCallback((nextShops: MapShop[]) => {
    const nextIds = new Set(nextShops.map((shop) => shop.id));
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        naver.maps.Event.clearInstanceListeners(marker);
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }
    shopsRef.current = new Map(nextShops.map((shop) => [shop.id, shop]));
    for (const shop of nextShops) {
      if (markersRef.current.has(shop.id)) continue;
      const marker = new naver.maps.Marker({
        map: mapRef.current,
        position: new naver.maps.LatLng(shop.lat, shop.lng),
        title: shop.name,
      });
      naver.maps.Event.addListener(marker, "click", () => {
        const current = shopsRef.current.get(shop.id);
        if (current) openShopPopup(current, marker);
      });
      markersRef.current.set(shop.id, marker);
    }
  }, [openShopPopup]);

  const loadShops = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const ne = bounds.getNE();
    const sw = bounds.getSW();
    if (ne.lat() <= sw.lat() || ne.lng() <= sw.lng()) {
      setStatus("지도 영역을 계산하는 중...");
      return;
    }
    hasRequestedRef.current = true;
    setSearchPending(false);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    const radiusKm = approximateRadiusKm(map.getCenter(), ne);
    const rangeLabel = radiusKm < 10 ? `${radiusKm.toFixed(1)}km` : `${Math.round(radiusKm)}km`;
    try {
      const params = new URLSearchParams({
        north: String(ne.lat()), south: String(sw.lat()), east: String(ne.lng()), west: String(sw.lng()),
        zoom: String(map.getZoom()), first: String(filtersRef.current.first), second: String(filtersRef.current.second),
      });
      const response = await fetch(`/api/map/shops?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as MapShopsResponse;
      if (result.mode === "zoom_in") {
        setShops([]); renderMarkers([]); infoWindowRef.current?.close(); selectedRef.current = null; setSelected(null);
        setStatus(`현재 중심에서 약 ${rangeLabel} 범위입니다. 지도를 확대해주세요.`);
      } else if (result.mode === "too_many_results") {
        setShops([]); renderMarkers([]); infoWindowRef.current?.close(); selectedRef.current = null; setSelected(null);
        setStatus(`약 ${rangeLabel} 범위에 ${result.count.toLocaleString()}곳이 있습니다. 지도를 확대해주세요.`);
      } else {
        if (selectedRef.current && !result.shops.some((shop) => shop.id === selectedRef.current?.id)) {
          infoWindowRef.current?.close();
          selectedRef.current = null;
          setSelected(null);
        }
        setShops(result.shops); renderMarkers(result.shops);
        setStatus(result.count
          ? `현재 중심에서 약 ${rangeLabel} 범위 · 당첨 판매점 ${result.count.toLocaleString()}곳`
          : `현재 중심에서 약 ${rangeLabel} 범위에 등록된 판매점이 없습니다.`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to load map shops", error);
      setStatus("판매점 정보를 불러오지 못했습니다. 지도를 다시 움직여주세요.");
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }, [renderMarkers]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) { setStatus("네이버 지도 Client ID가 설정되지 않았습니다."); return; }
    const initialize = () => {
      if (!mapElement.current || mapRef.current) return;
      const initialSize = new naver.maps.Size(
        mapElement.current.clientWidth,
        mapElement.current.clientHeight,
      );
      mapRef.current = new naver.maps.Map(mapElement.current, {
        center: new naver.maps.LatLng(37.5666, 126.978), zoom: 14, minZoom: 6,
        size: initialSize,
        mapTypeControl: false, scaleControl: false,
        logoControlOptions: { position: naver.maps.Position.BOTTOM_RIGHT },
      });
      const resizeObserver = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          mapRef.current?.setSize(new naver.maps.Size(width, height));
          naver.maps.Event.trigger(mapRef.current, "resize");
        }
      });
      resizeObserverRef.current = resizeObserver;
      resizeObserver.observe(mapElement.current);
      naver.maps.Event.addListener(mapRef.current, "idle", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (!hasRequestedRef.current || autoSearchNextIdleRef.current) {
            autoSearchNextIdleRef.current = false;
            loadShops();
          } else {
            setSearchPending(true);
          }
        }, 300);
      });
      naver.maps.Event.addListener(mapRef.current, "click", () => {
        infoWindowRef.current?.close();
        selectedRef.current = null;
        setSelected(null);
      });
      setMapReady(true);
    };
    if (window.naver?.maps) { initialize(); return; }
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.onload = initialize;
    script.onerror = () => setStatus("네이버 지도 스크립트를 불러오지 못했습니다.");
    document.head.appendChild(script);
    return () => {
      requestRef.current?.abort();
      winsRequestRef.current?.abort();
      infoWindowRef.current?.close();
      resizeObserverRef.current?.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const marker of markersRef.current.values()) marker.setMap(null);
      userMarkerRef.current?.setMap(null);
      accuracyCircleRef.current?.setMap(null);
      addressMarkerRef.current?.setMap(null);
    };
  }, [loadShops]);

  useEffect(() => {
    filtersRef.current = { first, second };
    if (mapReady) loadShops();
  }, [first, second, mapReady, loadShops]);

  const moveRegion = (value: string) => {
    const region = REGIONS.find(([name]) => name === value) ?? REGIONS[0];
    autoSearchNextIdleRef.current = true;
    mapRef.current?.setCenter(new naver.maps.LatLng(region[1], region[2]));
    mapRef.current?.setZoom(region[3]);
  };

  const moveToCurrentLocation = () => {
    if (!mapRef.current || locating) return;
    if (!navigator.geolocation) {
      setStatus("이 브라우저에서는 현재 위치 기능을 지원하지 않습니다.");
      return;
    }
    setLocating(true);
    setStatus("현재 위치를 확인하는 중...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const current = { lat: coords.latitude, lng: coords.longitude };
        userLocationRef.current = current;
        setUserLocation(current);
        const position = new naver.maps.LatLng(coords.latitude, coords.longitude);
        if (!userMarkerRef.current) {
          userMarkerRef.current = new naver.maps.Marker({
            map: mapRef.current,
            position,
            title: "현재 위치",
            zIndex: 1000,
            icon: {
              content: '<div class="current-location-marker"><i></i></div>',
              anchor: new naver.maps.Point(12, 12),
            },
          });
        } else {
          userMarkerRef.current.setPosition(position);
          userMarkerRef.current.setMap(mapRef.current);
        }
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = new naver.maps.Circle({
            map: mapRef.current,
            center: position,
            radius: coords.accuracy,
            fillColor: "#1688f0",
            fillOpacity: 0.1,
            strokeColor: "#1688f0",
            strokeOpacity: 0.35,
            strokeWeight: 1,
          });
        } else {
          accuracyCircleRef.current.setCenter(position);
          accuracyCircleRef.current.setRadius(coords.accuracy);
          accuracyCircleRef.current.setMap(mapRef.current);
        }
        autoSearchNextIdleRef.current = true;
        mapRef.current.setZoom(15);
        mapRef.current.panTo(position);
        setStatus(`현재 위치를 찾았습니다. 위치 정확도는 약 ${Math.round(coords.accuracy)}m입니다.`);
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요."
          : error.code === error.TIMEOUT
            ? "현재 위치 확인 시간이 초과되었습니다. 다시 시도해 주세요."
            : "현재 위치를 확인하지 못했습니다. GPS와 네트워크 상태를 확인해 주세요.";
        setStatus(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const searchAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = addressQuery.trim();
    if (!query || addressSearching || !mapRef.current) return;
    if (!naver.maps.Service?.geocode) {
      setStatus("주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setAddressSearching(true);
    setStatus(`‘${query}’ 주소를 검색하는 중...`);
    naver.maps.Service.geocode({ query }, (status: any, response: any) => {
      setAddressSearching(false);
      if (status !== naver.maps.Service.Status.OK || !response?.v2?.addresses?.length) {
        setStatus("검색한 주소를 찾지 못했습니다. 도로명이나 지번 주소를 확인해 주세요.");
        return;
      }
      const result = response.v2.addresses[0];
      const position = new naver.maps.LatLng(Number(result.y), Number(result.x));
      const resultName = result.roadAddress || result.jibunAddress || query;
      if (!addressMarkerRef.current) {
        addressMarkerRef.current = new naver.maps.Marker({
          map: mapRef.current,
          position,
          title: resultName,
          zIndex: 900,
        });
      } else {
        addressMarkerRef.current.setPosition(position);
        addressMarkerRef.current.setTitle(resultName);
        addressMarkerRef.current.setMap(mapRef.current);
      }
      autoSearchNextIdleRef.current = true;
      mapRef.current.setZoom(15);
      mapRef.current.panTo(position);
      setStatus(`‘${resultName}’ 주변 판매점을 조회합니다.`);
    });
  };

  return (
    <main className="map-shell">
      <header className="topbar">
        <div><p className="eyebrow">LOTTO PLACE</p><h1>당첨 판매점 지도</h1></div>
        <div className="controls">
          <form className="address-search" onSubmit={searchAddress}>
            <input
              type="search"
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              placeholder="도로명 또는 지번 주소"
              aria-label="주소 검색"
            />
            <button type="submit" disabled={!mapReady || addressSearching || !addressQuery.trim()}>
              {addressSearching ? "검색 중" : "검색"}
            </button>
          </form>
          <select aria-label="지역 선택" defaultValue="서울" onChange={(event) => moveRegion(event.target.value)}>
            {REGIONS.map(([name]) => <option key={name}>{name}</option>)}
          </select>
          <button
            type="button"
            className="header-location-button"
            onClick={moveToCurrentLocation}
            disabled={!mapReady || locating}
            aria-label="현재 위치로 이동"
          >
            <span aria-hidden="true">◎</span>{locating ? "찾는 중" : "내 위치"}
          </button>
          <label><input type="checkbox" checked={first} onChange={(event) => setFirst(event.target.checked)} /> 1등</label>
          <label><input type="checkbox" checked={second} onChange={(event) => setSecond(event.target.checked)} /> 2등</label>
        </div>
      </header>
      <section className="workspace">
        <aside className="shop-panel">
          <div className="panel-status"><span>{status}</span>{loading && <i aria-label="로딩 중" />}</div>
          <div className="shop-list">
            {displayedShops.map(({ shop, distance }) => (
              <button key={shop.id} className={selected?.id === shop.id ? "shop-card selected" : "shop-card"} onClick={() => {
                mapRef.current?.panTo(new naver.maps.LatLng(shop.lat, shop.lng));
                const marker = markersRef.current.get(shop.id);
                if (marker) openShopPopup(shop, marker);
              }}>
                <strong>{shop.name}</strong><span>{shop.address}</span>
                <div>
                  <b>1등 {shop.firstWinCount}</b><b>2등 {shop.secondWinCount}</b>
                  {distance !== null && <i className="shop-distance">내 위치 {formatDistance(distance)}</i>}
                  <em>총 {shop.totalWinCount}</em>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <div className="map-stage">
          <div ref={mapElement} className="map-canvas" aria-label="로또 당첨 판매점 지도" />
          {searchPending && (
            <button type="button" className="map-search-button" onClick={loadShops}>
              이 지역 다시 검색
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
