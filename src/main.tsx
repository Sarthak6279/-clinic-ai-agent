import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode is intentionally removed: it double-invokes useEffect in dev,
// which permanently crashes the Web Speech API on Windows Chrome.
createRoot(document.getElementById('root')!).render(
  <App />
)
