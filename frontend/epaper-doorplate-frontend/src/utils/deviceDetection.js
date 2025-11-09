import { useState, useEffect } from 'react';

/**
 * 检测是否是移动设备
 * @returns {boolean} 如果是移动设备返回 true
 */
export const isMobileDevice = () => {
  // 检测用户代理
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // 检测常见的移动设备
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  if (mobileRegex.test(userAgent)) {
    return true;
  }
  
  // 检测屏幕宽度（小于 768px 视为移动设备）
  if (window.innerWidth < 768) {
    return true;
  }
  
  // 检测触摸支持
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // 但需要排除桌面设备（屏幕宽度大于 1024px 且有鼠标）
    if (window.innerWidth >= 1024) {
      return false;
    }
    return true;
  }
  
  return false;
};

/**
 * 获取移动设备检测的 Hook
 * @returns {boolean} 是否是移动设备
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
};

