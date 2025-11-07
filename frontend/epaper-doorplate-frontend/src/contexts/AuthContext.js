import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';
import db from '../db';
import { SecureStorage } from '../utils/security';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(SecureStorage.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // 驗證token是否有效
      validateToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const isValid = await apiService.validateToken();
      
      if (isValid) {
        const username = localStorage.getItem('username');
        const isSuperuser = localStorage.getItem('isSuperuser') === 'true';
        setUser({ username, isSuperuser });
      } else {
        logout();
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const clearLocalUserData = async () => {
    try {
      await db.clearJSON('elementsData');
      await db.clearJSON('editingImage');
      // 如有使用 sessionStorage 的殘留，順手清理
      try { sessionStorage.removeItem('elementsData'); } catch (_) {}
      try { sessionStorage.removeItem('editingImage'); } catch (_) {}
    } catch (e) {
      console.error('清理本地使用者資料失敗:', e);
    }
  };

  const login = async (username, password) => {
    try {
      const data = await apiService.login(username, password);

      if (data.token) {
        const prevUser = localStorage.getItem('username');
        if (prevUser && prevUser !== data.username) {
          await clearLocalUserData();
        }
        setToken(data.token);
        setUser({ 
          username: data.username, 
          isSuperuser: data.isSuperuser || data.superuser || false 
        });
        SecureStorage.setToken(data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('isSuperuser', String(data.isSuperuser || data.superuser || false));
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || '登入失敗' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: '網路錯誤，請稍後再試' };
    }
  };

  const register = async (username, password, confirmPassword, email) => {
    try {
      const data = await apiService.register(username, password, confirmPassword, email);

      if (data.token) {
        setToken(data.token);
        setUser({ 
          username: data.username, 
          isSuperuser: data.isSuperuser || false 
        });
        // 使用安全存儲函數
        SecureStorage.setToken(data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('isSuperuser', String(data.isSuperuser || false));
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || '註冊失敗' };
      }
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: '網路錯誤，請稍後再試' };
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    SecureStorage.clearAuth();
    await clearLocalUserData();
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
