import { useEffect, useRef, useState, useCallback } from 'react';
import 'ol/ol.css';
import { Map, View, Feature } from 'ol';
import Overlay from 'ol/Overlay';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls, FullScreen } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Point from 'ol/geom/Point';
import Circle from 'ol/geom/Circle';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

/**
 * Satellite map picker for expansion jobs.
 * Props:
 *   lat, lng, radiusM — controlled values
 *   onPick({ lat, lng }) — when user clicks map or searches
 *   onRadiusChange(n)
 *   height — CSS height of map area
 *   selectable — if false, view-only (still shows marker)
 */
export default function ExpansionMapPicker({
  lat = null,
  lng = null,
  radiusM = 500,
  onPick,
  onRadiusChange,
  height = '280px',
  selectable = true,
  className = '',
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vectorSourceRef = useRef(new VectorSource());
  const popupRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [coordInput, setCoordInput] = useState(
    lat != null && lng != null ? `${lat}, ${lng}` : ''
  );
  const [radiusInput, setRadiusInput] = useState(String(radiusM ?? 500));
  const [searchError, setSearchError] = useState('');
  const [clickedCoord, setClickedCoord] = useState(null);

  const drawMarker = useCallback((latNum, lonNum, radiusMeters) => {
    vectorSourceRef.current.clear();
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return;

    const centerCoord = fromLonLat([lonNum, latNum]);
    vectorSourceRef.current.addFeature(new Feature({ geometry: new Point(centerCoord) }));

    if (Number.isFinite(radiusMeters) && radiusMeters > 0) {
      const radiusMapUnits = radiusMeters / Math.cos((latNum * Math.PI) / 180);
      vectorSourceRef.current.addFeature(
        new Feature({ geometry: new Circle(centerCoord, radiusMapUnits) })
      );
    }

    const map = mapInstanceRef.current;
    if (map) {
      map.getView().animate({ center: centerCoord, zoom: 17, duration: 600 });
    }
  }, []);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return undefined;

    const map = new Map({
      target: mapRef.current,
      controls: defaultControls().extend([new FullScreen()]),
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attributions: 'Tiles &copy; Esri',
            crossOrigin: 'anonymous',
          }),
        }),
        new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            crossOrigin: 'anonymous',
          }),
        }),
        new VectorLayer({
          source: vectorSourceRef.current,
          style: new Style({
            fill: new Fill({ color: 'rgba(59, 130, 246, 0.15)' }),
            stroke: new Stroke({ color: '#3B82F6', width: 2 }),
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: '#ef4444' }),
              stroke: new Stroke({ color: '#ffffff', width: 3 }),
            }),
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([100.5018, 13.7563]),
        zoom: 6,
      }),
    });

    const popupOverlay = new Overlay({
      element: popupRef.current,
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -10],
    });
    map.addOverlay(popupOverlay);
    popupOverlayRef.current = popupOverlay;
    mapInstanceRef.current = map;

    if (selectable) {
      map.on('singleclick', (evt) => {
        const coords = toLonLat(evt.coordinate);
        const latStr = coords[1].toFixed(6);
        const lonStr = coords[0].toFixed(6);
        setClickedCoord({ lat: latStr, lon: lonStr });
        setCoordInput(`${latStr}, ${lonStr}`);
        popupOverlay.setPosition(evt.coordinate);
        const r = parseFloat(radiusInput) || 500;
        drawMarker(parseFloat(latStr), parseFloat(lonStr), r);
        onPickRef.current?.({ lat: parseFloat(latStr), lng: parseFloat(lonStr) });
      });
    }

    return () => {
      map.setTarget(null);
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectable]);

  // Sync external lat/lng/radius
  useEffect(() => {
    const latNum = lat != null ? Number(lat) : NaN;
    const lonNum = lng != null ? Number(lng) : NaN;
    const r = Number(radiusM) || 500;
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      setCoordInput(`${latNum}, ${lonNum}`);
      drawMarker(latNum, lonNum, r);
    }
  }, [lat, lng, radiusM, drawMarker]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    if (!coordInput.trim()) {
      setSearchError('กรุณาระบุพิกัด');
      return;
    }
    const parts = coordInput.split(/[, ]+/).filter(Boolean);
    if (parts.length < 2) {
      setSearchError('รูปแบบไม่ถูกต้อง (เช่น 13.75, 100.50)');
      return;
    }
    const latNum = parseFloat(parts[0]);
    const lonNum = parseFloat(parts[1]);
    if (isNaN(latNum) || isNaN(lonNum)) {
      setSearchError('พิกัดต้องเป็นตัวเลข');
      return;
    }
    const r = parseFloat(radiusInput) || 500;
    drawMarker(latNum, lonNum, r);
    setClickedCoord({ lat: latNum.toFixed(6), lon: lonNum.toFixed(6) });
    onPickRef.current?.({ lat: latNum, lng: lonNum });
    if (popupOverlayRef.current && mapInstanceRef.current) {
      popupOverlayRef.current.setPosition(fromLonLat([lonNum, latNum]));
    }
  };

  return (
    <div className={`flex flex-col border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white ${className}`}>
      <form onSubmit={handleSearch} className="flex flex-wrap items-start gap-2 p-3 bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <div className="flex-1 min-w-[160px]">
          <input
            type="text"
            placeholder="พิกัด: 13.75, 100.50"
            value={coordInput}
            disabled={!selectable}
            onChange={(e) => {
              setCoordInput(e.target.value);
              if (searchError) setSearchError('');
            }}
            className={`w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-[#A3E635]/40 ${
              searchError ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB] bg-white'
            } disabled:opacity-60`}
          />
          {searchError && <p className="text-[10px] text-red-500 font-medium mt-1">{searchError}</p>}
        </div>
        <div className="relative w-[100px]">
          <input
            type="number"
            placeholder="รัศมี"
            value={radiusInput}
            disabled={!selectable}
            onChange={(e) => {
              setRadiusInput(e.target.value);
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n)) onRadiusChange?.(n);
            }}
            className="w-full px-3 py-2 pr-7 text-sm border border-[#E5E7EB] rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#A3E635]/40 disabled:opacity-60"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9CA3AF]">ม.</span>
        </div>
        {selectable && (
          <button
            type="submit"
            className="px-4 py-2 text-sm font-bold rounded-xl text-[#1F2937]"
            style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
          >
            ค้นหา
          </button>
        )}
      </form>

      <div className="relative bg-slate-800" style={{ height }}>
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />
        <div ref={popupRef} className={`absolute z-20 ${clickedCoord ? 'block' : 'hidden'}`}>
          {clickedCoord && (
            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 min-w-[180px] relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">พิกัดที่เลือก</span>
                <button
                  type="button"
                  onClick={() => {
                    setClickedCoord(null);
                    popupOverlayRef.current?.setPosition(undefined);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs font-bold text-[#042C53]">{clickedCoord.lat}, {clickedCoord.lon}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${clickedCoord.lat}, ${clickedCoord.lon}`);
                  }}
                  className="flex-1 py-1.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg"
                >
                  คัดลอก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.open(
                      `https://earth.google.com/web/search/${clickedCoord.lat},+${clickedCoord.lon}`,
                      '_blank'
                    );
                  }}
                  className="flex-[1.2] py-1.5 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-lg"
                >
                  Earth
                </button>
              </div>
              <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
