import { useState } from 'react'
import { Layout as AntLayout, Menu, Typography } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import logo from './$assets/logo.svg'
import { MENU_ITEMS } from './constants'

const { Sider, Header, Content } = AntLayout

const APP_TITLE = import.meta.env.VITE_APP_TITLE

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey =
    location.pathname === '/' ? 'home' : location.pathname.slice(1).split('/')[0] ?? 'home'

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={220}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 0 4px',
          }}
        >
          <img src={logo} alt={APP_TITLE} style={{ height: 28 }} />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ paddingTop: 12, borderRight: 0 }}
          items={MENU_ITEMS.map(({ key, label, icon, path }) => ({
            key,
            icon,
            label,
            onClick: () => navigate(path),
          }))}
        />
      </Sider>

      <AntLayout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {collapsed ? (
            <MenuUnfoldOutlined
              style={{ fontSize: 18, cursor: 'pointer', color: '#555' }}
              onClick={() => setCollapsed(false)}
            />
          ) : (
            <MenuFoldOutlined
              style={{ fontSize: 18, cursor: 'pointer', color: '#555' }}
              onClick={() => setCollapsed(true)}
            />
          )}
          <Typography.Title level={4} style={{ margin: 0 }}>
            {APP_TITLE}
          </Typography.Title>
        </Header>

        <Content style={{ margin: 0, padding: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
