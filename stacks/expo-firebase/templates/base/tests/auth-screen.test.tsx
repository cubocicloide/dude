import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { useAuth } from '@/hooks/useAuth'

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native')
  return { Link: ({ children }: { children: string }) => <Text>{children}</Text> }
})
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))

describe('AuthScreen', () => {
  it.each(['sign-in', 'sign-up'] as const)('shows %s failures', async (mode) => {
    const action = jest.fn().mockRejectedValue(new Error('Firebase rejected the request'))
    jest.mocked(useAuth).mockReturnValue({
      loading: false,
      user: null,
      signIn: mode === 'sign-in' ? action : jest.fn(),
      signUp: mode === 'sign-up' ? action : jest.fn(),
      signOut: jest.fn(),
    })

    const screen = render(<AuthScreen mode={mode} />)
    fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com')
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret12')
    fireEvent.press(screen.getByText(mode === 'sign-up' ? 'Sign up' : 'Sign in'))

    await waitFor(() => expect(screen.getByText('Firebase rejected the request')).toBeTruthy())
    expect(action).toHaveBeenCalledWith('person@example.com', 'secret12')
  })
})
