import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { BrowserRouter } from 'react-router-dom'
import { ImpersonationMessageListener } from './components/ImpersonationMessageListener'
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
              fontSize: 17,
              fontSizeLG: 19,
              fontSizeSM: 14,
              fontSizeXL: 22,
              fontSizeHeading1: 40,
              fontSizeHeading2: 30,
              fontSizeHeading3: 24,
              fontSizeHeading4: 20,
              fontSizeHeading5: 17,
            },
          }}
        >
          <AntdApp>
            <ImpersonationMessageListener />
            <RouterConfig />
          </AntdApp>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
