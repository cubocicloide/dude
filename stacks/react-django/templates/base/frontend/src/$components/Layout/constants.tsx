import { HomeOutlined, TeamOutlined } from '@ant-design/icons'
import type { MenuEntry } from './types'

/** Sidebar navigation — one entry per top-level route. */
export const MENU_ITEMS: MenuEntry[] = [
  { key: 'home', label: 'Home', icon: <HomeOutlined />, path: '/' },
  { key: 'users', label: 'Users', icon: <TeamOutlined />, path: '/users' },
]
