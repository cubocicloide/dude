import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Table, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/$hooks'
import { formatDateTime } from '@/utils'
import { $get as getUsers } from '@/openapi/api/users'
import type { User } from './types'

const { Text } = Typography

export default function UsersPage() {
  usePageTitle('Users')
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  if (isError) {
    return <Alert type="error" showIcon message="Could not load users" />
  }

  return (
    <Card title="Users">
      <Table<User>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        onRow={(user) => ({
          onClick: () => navigate(`/users/${user.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Full name',
            dataIndex: 'full_name',
            render: (value: User['full_name']) => value ?? <Text type="secondary">—</Text>,
          },
          {
            title: 'Status',
            dataIndex: 'is_active',
            width: 120,
            render: (value: User['is_active']) =>
              value ? <Tag color="green">active</Tag> : <Tag>inactive</Tag>,
          },
          {
            title: 'Created',
            dataIndex: 'created_at',
            render: (value: User['created_at']) => formatDateTime(value),
          },
        ]}
      />
    </Card>
  )
}
