import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { getImageUrl } from '../utils/imageUtils';

const BrandingContext = createContext();

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({
    website_name: 'Bount ระบบจัดการงาน',
    website_logo: null,
    website_favicon: null,
    admin_phone: null,
    admin_line: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const res = await api.get('/settings/global');
      setBranding(res.data);
    } catch (err) {
      console.error('Failed to fetch branding settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  useEffect(() => {
    if (branding.website_name) {
      document.title = branding.website_name;
    }
    if (branding.website_favicon) {
      const fullUrl = getImageUrl(branding.website_favicon, 'branding');

      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = fullUrl;
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, fetchBranding, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
