import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CelebrationProvider } from './context/CelebrationContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CelebrationProvider>
        <App />
      </CelebrationProvider>
    </ThemeProvider>
  </StrictMode>,
)