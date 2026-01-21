import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../utils/auth';

const AuthContext = createContext(null);

const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
};

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case ACTIONS.SET_USER:
      return { 
        ...state, 
        user: action.payload, 
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null 
      };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case ACTIONS.LOGOUT:
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const hasToken = await authService.init();
        if (hasToken) {
          const user = await authService.getCurrentUser();
          dispatch({ type: ACTIONS.SET_USER, payload: user });
        } else {
          dispatch({ type: ACTIONS.SET_USER, payload: null });
        }
      } catch (error) {
        console.error('[Auth] Init failed:', error);
        dispatch({ type: ACTIONS.SET_USER, payload: null });
      }
    };
    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      const data = await authService.login(email, password);
      dispatch({ type: ACTIONS.SET_USER, payload: data.user });
      return { success: true };
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, []);

  const register = useCallback(async (email, password, firstName, lastName) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      const data = await authService.register(email, password, firstName, lastName);
      dispatch({ type: ACTIONS.SET_USER, payload: data.user });
      return { success: true };
    } catch (error) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    dispatch({ type: ACTIONS.LOGOUT });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.SET_ERROR, payload: null });
  }, []);

  const value = {
    ...state,
    login,
    register,
    logout,
    clearError,
    getToken: () => authService.getToken(),
    hasPermission: (permission) => authService.hasPermission(permission),
    hasRole: (role) => authService.hasRole(role),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
