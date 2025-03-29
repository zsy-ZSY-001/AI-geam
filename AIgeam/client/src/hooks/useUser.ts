import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  gameStats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    highScores: Record<string, number>;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  error: null,
  login: async () => false,
  register: async () => false,
  logout: () => {},
  updateProfile: async () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化 - 检查是否已有登录会话
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get(`${API_URL}/users/me`);
          setUser(response.data);
        }
      } catch (err) {
        localStorage.removeItem('authToken');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 登录方法
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = response.data;
      localStorage.setItem('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 注册方法
  const register = useCallback(async (username: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/auth/register`, { username, email, password });
      const { token, user } = response.data;
      localStorage.setItem('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 登出方法
  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  // 更新用户资料
  const updateProfile = useCallback(async (userData: Partial<User>): Promise<boolean> => {
    if (!user) return false;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(`${API_URL}/users/${user.id}`, userData);
      setUser(response.data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新资料失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useUser = () => useContext(AuthContext); 