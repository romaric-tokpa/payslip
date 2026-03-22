import {
  BarChartOutlined,
  BookOutlined,
  BuildOutlined,
  HomeOutlined,
  LockOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Dropdown, Layout, Menu, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatedMainOutlet } from '../components/transitions/RouteTransitions'
import { SUPER_ADMIN_BASE } from '../constants/adminRoutes'
import { useAuth } from '../contexts/AuthContext'
import appIconUrl from '../assets/app_icon.svg?url'
import './SuperAdminLayout.css'

const { Sider, Content } = Layout

const SA = SUPER_ADMIN_BASE

export function SuperAdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const selectedKeys = useMemo(() => {
    const p = location.pathname
    if (p === SA || p === `${SA}/`) {
      return [SA]
    }
    if (p.startsWith(`${SA}/companies`)) {
      return [`${SA}/companies`]
    }
    if (p.startsWith(`${SA}/audit`)) {
      return [`${SA}/audit`]
    }
    if (p.startsWith(`${SA}/growth`)) {
      return [`${SA}/growth`]
    }
    if (p.startsWith(`${SA}/security`)) {
      return []
    }
    return [SA]
  }, [location.pathname])

  const menuItems = useMemo(
    () =>
      [
        { key: SA, icon: <HomeOutlined />, label: 'Dashboard' },
        { key: `${SA}/companies`, icon: <BuildOutlined />, label: 'Entreprises' },
        { key: `${SA}/audit`, icon: <BookOutlined />, label: 'Audit global' },
        {
          key: `${SA}/growth`,
          icon: <BarChartOutlined />,
          label: 'Croissance',
        },
      ] satisfies MenuProps['items'],
    [],
  )

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (typeof key === 'string' && key.startsWith('/')) {
      navigate(key)
    }
  }

  const onLogout = () => {
    void logout()
    navigate('/login', { replace: true })
  }

  const userMenuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'password',
        icon: <LockOutlined />,
        label: 'Changer le mot de passe',
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Déconnexion',
        danger: true,
      },
    ],
    [],
  )

  const onUserMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.stopPropagation()
    if (key === 'password') {
      navigate(`${SA}/security`)
    }
    if (key === 'logout') {
      onLogout()
    }
  }

  const sideWidth = collapsed ? 80 : 240

  return (
    <Layout className="sa-root">
      <Sider
        className="sa-sider"
        width={240}
        collapsedWidth={80}
        collapsed={collapsed}
        theme="dark"
        trigger={null}
      >
        <div className="sa-brand">
          {!collapsed ? (
            <>
              <h1 className="sa-brand__title">PaySlip Manager</h1>
              <Tag color="#F28C28" className="sa-brand__badge">
                Admin
              </Tag>
            </>
          ) : (
            <Tag color="#F28C28" className="sa-brand__badge">
              A
            </Tag>
          )}
        </div>
        <Menu
          className="sa-menu"
          theme="dark"
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={onMenuClick}
        />
        <button
          type="button"
          className="sa-collapse-toggle"
          aria-label={collapsed ? 'Étendre le menu' : 'Réduire le menu'}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '»' : '«'}
        </button>
        <div className="sa-footer">
          <Dropdown
            menu={{ items: userMenuItems, onClick: onUserMenuClick }}
            trigger={['click']}
            placement="topLeft"
            overlayClassName="sa-footer-user-dropdown"
          >
            <button
              type="button"
              className="sa-footer__user sa-footer__user--clickable"
              aria-label="Menu compte : mot de passe et déconnexion"
            >
              <img
                src={appIconUrl}
                alt="Logo PaySlip"
                width={collapsed ? 32 : 40}
                height={collapsed ? 32 : 40}
                className={
                  collapsed
                    ? 'sa-footer__logo sa-footer__logo--collapsed'
                    : 'sa-footer__logo'
                }
                decoding="async"
              />
              {!collapsed ? (
                <div className="sa-footer__meta">
                  <div className="sa-footer__name">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="sa-footer__role">Super Admin</div>
                </div>
              ) : null}
            </button>
          </Dropdown>
        </div>
      </Sider>
      <Layout className="sa-main" style={{ marginLeft: sideWidth }}>
        <Content className="sa-main-inner">
          <AnimatedMainOutlet />
        </Content>
      </Layout>
    </Layout>
  )
}
