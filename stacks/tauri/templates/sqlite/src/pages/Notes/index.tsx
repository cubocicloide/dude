import { useCallback, useEffect, useState } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Space,
  Table,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { createNote, deleteNote, listNotes, type Note } from '@/ipc'
import { usePageTitle } from '@/hooks'
import { DEFAULT_LOCALE, DEFAULT_PAGE_SIZE } from '@/utils/constants'

const { Paragraph, Text } = Typography

interface NoteFormValues {
  title: string
  body?: string
}

export default function NotesPage() {
  usePageTitle('Notes')
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<NoteFormValues>()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setNotes(await listNotes())
    } catch (e) {
      message.error(String(e))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onCreate = async (values: NoteFormValues) => {
    try {
      await createNote(values.title, values.body)
      form.resetFields()
      await refresh()
    } catch (e) {
      message.error(String(e))
    }
  }

  const onDelete = async (id: number) => {
    try {
      await deleteNote(id)
      await refresh()
    } catch (e) {
      message.error(String(e))
    }
  }

  const columns: ColumnsType<Note> = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Body', dataIndex: 'body', key: 'body', ellipsis: true },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (value: string) =>
        new Date(`${value}Z`).toLocaleString(DEFAULT_LOCALE),
    },
    {
      key: 'actions',
      width: 80,
      render: (_, note) => (
        <Popconfirm
          title="Delete this note?"
          onConfirm={() => void onDelete(note.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="New note">
        <Paragraph type="secondary">
          Notes persist in SQLite via{' '}
          <Text code>src-tauri/src/commands/notes.rs</Text> — the database file
          lives in the platform app-data directory.
        </Paragraph>
        <Form form={form} layout="vertical" onFinish={(v) => void onCreate(v)}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Buy milk" />
          </Form.Item>
          <Form.Item name="body" label="Body">
            <Input.TextArea rows={3} placeholder="Optional details…" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            Add note
          </Button>
        </Form>
      </Card>

      <Card title="Notes">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={notes}
          loading={loading}
          pagination={{ pageSize: DEFAULT_PAGE_SIZE, hideOnSinglePage: true }}
        />
      </Card>
    </Space>
  )
}
