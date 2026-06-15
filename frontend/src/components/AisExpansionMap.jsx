import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, transformExtent } from 'ol/proj';
import { defaults as defaultControls, FullScreen } from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSMXML from 'ol/format/OSMXML';
import { Style, Fill, Stroke } from 'ol/style';

export default function AisExpansionMap({ open, onClose }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [loadingHouses, setLoadingHouses] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);

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
    if (!open) return;

    if (!mapRef.current) return;

    // Initialize map only once
    if (!map) {
      const initialMap = new Map({
        target: mapRef.current,
        controls: defaultControls().extend([new FullScreen()]),
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          new VectorLayer({
            source: vectorSourceRef.current,
            style: new Style({
              stroke: new Stroke({
                color: 'rgba(239, 68, 68, 0.8)', // Red outline
                width: 2,
              }),
              fill: new Fill({
                color: 'rgba(239, 68, 68, 0.2)', // Light red fill
              }),
            }),
          }),
        ],
        view: new View({
          center: fromLonLat([100.5018, 13.7563]), // Bangkok
          zoom: 6,
        }),
      });

      setMap(initialMap);

      initialMap.on('moveend', () => {
        if (detectionEnabledRef.current) {
          loadBuildings(initialMap);
        }
      });
    }

    return () => {
      if (map) {
        map.setTarget(null);
        setMap(null);
      }
    };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[70] w-full md:w-[600px] lg:w-[800px] bg-white flex flex-col shadow-2xl transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-[#042C53] flex items-center gap-2">
              <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              ระบบงานขยาย AIS (แผนที่บ้าน)
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-sm text-slate-500">OpenLayers Map</p>
              
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
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Map Container */}
        <div className="flex-1 relative bg-slate-100">
          {open && (
            <div ref={mapRef} className="absolute inset-0 w-full h-full" />
          )}

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
        </div>
      </div>
    </>
  );
}
