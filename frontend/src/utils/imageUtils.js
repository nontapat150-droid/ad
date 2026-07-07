import api from '../api/axios';

/**
 * Robustly resolve image URLs. 
 * Handles full HTTP URLs, absolute paths starting with /uploads, and plain filenames.
 */
export const getImageUrl = (img, defaultFolder = 'misc') => {
  if (!img || typeof img !== 'string' || img === 'รับหน้างาน') return '';
  
  const cleanImg = img.trim();
  if (cleanImg.startsWith('http')) return cleanImg;
  

  const filename = cleanImg.split('/').pop();
  
  // Auto-detect folder by prefix
  let folder = defaultFolder ? (defaultFolder.endsWith('/') ? defaultFolder : `${defaultFolder}/`) : '';
  if (filename.startsWith('profiles_')) folder = 'profiles/';
  else if (filename.startsWith('misc_')) folder = 'misc/';
  else if (filename.startsWith('checkins_')) folder = 'checkins/';
  else if (filename.startsWith('checkouts_')) folder = 'checkouts/';
  else if (filename.startsWith('oil_receipts_')) folder = 'oil_receipts/';
  else if (filename.startsWith('branding_')) folder = 'branding/';
  
  let baseUrl = import.meta.env.VITE_API_URL || api.defaults.baseURL || '';
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Return the full URL
  return `${baseUrl}/uploads/${folder}${filename}`;
};

/**
 * Returns an array of possible URLs to try for an image.
 * This is used by ImageWithFallback to gracefully handle Nginx proxy differences.
 */
export const getPossibleImageUrls = (img, defaultFolder = 'misc') => {
  if (!img || typeof img !== 'string' || img === 'รับหน้างาน') return [];
  
  const cleanImg = img.trim();
  if (cleanImg.startsWith('http')) return [cleanImg];
  
  const filename = cleanImg.split('/').pop();
  
  let folder = defaultFolder ? (defaultFolder.endsWith('/') ? defaultFolder : `${defaultFolder}/`) : '';
  if (filename.startsWith('profiles_')) folder = 'profiles/';
  else if (filename.startsWith('misc_')) folder = 'misc/';
  else if (filename.startsWith('checkins_')) folder = 'checkins/';
  else if (filename.startsWith('checkouts_')) folder = 'checkouts/';
  else if (filename.startsWith('oil_receipts_')) folder = 'oil_receipts/';
  else if (filename.startsWith('branding_')) folder = 'branding/';
  
  let baseUrl = import.meta.env.VITE_API_URL || api.defaults.baseURL || '';
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  return [
    `${baseUrl}/uploads/${folder}${filename}`, // Try backend API path first
    `/uploads/${folder}${filename}` // Fallback to frontend static path
  ];
};
