import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Remove React StrictMode for Push Chain SDK compatibility
// StrictMode causes double-rendering which can interfere with wallet connections
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <App />
);

// Optional: Add performance monitoring
// Learn more: https://bit.ly/CRA-vitals
const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

// Report web vitals to console in development
if (process.env.NODE_ENV === 'development') {
  reportWebVitals(console.log);
}

// Service Worker for PWA (optional)
// Uncomment to enable PWA features
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
*/
