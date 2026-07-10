import { useQuery } from '@tanstack/react-query'
import { Alert, Badge, Button, Card, Col, Row, Space, Typography } from 'antd'
import {
  CheckCircleOutlined,
  CodeOutlined,
  MinusOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { $get as getHealth } from '@/openapi/api/health'
import { useCounterStore } from '@/$hooks'
import { COMMANDS, GROUPS } from './constants'

const { Title, Paragraph, Text, Link } = Typography

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })
  const { count, increment, decrement, reset } = useCounterStore()

  const statusText = isLoading
    ? 'checking…'
    : isError
      ? 'unreachable'
      : (data?.status ?? 'unknown')
  const statusOk = !isLoading && !isError && data?.status === 'ok'

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Hero */}
      <Card>
        <Space align="start" size="large">
          <RocketOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Welcome to your dude project
            </Title>
            <Paragraph style={{ margin: '8px 0 0' }}>
              This app was scaffolded with{' '}
              <Link href="https://github.com/cubocicloide/dude" target="_blank">
                dude
              </Link>{' '}
              using the <Text code>react-django</Text> stack — React 19 + Vite + Django REST Framework + Docker
              Compose. Delete this page and start building your application.
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Backend health */}
        <Col xs={24} md={8}>
          <Card title="Backend health" loading={isLoading} style={{ height: '100%' }}>
            {statusOk ? (
              <Badge
                status="success"
                text={
                  <Text>
                    API is <Text strong>online</Text> — {statusText}
                  </Text>
                }
              />
            ) : (
              <Badge status={isLoading ? 'processing' : 'error'} text={statusText} />
            )}
          </Card>
        </Col>

        {/* Zustand store demo */}
        <Col xs={24} md={8}>
          <Card title="Zustand store" style={{ height: '100%' }}>
            <Space>
              <Button icon={<MinusOutlined />} onClick={decrement} aria-label="decrement" />
              <Text strong style={{ fontSize: 18, minWidth: 32, display: 'inline-block', textAlign: 'center' }}>
                {count}
              </Text>
              <Button icon={<PlusOutlined />} onClick={increment} aria-label="increment" />
              <Button onClick={reset}>Reset</Button>
            </Space>
            <Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
              Global state from <Text code>$hooks/useCounterStore</Text> — devtools enabled in dev.
            </Paragraph>
          </Card>
        </Col>

        {/* Quick links */}
        <Col xs={24} md={8}>
          <Card title={<><CodeOutlined /> Quick links</>} style={{ height: '100%' }}>
            <Space wrap size="middle">
              <Link href="/api/docs" target="_blank">
                API docs (Swagger)
              </Link>
              <Link href="/api/redoc" target="_blank">
                ReDoc
              </Link>
              <Link href="http://localhost:8001" target="_blank">
                Project docs (MkDocs)
              </Link>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Getting started */}
      <Card title={<><CheckCircleOutlined /> Getting started</>}>
        <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 2.2 }}>
          <li>
            <Text strong>Start the stack</Text> —{' '}
            <Text code>dude up --build</Text> from the project root
          </li>
          <li>
            <Text strong>Open the app</Text> —{' '}
            <Link href="http://localhost:5173" target="_blank">http://localhost:5173</Link> (frontend) ·{' '}
            <Link href="http://localhost:8000/api/docs" target="_blank">http://localhost:8000/api/docs</Link>{' '}
            (API)
          </li>
          <li>
            <Text strong>Make changes</Text> — edit{' '}
            <Text code>backend/</Text> or <Text code>frontend/src/</Text>; hot-reload is enabled
          </li>
          <li>
            <Text strong>Sync the API client</Text> — run{' '}
            <Text code>dude api sync</Text> after changing backend routes
          </li>
          <li>
            <Text strong>Run tests</Text> —{' '}
            <Text code>dude test</Text> covers pytest (backend) and Playwright (e2e)
          </li>
          <li>
            <Text strong>Check security</Text> —{' '}
            <Text code>dude security scan</Text> — no extra tools needed, runs in Docker
          </li>
          <li>
            <Text strong>Read the docs</Text> —{' '}
            <Text code>dude docs</Text> to serve the MkDocs site locally
          </li>
        </ol>
      </Card>

      {/* Commands reference */}
      <Card title="dude CLI reference">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {GROUPS.map((group) => (
            <div key={group}>
              <Text
                strong
                style={{
                  display: 'block',
                  marginBottom: 6,
                  color: '#1677ff',
                  textTransform: 'uppercase',
                  fontSize: 11,
                  letterSpacing: 1,
                }}
              >
                {group}
              </Text>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {COMMANDS.filter((c) => c.group === group).map(({ cmd, desc }) => (
                  <Row key={cmd} gutter={8} align="middle" wrap>
                    <Col xs={24} md={10}>
                      <Text code style={{ whiteSpace: 'nowrap' }}>
                        {cmd}
                      </Text>
                    </Col>
                    <Col xs={24} md={14}>
                      <Text type="secondary">{desc}</Text>
                    </Col>
                  </Row>
                ))}
              </Space>
            </div>
          ))}
        </Space>
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message={
            <Text>
              Run <Text code>dude help</Text> for a live, always-up-to-date overview, or{' '}
              <Text code>dude help &lt;command&gt;</Text> for flags.
            </Text>
          }
        />
      </Card>
    </Space>
  )
}
