'use client'

import React from 'react'
import { X, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import './SettingsModal.css'

interface FacultySettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function FacultySettingsModalContent({ onClose }: { onClose: () => void }) {
  const { theme, collegeTheme, setTheme, setCollegeTheme } = useTheme()

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
                className={`theme-option ${collegeTheme === 'default' ? 'active' : ''}`}
                onClick={() => setCollegeTheme('default')}
              >
                <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #006699 100%)' }}>
                  <Monitor size={24} />
                </div>
                <span className="theme-name">Default</span>
                <span className="theme-description">Quantum-inspired theme</span>
                {collegeTheme === 'default' && <span className="theme-active-badge">Active</span>}
              </button>
              
              <button
                className={`theme-option ${collegeTheme === 'science' ? 'active' : ''}`}
                onClick={() => setCollegeTheme('science')}
              >
                <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #25969e 0%, #10b981 50%, #34d399 100%)' }}>
                  <Monitor size={24} />
                </div>
                <span className="theme-name">Science</span>
                <span className="theme-description">College of Science theme</span>
                {collegeTheme === 'science' && <span className="theme-active-badge">Active</span>}
              </button>
              
              <button
                className={`theme-option ${collegeTheme === 'arts-letters' ? 'active' : ''}`}
                onClick={() => setCollegeTheme('arts-letters')}
              >
                <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)' }}>
                  <Monitor size={24} />
                </div>
                <span className="theme-name">Arts & Letters</span>
                <span className="theme-description">College of Arts & Letters theme</span>
                {collegeTheme === 'arts-letters' && <span className="theme-active-badge">Active</span>}
              </button>

              <button
                className={`theme-option ${collegeTheme === 'architecture' ? 'active' : ''}`}
                onClick={() => setCollegeTheme('architecture')}
              >
                <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)' }}>
                  <Monitor size={24} />
                </div>
                <span className="theme-name">Architecture</span>
                <span className="theme-description">College of Architecture theme</span>
                {collegeTheme === 'architecture' && <span className="theme-active-badge">Active</span>}
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

export default function FacultySettingsModal({ isOpen, onClose }: FacultySettingsModalProps) {
  if (!isOpen) return null
  
  return <FacultySettingsModalContent onClose={onClose} />
}
