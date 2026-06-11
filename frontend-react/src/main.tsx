import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/styles/globals.css'
import '@/styles/animations.css'
import '@/styles/utilities.css'
import App from './App.tsx'

// After a deploy, Vite chunk hashes change. If the browser has a stale main
// bundle cached, its dynamic import() calls will 404. Reload once to pick up
// the fresh index.html.
window.addEventListener('vite:preloadError', () => {
  const key = 'chunk-reload'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
