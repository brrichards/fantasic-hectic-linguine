import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Root } from './Root.tsx'

// Location never lives in the URL; drop anything an old link left there.
if (location.hash) history.replaceState(null, '', location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root connect={async (userName) => (await import('./fluid/client.ts')).connect(userName)} />
  </StrictMode>,
)
