import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadCounterView } from './fluid/client.ts'

const view = await loadCounterView()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App counter={view.root} />
  </StrictMode>,
)
