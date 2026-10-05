import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AppearanceProvider } from './hooks/useAppearance'
import { DockProvider } from './hooks/useDock'
import { TabsProvider } from './hooks/useTabs'
import { WindowsProvider } from './hooks/useWindows'
import './styles/tokens.css'
import './styles/globals.css'

const container = document.getElementById('root')
if (!container) throw new Error('缺少 #root 挂载点')

createRoot(container).render(
  <StrictMode>
    <AppearanceProvider>
      <DockProvider>
        <TabsProvider>
          <WindowsProvider>
            <RouterProvider router={router} />
          </WindowsProvider>
        </TabsProvider>
      </DockProvider>
    </AppearanceProvider>
  </StrictMode>,
)
