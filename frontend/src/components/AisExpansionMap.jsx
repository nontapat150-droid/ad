import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Icon, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import api from '../api/axios';

export default function AisExpansionMap({ open, onClose }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const vectorSourceRef = useRef(new VectorSource());

  // Fetch jobs data when drawer opens
  useEffect(() => {
    if (open) {
      fetchJobs();
    }
  }, [open]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Fetching all pending jobs to show on map
      const res = await api.get('/dispatch/jobs?status=pending');
      setJobs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch jobs for map', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!open) return;

    if (!mapRef.current) return;

    // Initialize map only once
    if (!map) {
      const initialMap = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          new VectorLayer({
            source: vectorSourceRef.current,
            style: new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: '#ef4444' }),
                stroke: new Stroke({ color: '#ffffff', width: 2 }),
              }),
            }),
          }),
        ],
        view: new View({
          center: fromLonLat([100.5018, 13.7563]), // Default to Bangkok
          zoom: 6,
        }),
      });

      setMap(initialMap);

      // Add click event for popup (optional improvement)
      initialMap.on('singleclick', function (evt) {
        const feature = initialMap.forEachFeatureAtPixel(evt.pixel, function (feature) {
          return feature;
        });
        if (feature) {
          const props = feature.getProperties();
          // Ideally you would show a popup here. For now, we can log or show an alert.
          // SweetAlert or a custom overlay could be used.
        }
      });
    }

    return () => {
      if (map) {
        map.setTarget(null);
        setMap(null);
      }
    };
  }, [open]); // Re-initialize map when open changes to handle DOM rendering correctly

  // Update features when jobs change
  useEffect(() => {
    if (jobs.length > 0 && map) {
      vectorSourceRef.current.clear();
      const features = [];

      jobs.forEach((job) => {
        if (job.lat && job.lng) {
          const lat = parseFloat(job.lat);
          const lng = parseFloat(job.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            const feature = new Feature({
              geometry: new Point(fromLonLat([lng, lat])),
              jobId: job.id,
              customer: job.customer,
              accessNo: job.access_no,
            });
            features.push(feature);
          }
        }
      });

      if (features.length > 0) {
        vectorSourceRef.current.addFeatures(features);
        
        // Fit map to extent of features
        const extent = vectorSourceRef.current.getExtent();
        if (extent && extent[0] !== Infinity) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16, duration: 1000 });
        }
      }
    }
  }, [jobs, map]);

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
            <p className="text-sm text-slate-500 mt-1">แสดงตำแหน่งบ้าน/จุดติดตั้งที่รอการดำเนินการ</p>
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

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                <span className="text-brand-700 font-medium bg-white/80 px-3 py-1 rounded-full shadow-sm">กำลังโหลดข้อมูลพิกัด...</span>
              </div>
            </div>
          )}

          {/* Map Info Badge */}
          <div className="absolute bottom-6 left-6 z-10 bg-white/90 backdrop-blur shadow-lg rounded-2xl p-4 border border-white/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ตำแหน่งทั้งหมด</p>
                <p className="text-2xl font-black text-[#042C53] leading-none mt-1">{jobs.filter(j => j.lat && j.lng).length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
