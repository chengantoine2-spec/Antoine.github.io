import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { SkinProvider } from './hooks/useSkin'
import { WindowsProvider } from './hooks/useWindows'
import './styles/tokens.css'
import './styles/globals.css'

const container = document.getElementById('root')
if (!container) throw new Error('缺少 #root 挂载点')

createRoot(container).render(
  <StrictMode>
    <SkinProvider>
      <WindowsProvider>
        <RouterProvider router={router} />
      </WindowsProvider>
    </SkinProvider>
  </StrictMode>,
)
