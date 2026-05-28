import { useEffect, useState } from 'react'

export function App() {
  const [message, setMessage] = useState<string>('loading…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setMessage(data.status))
      .catch(() => setMessage('backend unreachable'))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Hello from your new project</h1>
      <p>
        Backend health: <strong>{message}</strong>
      </p>
    </main>
  )
}
