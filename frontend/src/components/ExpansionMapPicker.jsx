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
import LineString from 'ol/geom/LineString';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Satellite map picker for expansion / sales.
 *
 * mode:
 *   - "basic"  — single pin + optional radius (legacy)
 *   - "sales"  — customer pin + nearby splitters + line to selected
 *   - "admin"  — pin for splitter placement (no radius)
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
  mode = 'basic',
  splitters = [],
  selectedSplitterId = null,
  onSelectSplitter,
  showGps = false,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const customerSourceRef = useRef(new VectorSource());
  const splitterSourceRef = useRef(new VectorSource());
  const lineSourceRef = useRef(new VectorSource());
  const popupRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const onPickRef = useRef(onPick);
  const onSelectSplitterRef = useRef(onSelectSplitter);
  onPickRef.current = onPick;
  onSelectSplitterRef.current = onSelectSplitter;

  const showRadius = mode === 'basic';
  const [coordInput, setCoordInput] = useState(
    lat != null && lng != null ? `${lat}, ${lng}` : ''
  );
  const [radiusInput, setRadiusInput] = useState(String(radiusM ?? 500));
  const [searchError, setSearchError] = useState('');
  const [clickedCoord, setClickedCoord] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const customerStyle = useCallback(
    () =>
      new Style({
        fill: new Fill({ color: 'rgba(59, 130, 246, 0.15)' }),
        stroke: new Stroke({ color: '#3B82F6', width: 2 }),
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: '#ef4444' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
      }),
    []
  );

  const drawCustomer = useCallback(
    (latNum, lonNum, radiusMeters) => {
      customerSourceRef.current.clear();
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return;

      const centerCoord = fromLonLat([lonNum, latNum]);
      customerSourceRef.current.addFeature(
        new Feature({ geometry: new Point(centerCoord), kind: 'customer' })
      );

      if (showRadius && Number.isFinite(radiusMeters) && radiusMeters > 0) {
        const radiusMapUnits = radiusMeters / Math.cos((latNum * Math.PI) / 180);
        customerSourceRef.current.addFeature(
          new Feature({ geometry: new Circle(centerCoord, radiusMapUnits) })
        );
      }

      const map = mapInstanceRef.current;
      if (map) {
        map.getView().animate({ center: centerCoord, zoom: 17, duration: 600 });
      }
    },
    [showRadius]
  );

  const drawSplittersAndLine = useCallback(() => {
    splitterSourceRef.current.clear();
    lineSourceRef.current.clear();

    const list = Array.isArray(splitters) ? splitters : [];
    list.forEach((sp) => {
      const sLat = Number(sp.lat);
      const sLng = Number(sp.lng);
      if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) return;
      const f = new Feature({
        geometry: new Point(fromLonLat([sLng, sLat])),
        kind: 'splitter',
        splitterId: sp.id,
        label: sp.code || sp.name || `#${sp.id}`,
      });
      const selected = Number(selectedSplitterId) === Number(sp.id);
      f.setStyle(
        new Style({
          image: new CircleStyle({
            radius: selected ? 10 : 7,
            fill: new Fill({ color: selected ? '#F59E0B' : '#0EA5E9' }),
            stroke: new Stroke({ color: '#ffffff', width: selected ? 3 : 2 }),
          }),
          text: new Text({
            text: String(sp.code || sp.name || sp.id),
            offsetY: -14,
            font: 'bold 11px sans-serif',
            fill: new Fill({ color: '#0F172A' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
          }),
        })
      );
      splitterSourceRef.current.addFeature(f);
    });

    const custLat = lat != null ? Number(lat) : NaN;
    const custLng = lng != null ? Number(lng) : NaN;
    const selected = list.find((s) => Number(s.id) === Number(selectedSplitterId));
    if (
      selected &&
      Number.isFinite(custLat) &&
      Number.isFinite(custLng) &&
      Number.isFinite(Number(selected.lat)) &&
      Number.isFinite(Number(selected.lng))
    ) {
      const line = new Feature({
        geometry: new LineString([
          fromLonLat([custLng, custLat]),
          fromLonLat([Number(selected.lng), Number(selected.lat)]),
        ]),
      });
      line.setStyle(
        new Style({
          stroke: new Stroke({ color: '#F59E0B', width: 3, lineDash: [8, 6] }),
        })
      );
      lineSourceRef.current.addFeature(line);
    }
  }, [splitters, selectedSplitterId, lat, lng]);

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
        new VectorLayer({ source: lineSourceRef.current }),
        new VectorLayer({ source: splitterSourceRef.current }),
        new VectorLayer({
          source: customerSourceRef.current,
          style: customerStyle(),
        }),
      ],
      view: new View({
        center: fromLonLat([99.334, 9.138]),
        zoom: 11,
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

    map.on('singleclick', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature && feature.get('kind') === 'splitter') {
        const sid = feature.get('splitterId');
        onSelectSplitterRef.current?.(sid);
        return;
      }

      if (!selectable) return;
      const coords = toLonLat(evt.coordinate);
      const latStr = coords[1].toFixed(6);
      const lonStr = coords[0].toFixed(6);
      setClickedCoord({ lat: latStr, lon: lonStr });
      setCoordInput(`${latStr}, ${lonStr}`);
      popupOverlay.setPosition(evt.coordinate);
      const r = parseFloat(radiusInput) || 500;
      drawCustomer(parseFloat(latStr), parseFloat(lonStr), r);
      onPickRef.current?.({ lat: parseFloat(latStr), lng: parseFloat(lonStr) });
    });

    return () => {
      map.setTarget(null);
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectable]);

  useEffect(() => {
    const latNum = lat != null ? Number(lat) : NaN;
    const lonNum = lng != null ? Number(lng) : NaN;
    const r = Number(radiusM) || 500;
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      setCoordInput(`${latNum}, ${lonNum}`);
      drawCustomer(latNum, lonNum, r);
    } else {
      customerSourceRef.current.clear();
    }
  }, [lat, lng, radiusM, drawCustomer]);

  useEffect(() => {
    if (mode === 'sales' || mode === 'admin') {
      drawSplittersAndLine();
    }
  }, [mode, drawSplittersAndLine]);

  const applyCoords = (latNum, lonNum) => {
    const r = parseFloat(radiusInput) || 500;
    drawCustomer(latNum, lonNum, r);
    setClickedCoord({ lat: latNum.toFixed(6), lon: lonNum.toFixed(6) });
    setCoordInput(`${latNum}, ${lonNum}`);
    onPickRef.current?.({ lat: latNum, lng: lonNum });
    if (popupOverlayRef.current && mapInstanceRef.current) {
      popupOverlayRef.current.setPosition(fromLonLat([lonNum, latNum]));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    if (!coordInput.trim()) {
      setSearchError('กรุณาระบุพิกัด');
      return;
    }
    const parts = coordInput.split(/[, ]+/).filter(Boolean);
    if (parts.length < 2) {
      setSearchError('รูปแบบไม่ถูกต้อง (เช่น 9.13, 99.33)');
      return;
    }
    const latNum = parseFloat(parts[0]);
    const lonNum = parseFloat(parts[1]);
    if (isNaN(latNum) || isNaN(lonNum)) {
      setSearchError('พิกัดต้องเป็นตัวเลข');
      return;
    }
    applyCoords(latNum, lonNum);
  };

  const handleGps = () => {
    if (!navigator.geolocation) {
      setSearchError('อุปกรณ์ไม่รองรับ GPS');
      return;
    }
    setGpsLoading(true);
    setSearchError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        applyCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGpsLoading(false);
        setSearchError('ไม่สามารถระบุตำแหน่งปัจจุบันได้');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const selected = (splitters || []).find((s) => Number(s.id) === Number(selectedSplitterId));
  let straightM = null;
  if (selected && lat != null && lng != null) {
    straightM = Math.round(
      haversineMeters(Number(lat), Number(lng), Number(selected.lat), Number(selected.lng))
    );
  }

  return (
    <div className={`flex flex-col border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white ${className}`}>
      <form onSubmit={handleSearch} className="flex flex-wrap items-start gap-2 p-3 bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <div className="flex-1 min-w-[160px]">
          <input
            type="text"
            placeholder="พิกัด: 9.13, 99.33"
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
        {showRadius && (
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
        )}
        {selectable && (
          <button
            type="submit"
            className="px-4 py-2 text-sm font-bold rounded-xl text-[#1F2937]"
            style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
          >
            ค้นหา
          </button>
        )}
        {(showGps || mode === 'sales' || mode === 'admin') && selectable && (
          <button
            type="button"
            onClick={handleGps}
            disabled={gpsLoading}
            className="px-3 py-2 text-sm font-bold rounded-xl bg-sky-50 text-sky-700 border border-sky-200 disabled:opacity-60"
          >
            {gpsLoading ? '...' : 'GPS'}
          </button>
        )}
      </form>

      <div className="relative bg-slate-800" style={{ height }}>
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />
        <div ref={popupRef} className={`absolute z-20 ${clickedCoord ? 'block' : 'hidden'}`}>
          {clickedCoord && (
            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 min-w-[180px] relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {mode === 'admin' ? 'พิกัด Splitter' : 'พิกัดบ้านลูกค้า'}
                </span>
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
              </div>
              <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45" />
            </div>
          )}
        </div>
      </div>

      {mode === 'sales' && (
        <div className="p-3 border-t border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-[#6B7280] uppercase">Splitter ใกล้เคียง (3 กม.)</p>
            {straightM != null && (
              <p className="text-xs font-black text-amber-700">เส้นตรง {straightM} ม.</p>
            )}
          </div>
          {!splitters?.length ? (
            <p className="text-xs text-[#9CA3AF]">ยังไม่มี Splitter ในรัศมี — ปักบ้านก่อน หรือให้แอดมินเพิ่มจุด</p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1">
              {splitters.map((sp) => {
                const active = Number(selectedSplitterId) === Number(sp.id);
                const dist = sp.distance_m != null
                  ? Math.round(Number(sp.distance_m))
                  : (lat != null && lng != null
                    ? Math.round(haversineMeters(Number(lat), Number(lng), Number(sp.lat), Number(sp.lng)))
                    : null);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => onSelectSplitter?.(sp.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-white border-[#E5E7EB] text-[#374151]'
                    }`}
                  >
                    <span className="truncate">
                      {sp.code || sp.name || `SP-${sp.id}`}
                      {sp.area ? ` · ${sp.area}` : ''}
                    </span>
                    <span className="shrink-0 font-black">{dist != null ? `${dist} ม.` : '-'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { haversineMeters };
