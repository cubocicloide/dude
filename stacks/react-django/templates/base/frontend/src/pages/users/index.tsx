import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Table, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/$hooks'
import { formatDateTime } from '@/utils'
import { $get as getUsers } from '@/openapi/api/users'
import type { User } from './types'

const { Text } = Typography

export default function UsersPage() {
  usePageTitle('Users')
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({}),
  })

  if (isError) {
    return <Alert type="error" showIcon message="Could not load users" />
  }

  return (
    <Card title="Users">
      <Table<User>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.results ?? []}
        onRow={(user) => ({
          onClick: () => navigate(`/users/${user.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Username', dataIndex: 'username' },
          {
            title: 'Email',
            dataIndex: 'email',
            render: (value: User['email']) => value || <Text type="secondary">—</Text>,
          },
          {
            title: 'Name',
            render: (_, user) =>
              [user.first_name, user.last_name].filter(Boolean).join(' ') || (
                <Text type="secondary">—</Text>
              ),
          },
          {
            title: 'Joined',
            dataIndex: 'date_joined',
            render: (value: User['date_joined']) => formatDateTime(value),
          },
        ]}
      />
    </Card>
  )
}
