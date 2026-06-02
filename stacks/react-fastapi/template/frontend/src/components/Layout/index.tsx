import { useState } from 'react'
import { Layout as AntLayout, Menu, Typography } from 'antd'
import { HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Sider, Header, Content } = AntLayout
const { Text } = Typography

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
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '0 12px',
          }}
        >
          {!collapsed && (
            <Text strong style={{ color: 'white', fontSize: 15, whiteSpace: 'nowrap' }}>
              {APP_TITLE}
            </Text>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: 'home',
              icon: <HomeOutlined />,
              label: 'Home',
              onClick: () => navigate('/'),
            },
          ]}
        />
      </Sider>

      <AntLayout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
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
          <Text style={{ fontSize: 15, fontWeight: 500 }}>{APP_TITLE}</Text>
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
