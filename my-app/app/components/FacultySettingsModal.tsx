'use client'

import React from 'react'
import { X, Moon, Sun, Palette, Check } from 'lucide-react'
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

  const colorThemes = [
    { id: 'default', name: 'Quantum Inspired', gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #006699 100%)' },
    { id: 'science', name: 'Science', gradient: 'linear-gradient(135deg, #25969e 0%, #10b981 50%, #34d399 100%)' },
    { id: 'arts-letters', name: 'Arts & Letters', gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)' },
    { id: 'architecture', name: 'Architecture', gradient: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)' },
  ]

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2 className="settings-title">
            <Palette size={24} />
            Appearance Settings
          </h2>
          <button className="settings-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="settings-content">
          {/* Mode Selection */}
          <div className="settings-section">
            <h3 className="settings-section-title">Display Mode</h3>
            <p className="settings-section-description">
              Choose between light and dark mode
            </p>
            
            <div className="mode-options">
              <button
                className={`mode-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <div className="mode-icon light-mode-icon">
                  <Sun size={28} />
                </div>
                <div className="mode-info">
                  <span className="mode-name">Light Mode</span>
                  <span className="mode-description">Bright and clear interface</span>
                </div>
                {theme === 'light' && <Check size={20} className="mode-check" />}
              </button>
              
              <button
                className={`mode-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <div className="mode-icon dark-mode-icon">
                  <Moon size={28} />
                </div>
                <div className="mode-info">
                  <span className="mode-name">Dark Mode</span>
                  <span className="mode-description">Easy on the eyes</span>
                </div>
                {theme === 'dark' && <Check size={20} className="mode-check" />}
              </button>
            </div>
          </div>

          {/* Color Theme Selection */}
          <div className="settings-section">
            <h3 className="settings-section-title">Color Theme</h3>
            <p className="settings-section-description">
              Select your preferred accent color
            </p>
            
            <div className="color-theme-grid">
              {colorThemes.map((colorTheme) => (
                <button
                  key={colorTheme.id}
                  className={`color-theme-option ${collegeTheme === colorTheme.id ? 'active' : ''}`}
                  onClick={() => setCollegeTheme(colorTheme.id as any)}
                >
                  <div 
                    className="color-preview" 
                    style={{ background: colorTheme.gradient }}
                  >
                    {collegeTheme === colorTheme.id && <Check size={18} />}
                  </div>
                  <span className="color-name">{colorTheme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="settings-section preview-section">
            <h3 className="settings-section-title">Preview</h3>
            <div className={`theme-preview-card ${theme}`} data-college-theme={collegeTheme}>
              <div className="preview-header">
                <div className="preview-avatar"></div>
                <div className="preview-text">
                  <div className="preview-title"></div>
                  <div className="preview-subtitle"></div>
                </div>
              </div>
              <div className="preview-content">
                <div className="preview-bar"></div>
                <div className="preview-bar short"></div>
              </div>
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
