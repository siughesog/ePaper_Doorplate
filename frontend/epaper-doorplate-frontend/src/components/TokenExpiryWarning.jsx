import React from 'react';
import { useTokenExpiryWarning } from '../hooks/useTokenExpiryWarning';
import { useAuth } from '../contexts/AuthContext';

const TokenExpiryWarning = () => {
  const { showWarning, timeRemaining, dismissWarning } = useTokenExpiryWarning(30); // 30分鐘前警告
  const { logout } = useAuth();

  if (!showWarning) {
    return null;
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              登入即將過期
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                您的登入狀態將在 <span className="font-semibold">{timeRemaining}</span> 後過期。
                請保存您的工作並重新登入。
              </p>
            </div>
            <div className="mt-4 flex space-x-3">
              <button
                type="button"
                className="bg-yellow-100 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                onClick={dismissWarning}
              >
                稍後提醒
              </button>
              <button
                type="button"
                className="bg-yellow-600 px-3 py-2 rounded-md text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                onClick={handleLogout}
              >
                立即登出
              </button>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              type="button"
              className="bg-yellow-50 rounded-md inline-flex text-yellow-400 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              onClick={dismissWarning}
            >
              <span className="sr-only">關閉</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenExpiryWarning;

