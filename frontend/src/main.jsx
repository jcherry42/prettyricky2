import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/motion.css'
import { installNetworkInstrumentation } from './utils/networkInstrumentation';

// Install early so iOS WebView/Capacitor failures are captured
installNetworkInstrumentation();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
