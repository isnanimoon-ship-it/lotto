"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NEARBY_RADII, type NearbyShop, type NearbySort, type Point } from "../lib/map/nearby";

type NearbyResponse = { count: number; shops: NearbyShop[] };

export function NearbyFinder() {
  const [center, setCenter] = useState<Point | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [sort, setSort] = useState<NearbySort>("first");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NearbyResponse | null>(null);

  useEffect(() => {
    if (!center) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(center.lat), lng: String(center.lng), radius: String(radius), sort,
    });
    setLoading(true);
    setError("");
    fetch(`/api/map/nearby?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 422) throw new Error("결과가 너무 많습니다. 반경을 줄여 다시 조회해 주세요.");
          throw new Error("주변 판매점을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        return response.json() as Promise<NearbyResponse>;
      })
      .then(setResult)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setResult(null);
        setError(reason instanceof Error ? reason.message : "주변 판매점을 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [center, radius, sort]);

  function findCurrentLocation() {
    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 기능을 지원하지 않습니다. 아래 지도에서 주소나 지역을 검색해 주세요.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCenter({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      (reason) => {
        setLocating(false);
        setError(reason.code === 1
          ? "위치 권한이 거부되었습니다. 아래 지도에서 주소나 지역을 검색할 수 있습니다."
          : "현재 위치를 확인하지 못했습니다. 다시 시도하거나 아래 지도에서 주소를 검색해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <section id="nearby-finder" className="home-content nearby-finder" aria-labelledby="nearby-title">
      <div className="home-section-heading">
        <div>
          <p className="eyebrow">NEARBY FIRST PRIZE SHOPS</p>
          <h2 id="nearby-title">내 주변 로또 1등 당첨 판매점</h2>
          <p>현재 위치를 기준으로 실제 1등 당첨 이력이 있는 판매점을 비교합니다.</p>
        </div>
      </div>
      <div className="nearby-controls">
        <button id="nearby-location-button" type="button" className="hero-button hero-button-primary" onClick={findCurrentLocation} disabled={locating}>
          {locating ? "위치 확인 중..." : center ? "내 위치 다시 확인" : "내 주변 명당 찾기"}
        </button>
        <label>조회 반경
          <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
            {NEARBY_RADII.map((value) => <option key={value} value={value}>{value}km</option>)}
          </select>
        </label>
        <label>정렬
          <select value={sort} onChange={(event) => setSort(event.target.value as NearbySort)}>
            <option value="first">1등 많은 순</option>
            <option value="distance">가까운 순</option>
            <option value="recent">최근 1등 당첨 순</option>
          </select>
        </label>
      </div>
      {error && <p className="nearby-error" role="alert">{error} <a href="/#map-section">주소·지역 검색하기</a></p>}
      {!center && !error && <p className="nearby-hint">위치 사용이 어려우면 <a href="/#map-section">지도에서 주소 또는 지역으로 검색</a>할 수 있습니다.</p>}
      {center && <p className="nearby-hint" aria-live="polite">
        {loading ? "주변 판매점을 찾는 중..." : result ? `${radius}km 이내 1등 당첨 판매점 ${result.count.toLocaleString()}곳 · 상위 ${result.shops.length}곳 표시` : ""}
      </p>}
      {result && result.count === 0 && <p className="nearby-hint">선택한 반경에 1등 당첨 이력이 있는 판매점이 없습니다. 반경을 늘려 보세요.</p>}
      {result && result.shops.length > 0 && (
        <ol className="nearby-list">
          {result.shops.map((shop) => (
            <li key={shop.id}>
              <Link href={`/shop/${shop.id}`}>
                <strong>{shop.name}</strong>
                <span>{shop.region ? `${shop.region} · ` : ""}{shop.address}</span>
                <small>현재 위치에서 {shop.distanceKm < 1 ? `${Math.round(shop.distanceKm * 1000)}m` : `${shop.distanceKm.toFixed(1)}km`}</small>
                <div><b>1등 {shop.firstWinCount}건</b><span>2등 {shop.secondWinCount}건</span><span>최근 1등 {shop.lastFirstWinRound ? `${shop.lastFirstWinRound}회` : "정보 없음"}</span></div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
