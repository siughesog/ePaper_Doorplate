import './App.css'
import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
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
              <Page />
            </ProtectedRoute>
          } />
          <Route path="/template" element={
            <ProtectedRoute>
              <TemplateEditor />
            </ProtectedRoute>
          } />
          <Route path="/ImageManager" element={
            <ProtectedRoute>
              <ImageManager />
            </ProtectedRoute>
          } />
          <Route path="/devices" element={
            <ProtectedRoute>
              <DeviceManager />
            </ProtectedRoute>
          } />
          <Route path="/hardware-whitelist" element={
            <ProtectedRoute>
              <HardwareWhitelistManager />
            </ProtectedRoute>
          } />
          </Routes>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
