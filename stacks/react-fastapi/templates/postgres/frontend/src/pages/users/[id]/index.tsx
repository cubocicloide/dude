import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Spin, Tag } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '@/$hooks'
import { formatDateTime } from '@/utils'
import { $get as getUser } from '@/openapi/api/users/[id]'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  usePageTitle(`User ${id ?? ''}`)
  const navigate = useNavigate()

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUser(id!),
    enabled: id != null,
  })

  return (
    <Card
      title={`User ${id ?? ''}`}
      extra={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          Back to users
        </Button>
      }
    >
      {isLoading ? (
        <Spin />
      ) : isError || !user ? (
        <Alert type="error" showIcon message="User not found" />
      ) : (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Full name">{user.full_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            {user.is_active ? <Tag color="green">active</Tag> : <Tag>inactive</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Created">{formatDateTime(user.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Updated">{formatDateTime(user.updated_at)}</Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}
