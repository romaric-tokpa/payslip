import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RouterConfig } from './router'

const TEAL = '#0F5C5E'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfigProvider
          locale={frFR}
          theme={{
            token: {
              colorPrimary: TEAL,
              colorLink: TEAL,
              borderRadius: 8,
            },
          }}
        >
          <AntdApp>
            <RouterConfig />
          </AntdApp>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
