import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import Overlay from 'ol/Overlay';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { defaults as defaultControls, FullScreen } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSMXML from 'ol/format/OSMXML';
import { Style, Fill, Stroke } from 'ol/style';
import Layout from '../components/Layout';

export default function AisExpansionPage() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [loadingHouses, setLoadingHouses] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);
  const [clickedCoord, setClickedCoord] = useState(null);

  const popupRef = useRef(null);
  const popupOverlayRef = useRef(null);

  const vectorSourceRef = useRef(new VectorSource());
  const detectionEnabledRef = useRef(detectionEnabled);

  useEffect(() => {
    detectionEnabledRef.current = detectionEnabled;
  }, [detectionEnabled]);

  const loadBuildings = async (mapInstance) => {
    if (!detectionEnabledRef.current) return;

    const view = mapInstance.getView();
    const zoom = view.getZoom();

    if (zoom < 16) {
      setZoomWarning(true);
      vectorSourceRef.current.clear();
      return;
    }
    setZoomWarning(false);

    const extent = view.calculateExtent(mapInstance.getSize());
    const extent4326 = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    const [minx, miny, maxx, maxy] = extent4326;

    setLoadingHouses(true);
    try {
      const query = `[out:xml][timeout:25];(way["building"](${miny},${minx},${maxy},${maxx});relation["building"](${miny},${minx},${maxy},${maxx}););out body;>;out skel qt;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });
      const text = await res.text();
      const format = new OSMXML();
      const features = format.readFeatures(text, { featureProjection: 'EPSG:3857' });
      vectorSourceRef.current.clear();
      vectorSourceRef.current.addFeatures(features);
    } catch (err) {
      console.error('Failed to fetch buildings', err);
    } finally {
      setLoadingHouses(false);
    }
  };

  // React to toggle
  useEffect(() => {
    if (map) {
      if (detectionEnabled) {
        loadBuildings(map);
      } else {
        vectorSourceRef.current.clear();
        setZoomWarning(false);
      }
    }
  }, [detectionEnabled, map]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!map) {
      const initialMap = new Map({
        target: mapRef.current,
        controls: defaultControls().extend([new FullScreen()]),
        layers: [
          // 1. Layer ภาพถ่ายดาวเทียม (ArcGIS World Imagery)
          new TileLayer({
            source: new XYZ({
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              attributions: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
              crossOrigin: 'anonymous',
            }),
          }),
          // 2. Layer ป้ายชื่อสถานที่และขอบเขต (ArcGIS Reference Labels)
          new TileLayer({
            source: new XYZ({
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
              crossOrigin: 'anonymous',
            }),
          }),
          // 3. Layer สำหรับวาดขอบเขตบ้านสีแดง
          new VectorLayer({
            source: vectorSourceRef.current,
            style: new Style({
              stroke: new Stroke({
                color: 'rgba(239, 68, 68, 0.9)', // ปรับสีแดงให้เข้มขึ้นเล็กน้อยเพื่อให้ตัดกับภาพดาวเทียม
                width: 2,
              }),
              fill: new Fill({
                color: 'rgba(239, 68, 68, 0.3)', // ปรับ fill ให้ชัดขึ้นบนภาพดาวเทียม
              }),
            }),
          }),
        ],
        view: new View({
          center: fromLonLat([100.5018, 13.7563]), // Bangkok
          zoom: 6,
        }),
      });

      // Create Popup Overlay
      const popupOverlay = new Overlay({
        element: popupRef.current,
        positioning: 'bottom-center',
        stopEvent: true,
        offset: [0, -10],
      });
      initialMap.addOverlay(popupOverlay);
      popupOverlayRef.current = popupOverlay;

      setMap(initialMap);

      initialMap.on('moveend', () => {
        if (detectionEnabledRef.current) {
          loadBuildings(initialMap);
        }
      });

      initialMap.on('singleclick', (evt) => {
        const coords = toLonLat(evt.coordinate);
        setClickedCoord({
          lon: coords[0].toFixed(6),
          lat: coords[1].toFixed(6)
        });
        popupOverlay.setPosition(evt.coordinate);
      });
    }

    return () => {
      if (map) {
        map.setTarget(null);
        setMap(null);
      }
    };
  }, [map]);

  return (
    <Layout activeKey="ais_expansion" pageTitle="ระบบงานขยาย AIS (แผนที่ดาวเทียม)">
      <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        {/* Header toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 shrink-0">
          <div>
            <h3 className="font-bold text-[#042C53] flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              แผนที่ดาวเทียมตรวจจับบ้าน
            </h3>
            <p className="text-xs text-slate-500 mt-1">ArcGIS Satellite & Overpass API</p>
          </div>

          {/* Detection Toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={detectionEnabled}
                onChange={(e) => setDetectionEnabled(e.target.checked)}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${detectionEnabled ? 'bg-brand-500' : 'bg-slate-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${detectionEnabled ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <span className={`text-sm font-bold ${detectionEnabled ? 'text-brand-600' : 'text-slate-500'}`}>
              เปิดโหมดตรวจจับบ้าน
            </span>
          </label>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-800">
          <div ref={mapRef} className="absolute inset-0 w-full h-full" />

          {/* Loading Indicator */}
          {loadingHouses && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-brand-100 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              <span className="text-sm font-semibold text-brand-700">กำลังสแกนหาบ้าน...</span>
            </div>
          )}

          {/* Zoom Warning Indicator */}
          {zoomWarning && detectionEnabled && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-amber-50 px-4 py-2 rounded-full shadow-md border border-amber-200 flex items-center gap-2 animate-fade-in-up">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-semibold text-amber-700">กรุณาซูมเข้าใกล้กว่านี้เพื่อโหลดข้อมูลบ้าน</span>
            </div>
          )}

          {/* Coordinates Popup Overlay */}
          <div ref={popupRef} className={`absolute z-20 ${clickedCoord ? 'block' : 'hidden'} transition-opacity`}>
            {clickedCoord && (
              <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 min-w-[200px] relative origin-bottom">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">พิกัดบนแผนที่</span>
                  <button onClick={() => {
                    setClickedCoord(null);
                    if (popupOverlayRef.current) {
                      popupOverlayRef.current.setPosition(undefined);
                    }
                  }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors -mr-1 -mt-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#042C53] leading-tight">{clickedCoord.lat}</p>
                    <p className="text-xs font-bold text-[#042C53] leading-tight">{clickedCoord.lon}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${clickedCoord.lat}, ${clickedCoord.lon}`);
                    alert('คัดลอกพิกัดเรียบร้อยแล้ว!');
                  }}
                  className="w-full mt-1 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-bold rounded-lg transition-colors border border-brand-100"
                >
                  คัดลอกพิกัด
                </button>
                
                {/* Pointer arrow pointing down */}
                <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-200 transform rotate-45"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}