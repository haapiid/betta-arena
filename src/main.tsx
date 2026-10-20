import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// fight-poster type: Anton for headlines, Inter Tight for reading (self-hosted)
import '@fontsource/anton'
import '@fontsource-variable/inter-tight'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
