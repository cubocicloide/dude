import { useEffect, useState } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Statistic,
  Typography,
} from 'antd'
import { PlusOutlined, RocketOutlined, SendOutlined } from '@ant-design/icons'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  getCounter,
  greet,
  incrementCounter,
  COUNTER_CHANGED_EVENT,
} from '@/ipc'
import { usePageTitle, useTauriEvent } from '@/hooks'

const { Title, Paragraph, Text, Link } = Typography

interface Command {
  cmd: string
  desc: string
}

const COMMANDS: Command[] = [
  { cmd: 'dude dev', desc: 'Run the desktop app with hot-reload' },
  { cmd: 'dude build', desc: 'Build the distributable installers' },
  {
    cmd: 'dude lint',
    desc: 'Structural checks — React (FE) + Rust/Tauri (BE)',
  },
  { cmd: 'dude format', desc: 'prettier (frontend) + cargo fmt (backend)' },
  { cmd: 'dude review', desc: 'lint + ESLint + tsc + clippy in one pass' },
  { cmd: 'dude test', desc: 'cargo test — unit tests next to each command' },
  { cmd: 'dude docs', desc: 'Serve the project docs at http://localhost:8001' },
  { cmd: 'dude help', desc: 'Live catalog of every available command' },
]

export default function HomePage() {
  usePageTitle('Home')
  const { message } = AntApp.useApp()

  // ── Commands demo: invoke via the typed src/ipc wrappers ──────────────────
  const [name, setName] = useState('')
  const [greeting, setGreeting] = useState<string>()

  const onGreet = async () => {
    try {
      setGreeting(await greet(name))
    } catch (e) {
      // Rejections carry the serialized AppError message from Rust.
      message.error(String(e))
    }
  }

  // ── State + events demo: backend owns the counter, events keep us in sync ─
  const [counter, setCounter] = useState<number>()

  useEffect(() => {
    getCounter()
      .then(setCounter)
      .catch(() => setCounter(undefined))
  }, [])
  useTauriEvent<number>(COUNTER_CHANGED_EVENT, setCounter)

  const onIncrement = async () => {
    try {
      // No setCounter here — the backend emits COUNTER_CHANGED_EVENT and the
      // subscription above updates the UI. One source of truth: Rust state.
      await incrementCounter()
    } catch (e) {
      message.error(String(e))
    }
  }

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
              This desktop app was scaffolded with{' '}
              <Link
                onClick={() =>
                  void openUrl('https://github.com/cubocicloide/dude')
                }
              >
                dude
              </Link>{' '}
              using the <Text code>tauri</Text> stack — Tauri 2 + React 19 + Ant
              Design, with a Rust backend. The two cards below exercise every
              core Tauri concept: commands, managed state, events and error
              handling.
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Commands + error handling */}
        <Col xs={24} md={12}>
          <Card title="IPC command — greet" style={{ height: '100%' }}>
            <Paragraph type="secondary">
              Calls <Text code>greet</Text> in{' '}
              <Text code>src-tauri/src/commands/greet.rs</Text> through the
              typed wrapper in <Text code>src/ipc/greet.ts</Text>. Submit an
              empty name to see the shared <Text code>AppError</Text> surface
              here.
            </Paragraph>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onPressEnter={() => void onGreet()}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => void onGreet()}
              >
                Greet
              </Button>
            </Space.Compact>
            {greeting && (
              <Paragraph style={{ marginTop: 16 }}>
                <Text strong>{greeting}</Text>
              </Paragraph>
            )}
          </Card>
        </Col>

        {/* Managed state + events */}
        <Col xs={24} md={12}>
          <Card
            title="Managed state + events — counter"
            style={{ height: '100%' }}
          >
            <Paragraph type="secondary">
              The value lives in Rust (<Text code>AppState</Text>). Every
              increment emits a <Text code>counter-changed</Text> event; this
              page subscribes via <Text code>useTauriEvent</Text> — the UI never
              sets the value itself.
            </Paragraph>
            <Space size="large" align="center">
              <Statistic value={counter ?? '—'} />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => void onIncrement()}
              >
                Increment
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Commands reference */}
      <Card title="dude CLI reference">
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {COMMANDS.map(({ cmd, desc }) => (
            <Row key={cmd} gutter={8} align="middle" wrap>
              <Col xs={24} md={8}>
                <Text code style={{ whiteSpace: 'nowrap' }}>
                  {cmd}
                </Text>
              </Col>
              <Col xs={24} md={16}>
                <Text type="secondary">{desc}</Text>
              </Col>
            </Row>
          ))}
        </Space>
      </Card>
    </Space>
  )
}
