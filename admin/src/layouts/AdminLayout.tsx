import {
  AuditOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import {
  Avatar,
  Breadcrumb,
  Dropdown,
  Layout,
  Menu,
  Space,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AdminLayout.css'

const { Header, Sider, Content } = Layout

const TEAL = '#0F5C5E'

type MenuItem = Required<MenuProps>['items'][number]

const menuItems: MenuItem[] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/employees',
    icon: <TeamOutlined />,
    label: 'Collaborateurs',
  },
  {
    key: '/payslips',
    icon: <FileProtectOutlined />,
    label: 'Bulletins de paie',
  },
  {
    key: '/audit',
    icon: <AuditOutlined />,
    label: "Logs d'audit",
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: 'Paramètres',
  },
]

function selectedMenuKey(pathname: string): string {
  if (pathname.startsWith('/payslips')) {
    return '/payslips'
  }
  if (pathname.startsWith('/employees')) {
    return '/employees'
  }
  if (pathname.startsWith('/audit')) {
    return '/audit'
  }
  if (pathname.startsWith('/settings')) {
    return '/settings'
  }
  return '/'
}

function breadcrumbItemsFor(pathname: string) {
  const normalized = pathname === '' ? '/' : pathname
  if (normalized === '/') {
    return [{ title: 'Dashboard' }]
  }

  const segments = normalized.split('/').filter(Boolean)
  const labels: Record<string, string> = {
    employees: 'Collaborateurs',
    payslips: 'Bulletins de paie',
    upload: 'Téléverser',
    audit: "Logs d'audit",
    settings: 'Paramètres',
  }

  const items: { title: string }[] = [{ title: 'Accueil' }]
  for (const seg of segments) {
    items.push({ title: labels[seg] ?? seg })
  }
  return items
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const selectedKey = useMemo(
    () => [selectedMenuKey(location.pathname)],
    [location.pathname],
  )

  const crumbs = useMemo(
    () => breadcrumbItemsFor(location.pathname),
    [location.pathname],
  )

  const displayName =
    user?.firstName || user?.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user?.email ?? 'Admin'

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      label: 'Déconnexion',
      danger: true,
    },
  ]

  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      void logout()
      navigate('/login', { replace: true })
    }
  }

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className="admin-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        theme="dark"
      >
        <Typography.Title level={5} className="admin-sider-logo">
          PaySlip Manager
        </Typography.Title>
        <Menu
          className="admin-sider-menu"
          theme="dark"
          mode="inline"
          selectedKeys={selectedKey}
          items={menuItems}
          onClick={onMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Breadcrumb items={crumbs} />
          <Dropdown
            menu={{ items: userMenu, onClick: onUserMenuClick }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Space
              size="middle"
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  ;(e.target as HTMLElement).click()
                }
              }}
            >
              <span style={{ color: TEAL, fontWeight: 500 }}>{displayName}</span>
              <Avatar
                style={{ backgroundColor: TEAL }}
                icon={<UserOutlined />}
              />
            </Space>
          </Dropdown>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
