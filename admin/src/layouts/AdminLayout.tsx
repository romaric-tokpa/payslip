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
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatedMainOutlet } from '../components/transitions/RouteTransitions'
import { ADMIN_BASE } from '../constants/adminRoutes'
import { useAuth } from '../contexts/AuthContext'
import { adminTheme } from '../theme/adminTheme'
import './AdminLayout.css'

dayjs.locale('fr')

const { Header, Sider, Content } = Layout

/** Aligné sur `width` / `collapsedWidth` du Sider — marge du contenu quand le Sider est `position: fixed`. */
const SIDER_EXPANDED_PX = 220
const SIDER_COLLAPSED_PX = 56

type MenuItem = Required<MenuProps>['items'][number]

const D = ADMIN_BASE

const topMenuSelectableKeys = new Set([
  D,
  `${D}/employees`,
  `${D}/payslips`,
  `${D}/payslips/upload`,
  `${D}/orgchart`,
  `${D}/audit`,
])

/** Entrées plates : chaque clé est une route (les sous-menus sans route ne déclenchent pas `navigate`). */
const topMenuItems: MenuItem[] = [
  { key: D, icon: <AppstoreOutlined />, label: 'Dashboard' },
  { key: `${D}/employees`, icon: <TeamOutlined />, label: 'Collaborateurs' },
  {
    key: `${D}/payslips`,
    icon: <FileProtectOutlined />,
    label: 'Bulletins',
  },
  {
    key: `${D}/payslips/upload`,
    icon: <CloudUploadOutlined />,
    label: 'Upload',
  },
  {
    key: `${D}/orgchart`,
    icon: <ApartmentOutlined />,
    label: 'Organigramme',
  },
  { key: `${D}/audit`, icon: <UnorderedListOutlined />, label: 'Logs' },
]

const settingsMenuItem: MenuItem = {
  key: `${D}/settings`,
  icon: <SettingOutlined />,
  label: 'Paramètres',
}

/** Chemin logique sous `/dashboard` (ex. `/employees`) pour titres et fil d’Ariane. */
function adminRelativePath(pathname: string): string {
  if (pathname === D || pathname === `${D}/`) {
    return '/'
  }
  if (pathname.startsWith(`${D}/`)) {
    return pathname.slice(D.length)
  }
  return pathname
}

function pageHeaderForPath(pathname: string): { title: string; subtitle?: string } {
  const p = adminRelativePath(pathname)
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
  const p = adminRelativePath(pathname)

  const dash: NonNullable<BreadcrumbProps['items']>[number] = {
    title: <Link to={D}>Dashboard</Link>,
  }

  if (p === '/') {
    return []
  }

  if (p.startsWith('/employees/import')) {
    return [
      dash,
      { title: <Link to={`${D}/employees`}>Collaborateurs</Link> },
    ]
  }
  if (p.startsWith('/employees')) {
    return [dash]
  }
  if (p.startsWith('/payslips/upload')) {
    return [
      dash,
      { title: <Link to={`${D}/payslips`}>Bulletins</Link> },
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
  if (pathname.startsWith(`${D}/settings`)) {
    return `${D}/settings`
  }
  if (pathname.startsWith(`${D}/audit`)) {
    return `${D}/audit`
  }
  if (
    pathname.startsWith(`${D}/orgchart`) ||
    pathname.startsWith(`${D}/organization`)
  ) {
    return `${D}/orgchart`
  }
  if (pathname.startsWith(`${D}/payslips/upload`)) {
    return `${D}/payslips/upload`
  }
  if (pathname.startsWith(`${D}/payslips`)) {
    return `${D}/payslips`
  }
  if (pathname.startsWith(`${D}/employees`)) {
    return `${D}/employees`
  }
  return D
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
    () => (menuKey === `${D}/settings` ? [`${D}/settings`] : []),
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

  const sideWidth = collapsed ? SIDER_COLLAPSED_PX : SIDER_EXPANDED_PX

  return (
    <Layout
      className="admin-root-layout"
      style={{
        minHeight: '100vh',
        ['--admin-sider-edge-px' as string]: `${sideWidth}px`,
      }}
    >
      <Sider
        className="admin-sider"
        collapsed={collapsed}
        width={SIDER_EXPANDED_PX}
        collapsedWidth={SIDER_COLLAPSED_PX}
        theme="dark"
        trigger={null}
      >
        <div
          className={`admin-sider-brand${collapsed ? ' admin-sider-brand--collapsed' : ''}`}
        >
          <img
            src="/logo-stacked-sider.svg"
            alt="PaySlip Manager"
            className="admin-sider-logo-stacked"
            width={180}
            height={155}
            decoding="async"
          />
        </div>
        <div className="admin-sider-menu-column">
          <div className="admin-sider-nav-label">Navigation</div>
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
      <Layout
        className="admin-layout-main"
        style={{ marginLeft: sideWidth }}
      >
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
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {initials}
                </Avatar>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-content admin-content--animated">
          <AnimatedMainOutlet />
        </Content>
      </Layout>
    </Layout>
  )
}
