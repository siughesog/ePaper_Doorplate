import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isMobileDevice } from '../utils/deviceDetection';

/**
 * 移动设备限制路由组件
 * 在移动设备上只允许访问首页 (/) 和装置管理 (/devices)
 */
const MobileRestrictedRoute = ({ children }) => {
  const location = useLocation();
  const isMobile = isMobileDevice();
  
  // 允许访问的路径
  const allowedPaths = ['/', '/devices'];
  
  // 如果是移动设备且访问的路径不在允许列表中，重定向到首页
  if (isMobile && !allowedPaths.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

export default MobileRestrictedRoute;



