/* Contexte + hook exportés : exception react-refresh. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import type { AuthSessionPayload, User } from '../types/auth'
import {
  clearStoredSession,
  getRefreshTokenFromStore,
  loadStoredSession,
  saveStoredSession,
  updateStoredTokens,
  updateStoredUser,
} from '../services/authStorage'
import * as authApi from '../services/auth.service'
import {
  setLogoutHandler,
  setSessionRefreshedHandler,
} from '../services/api'

export type AuthState = {
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
  refreshToken: string | null
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: AuthSessionPayload }
  | {
      type: 'RESTORE_TOKEN'
      payload: {
        accessToken: string
        refreshToken: string
        user: User
      }
    }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }

const initialState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
      }
    case 'RESTORE_TOKEN':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
      }
    case 'LOGOUT':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
      }
    case 'SET_USER':
      return { ...state, user: action.payload }
    default:
      return state
  }
}

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  login: (email: string, password: string) => Promise<void>
  /** Après inscription ou autre flux qui renvoie déjà les jetons. */
  signInWithPayload: (payload: AuthSessionPayload) => void
  logout: () => Promise<void>
  /** Met à jour l’utilisateur en mémoire et dans le stockage local (ex. après PATCH profil). */
  setSessionUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const userRef = useRef<User | null>(null)

  useEffect(() => {
    userRef.current = state.user
  }, [state.user])

  useEffect(() => {
    setLogoutHandler(() => {
      dispatch({ type: 'LOGOUT' })
    })
    return () => {
      setLogoutHandler(null)
    }
  }, [])

  useEffect(() => {
    setSessionRefreshedHandler((tokens) => {
      const u = userRef.current
      if (u) {
        dispatch({
          type: 'RESTORE_TOKEN',
          payload: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: u,
          },
        })
      }
    })
    return () => {
      setSessionRefreshedHandler(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      dispatch({ type: 'SET_LOADING', payload: true })
      const stored = loadStoredSession()
      if (cancelled) {
        return
      }
      if (!stored) {
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'LOGOUT' })
        return
      }
      try {
        const tokens = await authApi.refreshTokens(stored.refreshToken)
        updateStoredTokens(tokens.accessToken, tokens.refreshToken)
        if (cancelled) {
          return
        }
        dispatch({
          type: 'RESTORE_TOKEN',
          payload: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: stored.user,
          },
        })
        dispatch({ type: 'SET_LOADING', payload: false })
      } catch {
        clearStoredSession()
        if (cancelled) {
          return
        }
        dispatch({ type: 'LOGOUT' })
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const payload = await authApi.login(email, password)
    saveStoredSession({
      user: payload.user,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    })
    dispatch({ type: 'LOGIN_SUCCESS', payload })
  }, [])

  const signInWithPayload = useCallback((payload: AuthSessionPayload) => {
    saveStoredSession({
      user: payload.user,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    })
    dispatch({ type: 'LOGIN_SUCCESS', payload })
  }, [])

  const setSessionUser = useCallback((nextUser: User) => {
    updateStoredUser(nextUser)
    dispatch({ type: 'SET_USER', payload: nextUser })
  }, [])

  const logout = useCallback(async () => {
    const tokenToRevoke = getRefreshTokenFromStore()
    if (tokenToRevoke) {
      try {
        await authApi.logout(tokenToRevoke)
      } catch {
        /* best-effort */
      }
    }
    clearStoredSession()
    dispatch({ type: 'LOGOUT' })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      isLoading: state.isLoading,
      isAuthenticated: state.isAuthenticated,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      login,
      signInWithPayload,
      logout,
      setSessionUser,
    }),
    [
      state.user,
      state.isLoading,
      state.isAuthenticated,
      state.accessToken,
      state.refreshToken,
      login,
      signInWithPayload,
      logout,
      setSessionUser,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return ctx
}
