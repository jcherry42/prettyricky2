import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/motion.css'
import { installNetworkInstrumentation } from './utils/networkInstrumentation';

// Install early so iOS WebView/Capacitor failures are captured
installNetworkInstrumentation();

// IMPORTANT: /mobile is used to host the exported Expo (React Native) web build.
// Vite dev server will otherwise serve the main SPA index.html for /mobile/, so we redirect.
if (
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/mobile') &&
  !window.location.pathname.endsWith('/index.html') &&
  !window.location.pathname.includes('/_expo/') &&
  !window.location.pathname.includes('/assets/')
) {
  const target = '/mobile/index.html' + window.location.search + window.location.hash;
  window.location.replace(target);
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
