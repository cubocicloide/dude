import { useQuery } from '@tanstack/react-query'
import { Alert, Badge, Card, Col, Row, Space, Typography } from 'antd'
import {
  CheckCircleOutlined,
  CodeOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { $get as getHealth } from '@/openapi/api/health'

const { Title, Paragraph, Text, Link } = Typography

interface Command {
  cmd: string
  desc: string
  group: string
}

const COMMANDS: Command[] = [
  // Infrastructure
  { group: 'Infrastructure', cmd: 'dude up --build', desc: 'Build images and start all services' },
  { group: 'Infrastructure', cmd: 'dude up', desc: 'Start all services (detached)' },
  { group: 'Infrastructure', cmd: 'dude down', desc: 'Stop and remove containers' },
  { group: 'Infrastructure', cmd: 'dude logs [service]', desc: 'Follow logs; omit service to follow all' },
  { group: 'Infrastructure', cmd: 'dude shell <service>', desc: 'Open a shell inside a running container' },
  // Quality
  { group: 'Code quality', cmd: 'dude lint', desc: 'Structural lint checks (naming, layout)' },
  { group: 'Code quality', cmd: 'dude format', desc: 'Format code — ruff (backend) + prettier (frontend)' },
  { group: 'Code quality', cmd: 'dude review', desc: 'Lint + ESLint + API contract review in one pass' },
  // API
  { group: 'API contract', cmd: 'dude api sync', desc: 'Fetch OpenAPI spec → regenerate the typed client' },
  { group: 'API contract', cmd: 'dude api review', desc: 'Validate frontend/src/openapi/ against the spec' },
  // Testing
  { group: 'Testing', cmd: 'dude test', desc: 'Run all test suites (backend + e2e)' },
  { group: 'Testing', cmd: 'dude test --backend', desc: 'pytest only' },
  { group: 'Testing', cmd: 'dude test --e2e', desc: 'Playwright + Cucumber only' },
  // Security
  { group: 'Security', cmd: 'dude security scan', desc: 'Run all SAST scanners; exit 1 on new HIGH+ findings' },
  { group: 'Security', cmd: 'dude security accept', desc: 'Absorb all findings into the baseline' },
  { group: 'Security', cmd: 'dude security verify --rule-id <id>', desc: 'Confirm a specific finding is fixed' },
  // Docs
  { group: 'Documentation', cmd: 'dude docs', desc: 'Serve MkDocs at http://localhost:8001 (live-reload)' },
  // Help
  { group: 'Help', cmd: 'dude help', desc: 'Show all available commands and flags' },
]

const GROUPS = [...new Set(COMMANDS.map((c) => c.group))]

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })

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
              using the <Text code>react-fastapi</Text> stack — React 19 + Vite + FastAPI + Docker
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

        {/* Quick links */}
        <Col xs={24} md={16}>
          <Card title={<><CodeOutlined /> Quick links</>} style={{ height: '100%' }}>
            <Space wrap size="middle">
              <Link href="http://localhost:8000/docs" target="_blank">
                API docs (Swagger)
              </Link>
              <Link href="http://localhost:8000/redoc" target="_blank">
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
            <Link href="http://localhost" target="_blank">http://localhost</Link> (frontend) ·{' '}
            <Link href="http://localhost:8000/docs" target="_blank">http://localhost:8000/docs</Link>{' '}
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
