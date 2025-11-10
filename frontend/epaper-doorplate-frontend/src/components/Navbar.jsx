import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, Menu, X, Home, LayoutTemplate, Image, Smartphone, Shield, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { isMobileDevice } from '../utils/deviceDetection';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isMobile = isMobileDevice();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  const allNavItems = [
    { path: '/', label: '首頁', icon: Home },
    { path: '/template', label: '模板編輯', icon: LayoutTemplate },
    { path: '/ImageManager', label: '圖片管理', icon: Image },
    { path: '/devices', label: '裝置管理', icon: Smartphone },
    { path: '/settings', label: '設定', icon: Settings },
    { path: '/hardware-whitelist', label: '硬體白名單', icon: Shield, requireSuperuser: true },
  ];

  // 在移动设备上只显示首页和装置管理
  const navItems = isMobile 
    ? allNavItems.filter(item => item.path === '/' || item.path === '/devices')
    : allNavItems;

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">
                ePaper 門牌系統
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {/* Navigation Links */}
            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                // 檢查是否需要超級用戶權限
                if (item.requireSuperuser && !user?.isSuperuser) {
                  return null;
                }
                
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* User Info */}
            <div className="flex items-center space-x-2 text-gray-700 border-l pl-4">
              <User className="h-5 w-5" />
              <span>歡迎, {user?.username}</span>
              {user?.isSuperuser && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  超級用戶
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-700 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>登出</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:text-gray-900"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
              {/* Mobile Navigation Links */}
              {navItems.map((item) => {
                // 檢查是否需要超級用戶權限
                if (item.requireSuperuser && !user?.isSuperuser) {
                  return null;
                }
                
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Mobile User Info */}
              <div className="flex items-center space-x-2 text-gray-700 px-3 py-2 border-t mt-2 pt-2">
                <User className="h-5 w-5" />
                <span>歡迎, {user?.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-700 hover:text-red-600 transition-colors w-full px-3 py-2 text-left"
              >
                <LogOut className="h-5 w-5" />
                <span>登出</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

