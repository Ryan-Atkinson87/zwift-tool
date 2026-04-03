import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import { App } from './App.tsx'
import { initialiseSentry } from './sentry.ts'

// Initialise Sentry before rendering so it captures errors from first paint
initialiseSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
