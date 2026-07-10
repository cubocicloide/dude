import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Spin, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '@/$hooks'
import { formatDateTime } from '@/utils'
import { $get as getUser } from '@/openapi/api/users/[id]'

const { Text } = Typography

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

  const dash = <Text type="secondary">—</Text>

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
          <Descriptions.Item label="Username">{user.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email || dash}</Descriptions.Item>
          <Descriptions.Item label="First name">{user.first_name || dash}</Descriptions.Item>
          <Descriptions.Item label="Last name">{user.last_name || dash}</Descriptions.Item>
          <Descriptions.Item label="Joined">{formatDateTime(user.date_joined)}</Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}
