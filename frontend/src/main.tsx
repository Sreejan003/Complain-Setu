import './i18n/i18n.css';
import { i18nReady } from "./i18n/index.js";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

i18nReady.then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
));
