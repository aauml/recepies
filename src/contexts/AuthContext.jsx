import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useUser, useAuth as useClerkAuth, useSignIn, useSignUp, useClerk } from '@clerk/clerk-react'
import { setGetToken } from '../lib/api'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const { user: clerkUser, isLoaded } = useUser()
  const { signOut: clerkSignOut, getToken } = useClerkAuth()
  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, isLoaded: signUpLoaded } = useSignUp()
  const { setActive } = useClerk()

  // Wire up the API client's token getter
  useEffect(() => {
    setGetToken(getToken)
  }, [getToken])

  // Map Clerk user to our app's user shape (compatible with old Supabase shape)
  const user = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        user_metadata: {
          full_name: clerkUser.fullName || clerkUser.firstName || '',
          avatar_url: clerkUser.imageUrl || null,
        },
      }
    : null

  const loading = !isLoaded

  const signInWithGoogle = useCallback(() => {
    if (!signIn) return
    signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/',
    })
  }, [signIn])

  const signInWithEmail = useCallback(async (email, password) => {
    if (!signIn) return { error: { message: 'Sign in not ready' } }
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        return { error: null }
      }
      return { error: { message: `Sign in status: ${result.status}. Please try Google sign-in.` } }
    } catch (err) {
      return { error: { message: err.errors?.[0]?.longMessage || err.message || 'Sign in failed' } }
    }
  }, [signIn, setActive])

  const signUpWithEmail = useCallback(async (email, password) => {
    if (!signUp) return { error: { message: 'Sign up not ready' } }
    try {
      const result = await signUp.create({ emailAddress: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        return { error: null }
      }
      // May need email verification
      return { error: { message: 'Please check your email to verify your account' } }
    } catch (err) {
      return { error: { message: err.errors?.[0]?.longMessage || err.message || 'Sign up failed' } }
    }
  }, [signUp, setActive])

  const signOut = useCallback(() => clerkSignOut(), [clerkSignOut])

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
