import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CatToastProvider } from './context/CatToastContext'
import { CelebrationProvider } from './context/CelebrationContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CelebrationProvider>
        <CatToastProvider>
          <App />
        </CatToastProvider>
      </CelebrationProvider>
    </ThemeProvider>
  </StrictMode>,
)