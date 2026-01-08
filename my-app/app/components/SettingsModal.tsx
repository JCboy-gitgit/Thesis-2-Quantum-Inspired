'use client'

import React from 'react'
import { X, Moon, Sun, Leaf, Monitor } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

// Inner component that uses the theme hook - only rendered when modal is open
function SettingsModalContent({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme()

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2 className="settings-title">
            <Monitor size={24} />
            Settings
          </h2>
          <button className="settings-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            <p className="settings-section-description">
              Choose your preferred theme for the application
            </p>
            
            <div className="theme-options">
              <button
                className={`theme-option ${theme === 'green' ? 'active' : ''}`}
                onClick={() => setTheme('green')}
              >
                <div className="theme-preview green-preview">
                  <Leaf size={24} />
                </div>
                <span className="theme-name">Green (Default)</span>
                <span className="theme-description">College of Science theme</span>
                {theme === 'green' && <span className="theme-active-badge">Active</span>}
              </button>
              
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <div className="theme-preview dark-preview">
                  <Moon size={24} />
                </div>
                <span className="theme-name">Dark Mode</span>
                <span className="theme-description">Easy on the eyes</span>
                {theme === 'dark' && <span className="theme-active-badge">Active</span>}
              </button>
              
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <div className="theme-preview light-preview">
                  <Sun size={24} />
                </div>
                <span className="theme-name">Light Mode</span>
                <span className="theme-description">Classic bright look</span>
                {theme === 'light' && <span className="theme-active-badge">Active</span>}
              </button>
            </div>
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null
  
  return <SettingsModalContent onClose={onClose} />
}
