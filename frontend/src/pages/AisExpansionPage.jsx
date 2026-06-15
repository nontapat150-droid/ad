import React, { useEffect, useRef, useState } from 'react';
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
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import Layout from '../components/Layout';

export default function AisExpansionPage() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [clickedCoord, setClickedCoord] = useState(null);
  const [splitterInput, setSplitterInput] = useState('');
  const [searchError, setSearchError] = useState('');

  const popupRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const vectorSourceRef = useRef(new VectorSource());

  const handleSearchSplitter = (e) => {
    e.preventDefault();
    setSearchError('');
    
    if (!splitterInput.trim()) {
      setSearchError('กรุณาระบุพิกัด');
      return;
    }

    // Attempt to parse "lat, lon" or "lat lon"
    const parts = splitterInput.split(/[, ]+/).filter(Boolean);
    if (parts.length < 2) {
      setSearchError('รูปแบบพิกัดไม่ถูกต้อง (เช่น 13.75, 100.50)');
      return;
    }

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
      setSearchError('พิกัดต้องเป็นตัวเลข');
      return;
    }

    // Clear old features
    vectorSourceRef.current.clear();

    const centerCoord = fromLonLat([lon, lat]);

    // Create marker feature
    const marker = new Feature({
      geometry: new Point(centerCoord)
    });

    vectorSourceRef.current.addFeature(marker);

    // Animate map to location
    if (map) {
      map.getView().animate({
        center: centerCoord,
        zoom: 18,
        duration: 1000
      });
      // Close the clicked coordinate popup if it's open
      setClickedCoord(null);
      if (popupOverlayRef.current) {
        popupOverlayRef.current.setPosition(undefined);
      }
    }
  };

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
          // 3. Layer สำหรับวาดหมุด Splitter
          new VectorLayer({
            source: vectorSourceRef.current,
            style: new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({
                  color: '#3B82F6', // Blue for Splitter
                }),
                stroke: new Stroke({
                  color: '#ffffff',
                  width: 3,
                }),
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
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 shrink-0 flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-[#042C53] flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              แผนที่ดาวเทียมระบุพิกัด Splitter
            </h3>
            <p className="text-xs text-slate-500 mt-1">ค้นหาและแสดงตำแหน่ง Splitter</p>
          </div>

          {/* Search Splitter Input */}
          <form onSubmit={handleSearchSplitter} className="flex items-start gap-2 relative">
            <div className="flex flex-col">
              <input
                type="text"
                placeholder="พิกัด: 13.75, 100.50"
                value={splitterInput}
                onChange={(e) => {
                  setSplitterInput(e.target.value);
                  if (searchError) setSearchError('');
                }}
                className={`px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 w-[220px] transition-colors ${
                  searchError ? 'border-red-300 focus:ring-red-200 bg-red-50' : 'border-slate-200 focus:ring-brand-100 focus:border-brand-400'
                }`}
              />
              {searchError && (
                <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium whitespace-nowrap">
                  {searchError}
                </span>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              ค้นหา
            </button>
          </form>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-800">
          <div ref={mapRef} className="absolute inset-0 w-full h-full" />

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
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${clickedCoord.lat}, ${clickedCoord.lon}`);
                      alert('คัดลอกพิกัดเรียบร้อยแล้ว!');
                    }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors border border-slate-200"
                  >
                    คัดลอก
                  </button>
                  <button 
                    onClick={() => {
                      window.open(`https://earth.google.com/web/search/${clickedCoord.lat},+${clickedCoord.lon}`, '_blank');
                    }}
                    className="flex-[1.5] py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold rounded-lg transition-colors border border-blue-100 flex items-center justify-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Google Earth
                  </button>
                </div>
                
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