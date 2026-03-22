import {
  ApartmentOutlined,
  AppstoreOutlined,
  CloudUploadOutlined,
  FileProtectOutlined,
  SettingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import type { BreadcrumbProps, MenuProps } from 'antd'
import { Avatar, Breadcrumb, Dropdown, Layout, Menu, Space, Tag } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { adminTheme } from '../theme/adminTheme'
import './AdminLayout.css'

dayjs.locale('fr')

const { Header, Sider, Content } = Layout

type MenuItem = Required<MenuProps>['items'][number]

function PayslipSidebarLogoMark() {
  return (
    <svg
      className="admin-sider-logo-svg"
      width={32}
      height={32}
      viewBox="0 0 32 32"
      aria-hidden
    >
      <circle cx={16} cy={16} r={12} fill={adminTheme.tealLight} />
      <text
        x={9.5}
        y={21.5}
        fill={adminTheme.white}
        fontSize={14}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      >
        P
      </text>
      <rect
        x={19}
        y={11}
        width={2.5}
        height={10}
        rx={1.25}
        fill={adminTheme.orange}
      />
      <circle cx={20.25} cy={9} r={2} fill={adminTheme.orange} />
    </svg>
  )
}

const topMenuSelectableKeys = new Set([
  '/',
  '/employees',
  '/payslips',
  '/payslips/upload',
  '/orgchart',
  '/audit',
])

/** Entrées plates : chaque clé est une route (les sous-menus sans route ne déclenchent pas `navigate`). */
const topMenuItems: MenuItem[] = [
  { key: '/', icon: <AppstoreOutlined />, label: 'Dashboard' },
  { key: '/employees', icon: <TeamOutlined />, label: 'Collaborateurs' },
  {
    key: '/payslips',
    icon: <FileProtectOutlined />,
    label: 'Bulletins',
  },
  {
    key: '/payslips/upload',
    icon: <CloudUploadOutlined />,
    label: 'Upload',
  },
  {
    key: '/orgchart',
    icon: <ApartmentOutlined />,
    label: 'Organigramme',
  },
  { key: '/audit', icon: <UnorderedListOutlined />, label: 'Logs' },
]

const settingsMenuItem: MenuItem = {
  key: '/settings',
  icon: <SettingOutlined />,
  label: 'Paramètres',
}

function pageHeaderForPath(pathname: string): { title: string; subtitle?: string } {
  const p = pathname === '' ? '/' : pathname
  if (p === '/') {
    return { title: 'Dashboard', subtitle: 'Vue d’ensemble' }
  }
  if (p.startsWith('/employees/import')) {
    return { title: 'Import', subtitle: 'Collaborateurs' }
  }
  if (p.startsWith('/employees')) {
    return { title: 'Collaborateurs' }
  }
  if (p.startsWith('/payslips/upload')) {
    return { title: 'Upload', subtitle: 'Bulletins de paie' }
  }
  if (p.startsWith('/payslips')) {
    return { title: 'Bulletins' }
  }
  if (p.startsWith('/orgchart') || p.startsWith('/organization')) {
    return { title: 'Organigramme' }
  }
  if (p.startsWith('/audit')) {
    return { title: 'Journal d’activité', subtitle: 'Historique des actions' }
  }
  if (p.startsWith('/settings')) {
    return { title: 'Paramètres' }
  }
  return { title: 'PaySlip Manager' }
}

/**
 * Fil d’Ariane = uniquement les ancêtres (liens), pas la page courante :
 * le titre de la page est déjà affiché dans le `h1` du header.
 */
function breadcrumbItemsForPath(
  pathname: string,
): NonNullable<BreadcrumbProps['items']> {
  const p = pathname === '' ? '/' : pathname

  const dash: NonNullable<BreadcrumbProps['items']>[number] = {
    title: <Link to="/">Dashboard</Link>,
  }

  if (p === '/') {
    return []
  }

  if (p.startsWith('/employees/import')) {
    return [
      dash,
      { title: <Link to="/employees">Collaborateurs</Link> },
    ]
  }
  if (p.startsWith('/employees')) {
    return [dash]
  }
  if (p.startsWith('/payslips/upload')) {
    return [
      dash,
      { title: <Link to="/payslips">Bulletins</Link> },
    ]
  }
  if (p.startsWith('/payslips')) {
    return [dash]
  }
  if (p.startsWith('/orgchart') || p.startsWith('/organization')) {
    return [dash]
  }
  if (p.startsWith('/audit')) {
    return [dash]
  }
  if (p.startsWith('/settings')) {
    return [dash]
  }

  return [dash]
}

function selectedMenuKey(pathname: string): string {
  if (pathname.startsWith('/settings')) {
    return '/settings'
  }
  if (pathname.startsWith('/audit')) {
    return '/audit'
  }
  if (pathname.startsWith('/orgchart') || pathname.startsWith('/organization')) {
    return '/orgchart'
  }
  if (pathname.startsWith('/payslips/upload')) {
    return '/payslips/upload'
  }
  if (pathname.startsWith('/payslips')) {
    return '/payslips'
  }
  if (pathname.startsWith('/employees')) {
    return '/employees'
  }
  return '/'
}

function adminInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const a = firstName?.trim()?.[0] ?? ''
  const b = lastName?.trim()?.[0] ?? ''
  const pair = `${a}${b}`.toUpperCase()
  if (pair.length > 0) {
    return pair
  }
  const e = email?.trim()?.[0]
  return e != null ? e.toUpperCase() : '?'
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const menuKey = useMemo(
    () => selectedMenuKey(location.pathname),
    [location.pathname],
  )

  const topSelectedKeys = useMemo(
    () => (topMenuSelectableKeys.has(menuKey) ? [menuKey] : []),
    [menuKey],
  )

  const settingsSelectedKeys = useMemo(
    () => (menuKey === '/settings' ? ['/settings'] : []),
    [menuKey],
  )

  const { title: headerTitle, subtitle: headerSubtitle } = useMemo(
    () => pageHeaderForPath(location.pathname),
    [location.pathname],
  )

  const headerBreadcrumbItems = useMemo(
    () => breadcrumbItemsForPath(location.pathname),
    [location.pathname],
  )

  const periodChip = useMemo(() => {
    const raw = dayjs().format('MMMM YYYY')
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }, [])

  const userMenu: MenuProps['items'] = [
    { key: 'logout', label: 'Déconnexion', danger: true },
  ]

  const onUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      void logout()
      navigate('/login', { replace: true })
    }
  }

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('/')) {
      navigate(key)
    }
  }

  const initials = adminInitials(
    user?.firstName,
    user?.lastName,
    user?.email,
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className="admin-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        collapsedWidth={56}
        theme="dark"
        trigger={null}
      >
        <div
          className={`admin-sider-brand${collapsed ? ' admin-sider-brand--collapsed' : ''}`}
        >
          <div className="admin-sider-logo-mark">
            <PayslipSidebarLogoMark />
          </div>
          {!collapsed ? (
            <span className="admin-sider-logo-text">PaySlip Manager</span>
          ) : null}
        </div>
        <div className="admin-sider-menu-column">
          <Menu
            className="admin-sider-menu admin-sider-menu-top"
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={topSelectedKeys}
            items={topMenuItems}
            onClick={onMenuClick}
          />
          <Menu
            className="admin-sider-menu admin-sider-menu-bottom"
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={settingsSelectedKeys}
            items={[settingsMenuItem]}
            onClick={onMenuClick}
          />
        </div>
        <button
          type="button"
          className="admin-sider-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Étendre le menu' : 'Réduire le menu'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </Sider>
      <Layout>
        <Header className="admin-layout-header">
          <div className="admin-layout-header-left">
            {headerBreadcrumbItems.length > 0 ? (
              <Breadcrumb
                className="admin-layout-breadcrumb"
                separator=">"
                items={headerBreadcrumbItems}
              />
            ) : null}
            <h1 className="admin-layout-header-title">{headerTitle}</h1>
            {headerSubtitle != null && headerSubtitle !== '' ? (
              <p className="admin-layout-header-subtitle">{headerSubtitle}</p>
            ) : null}
          </div>
          <Space size="middle" className="admin-layout-header-right">
            <Tag className="admin-period-chip">{periodChip}</Tag>
            <Dropdown
              menu={{ items: userMenu, onClick: onUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space
                size={8}
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
                <Avatar
                  size={32}
                  style={{
                    backgroundColor: adminTheme.teal,
                    color: adminTheme.white,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {initials}
                </Avatar>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
