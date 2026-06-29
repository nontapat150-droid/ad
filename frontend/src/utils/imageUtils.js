import api from '../api/axios';

/**
 * Robustly resolve image URLs. 
 * Handles full HTTP URLs, absolute paths starting with /uploads, and plain filenames.
 */
export const getImageUrl = (img, folder = 'misc') => {
  if (!img) return '';
  if (img.startsWith('http')) return img;
  if (img.startsWith('/uploads/')) return `${api.defaults.baseURL.replace('/api', '')}${img}`;
  return `${api.defaults.baseURL.replace('/api', '')}/uploads/${folder}/${img}`;
};
