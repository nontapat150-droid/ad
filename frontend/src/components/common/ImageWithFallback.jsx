import React, { useState, useEffect } from 'react';
import { getPossibleImageUrls } from '../../utils/imageUtils';

export default function ImageWithFallback({ img, defaultFolder, alt, className, onClick, ...props }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const urls = getPossibleImageUrls(img, defaultFolder);

  // Reset index when image changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [img]);

  if (!urls || urls.length === 0) {
    return <div className={`bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-bold ${className}`}>ไม่มีภาพ</div>;
  }

  const handleError = () => {
    if (currentIndex < urls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleClick = (e) => {
    if (onClick) {
      // Pass the working URL and the event
      onClick(urls[currentIndex], e);
    }
  };

  return (
    <img
      src={urls[currentIndex]}
      alt={alt || "Image"}
      className={className}
      onError={handleError}
      onClick={handleClick}
      {...props}
    />
  );
}
