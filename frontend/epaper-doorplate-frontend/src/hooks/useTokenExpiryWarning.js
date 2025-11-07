import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to monitor JWT token expiry and show warnings
 * @param {number} warningMinutes - Minutes before expiry to show warning (default: 30)
 */
export const useTokenExpiryWarning = (warningMinutes = 30) => {
  const { token, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (!token) {
      setShowWarning(false);
      setTimeRemaining(null);
      return;
    }

    // Parse JWT token to get expiry time
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;

      if (timeUntilExpiry <= 0) {
        // Token is already expired
        console.log('Token已過期，執行登出');
        logout();
        return;
      }

      const warningTime = warningMinutes * 60 * 1000; // Convert to milliseconds
      
      if (timeUntilExpiry <= warningTime) {
        setShowWarning(true);
        setTimeRemaining(timeUntilExpiry);
      }

      // Set up interval to check token expiry
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = expiryTime - now;
        
        if (remaining <= 0) {
          console.log('Token已過期，執行登出');
          logout();
          clearInterval(interval);
          return;
        }

        if (remaining <= warningTime) {
          setShowWarning(true);
          setTimeRemaining(remaining);
        } else {
          setShowWarning(false);
          setTimeRemaining(null);
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      logout();
    }
  }, [token, logout, warningMinutes]);

  const dismissWarning = () => {
    setShowWarning(false);
  };

  const formatTimeRemaining = (milliseconds) => {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小時${minutes % 60}分鐘`;
    } else {
      return `${minutes}分鐘`;
    }
  };

  return {
    showWarning,
    timeRemaining: timeRemaining ? formatTimeRemaining(timeRemaining) : null,
    dismissWarning
  };
};

