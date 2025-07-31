import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './patriotic-styles.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // In development, unregister all service workers to prevent caching
    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
          console.log('Service worker unregistered for development');
        });
      });
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
            console.log(`Cache ${name} deleted`);
          });
        });
      }
    } else {
      // Only register service worker in production
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service worker registered:', registration);
        })
        .catch(error => {
          console.error('Service worker registration failed:', error);
        });
    }
  });
}