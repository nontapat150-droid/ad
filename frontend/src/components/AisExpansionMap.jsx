import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls, FullScreen } from 'ol/control';

export default function AisExpansionMap({ open, onClose }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);

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
        ],
        view: new View({
          center: fromLonLat([100.5018, 13.7563]), // Bangkok
          zoom: 6,
        }),
      });

      setMap(initialMap);
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
            <p className="text-sm text-slate-500 mt-1">OpenLayers Map</p>
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
        </div>
      </div>
    </>
  );
}
