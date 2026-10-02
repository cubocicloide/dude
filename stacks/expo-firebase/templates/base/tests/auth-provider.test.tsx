import { render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import * as service from '@/features/auth/service'

jest.mock('@/lib/firebase', () => ({ connectFirebaseEmulators: jest.fn() }))
jest.mock('@/features/auth/service', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  subscribeToAuth: jest.fn(),
}))

function Consumer() {
  const { loading, user } = useAuth()
  return <Text>{loading ? 'loading' : (user?.uid ?? 'signed-out')}</Text>
}

describe('AuthProvider', () => {
  it('restores the current auth state', async () => {
    jest.mocked(service.subscribeToAuth).mockImplementation((listener) => {
      listener({ uid: 'user-1' } as never)
      return jest.fn()
    })
    const screen = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('user-1')).toBeTruthy())
  })
})
