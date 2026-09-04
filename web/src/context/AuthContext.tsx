import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import type { AuthClaims, UserSession } from '../types/auth';

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-memory token storage (persisting across refresh via session validation)
let inMemoryToken: string | null = null;

export const setStoredToken = (token: string | null) => {
  inMemoryToken = token;
  if (token) {
    sessionStorage.setItem('auth_token', token);
  } else {
    sessionStorage.removeItem('auth_token');
  }
};

export const getStoredToken = () => {
  return inMemoryToken || sessionStorage.getItem('auth_token');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const processToken = (jwtToken: string): boolean => {
    try {
      const claims = jwtDecode<AuthClaims>(jwtToken);
      // Check expiry
      if (claims.exp * 1000 < Date.now()) {
        console.warn('Token has expired');
        return false;
      }
      setStoredToken(jwtToken);
      setTokenState(jwtToken);
      setUser({ token: jwtToken, claims });
      return true;
    } catch (e) {
      console.error('Failed to decode JWT:', e);
      return false;
    }
  };

  useEffect(() => {
    // Validate on load / page refresh
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('auth_token');
      const existingToken = urlToken || getStoredToken();
      if (existingToken) {
        const valid = processToken(existingToken);
        if (!valid) {
          logout();
        } else {
          // Validate with backend /dummy/authenticated endpoint
          try {
            const res = await fetch('http://localhost:8000/dummy/authenticated', {
              headers: { Authorization: `Bearer ${existingToken}` },
            });
            if (!res.ok) {
              console.warn('Token rejected by server on load validation');
              logout();
            }
          } catch (err) {
            console.error('Error validating token against server:', err);
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (jwtToken: string) => {
    processToken(jwtToken);
  };

  const logout = () => {
    setStoredToken(null);
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
