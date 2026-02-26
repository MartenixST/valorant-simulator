import React from 'react';

const CareerLoadingOverlay = ({ message = 'Simulating Week...' }) => {
  return (
    <div id="loadingOverlay" className="loading-overlay">
      <div className="loading-spinner"></div>
      <div className="loading-message">{message}</div>
    </div>
  );
};

export default CareerLoadingOverlay;