import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RouterConfig } from './router'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfigProvider
          locale={frFR}
          theme={{
            token: {
              colorPrimary: '#0F5C5E',
              colorLink: '#0F5C5E',
              borderRadius: 8,
              colorBgLayout: '#F4F6F6',
              fontSize: 15,
              fontSizeLG: 16,
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
