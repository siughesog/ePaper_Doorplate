import './App.css'
import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import MobileRestrictedRoute from './components/MobileRestrictedRoute'
import Navbar from './components/Navbar'
import TemplateEditor from './TemplateEditor'
import ImageManager from './ImageManager'
import DeviceManager from './DeviceManager'
import HardwareWhitelistManager from './HardwareWhitelistManager'
import TokenExpiryWarning from './components/TokenExpiryWarning'
import Page from './Page'
import db from './db'

function App() {
  useEffect(() => {
    (async () => {
      const database = await db.initDB()
      // IndexedDB 初始化完成
    })()
  }, [])

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <TokenExpiryWarning />
          <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <MobileRestrictedRoute>
                <Page />
              </MobileRestrictedRoute>
            </ProtectedRoute>
          } />
          <Route path="/template" element={
            <ProtectedRoute>
              <MobileRestrictedRoute>
                <TemplateEditor />
              </MobileRestrictedRoute>
            </ProtectedRoute>
          } />
          <Route path="/ImageManager" element={
            <ProtectedRoute>
              <MobileRestrictedRoute>
                <ImageManager />
              </MobileRestrictedRoute>
            </ProtectedRoute>
          } />
          <Route path="/devices" element={
            <ProtectedRoute>
              <MobileRestrictedRoute>
                <DeviceManager />
              </MobileRestrictedRoute>
            </ProtectedRoute>
          } />
          <Route path="/hardware-whitelist" element={
            <ProtectedRoute>
              <MobileRestrictedRoute>
                <HardwareWhitelistManager />
              </MobileRestrictedRoute>
            </ProtectedRoute>
          } />
          </Routes>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
