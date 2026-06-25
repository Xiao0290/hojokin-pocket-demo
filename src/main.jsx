import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// デザインシステム（正本）のトークンを単一の真実として読み込む
import '../design-system/project/styles.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
