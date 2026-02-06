'use client'

// Faculty Settings Modal - Updated 2026-02-04
// Theme-aware modal that respects light/dark mode
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface FacultySettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function FacultySettingsModalContent({ onClose }: { onClose: () => void }) {
  const { theme, collegeTheme, setTheme, setCollegeTheme } = useTheme()
  
  // For faculty pages, 'green' is treated as 'light' mode (green is only for admin)
  const displayMode = theme === 'dark' ? 'dark' : 'light'
  const isLightMode = displayMode === 'light'

  // Get college theme colors
  const collegeColors = {
    default: { primary: '#00d4ff', dark: '#0099cc', rgb: '0, 212, 255' },
    science: { primary: '#10b981', dark: '#059669', rgb: '16, 185, 129' },
    'arts-letters': { primary: '#f97316', dark: '#ea580c', rgb: '249, 115, 22' },
    architecture: { primary: '#ef4444', dark: '#dc2626', rgb: '239, 68, 68' },
  }
  
  const currentCollegeColor = collegeColors[collegeTheme] || collegeColors.default

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
  }

  const handleCollegeThemeChange = (newCollegeTheme: 'default' | 'science' | 'arts-letters' | 'architecture') => {
    setCollegeTheme(newCollegeTheme)
  }

  const colorThemes = [
    { 
      id: 'default', 
      name: 'Default', 
      description: 'Quantum-inspired theme',
      gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
    },
    { 
      id: 'science', 
      name: 'Science', 
      description: 'College of Science theme',
      gradient: 'linear-gradient(135deg, #25969e 0%, #10b981 100%)',
    },
    { 
      id: 'arts-letters', 
      name: 'Arts & Letters', 
      description: 'College of Arts & Letters theme',
      gradient: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)',
    },
    { 
      id: 'architecture', 
      name: 'Architecture', 
      description: 'College of Architecture theme',
      gradient: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    },
  ]

  const displayModes = [
    {
      id: 'dark',
      name: 'Dark Mode',
      description: 'Easy on the eyes',
      icon: Moon,
      gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
      iconColor: '#22d3ee'
    },
    {
      id: 'light',
      name: 'Light Mode',
      description: 'Classic bright look',
      icon: Sun,
      gradient: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
      iconColor: '#92400e'
    }
  ]

  // Theme-aware colors - now uses current college theme color
  const colors = {
    overlay: isLightMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.85)',
    modalBg: isLightMode 
      ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' 
      : 'linear-gradient(135deg, #0f1629 0%, #1a2035 100%)',
    modalBorder: isLightMode 
      ? `rgba(${currentCollegeColor.rgb}, 0.3)` 
      : `rgba(${currentCollegeColor.rgb}, 0.3)`,
    modalShadow: isLightMode 
      ? `0 25px 80px rgba(0, 0, 0, 0.15), 0 0 40px rgba(${currentCollegeColor.rgb}, 0.1)` 
      : `0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(${currentCollegeColor.rgb}, 0.15)`,
    headerBg: isLightMode 
      ? `linear-gradient(135deg, rgba(${currentCollegeColor.rgb}, 0.1) 0%, rgba(${currentCollegeColor.rgb}, 0.05) 100%)` 
      : `linear-gradient(135deg, rgba(${currentCollegeColor.rgb}, 0.1) 0%, rgba(${currentCollegeColor.rgb}, 0.05) 100%)`,
    headerBorder: isLightMode 
      ? `rgba(${currentCollegeColor.rgb}, 0.2)` 
      : `rgba(${currentCollegeColor.rgb}, 0.2)`,
    titleColor: currentCollegeColor.primary,
    textPrimary: isLightMode ? '#1e293b' : '#ffffff',
    textSecondary: isLightMode ? '#64748b' : '#94a3b8',
    closeBtnBg: isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
    closeBtnColor: isLightMode ? '#64748b' : '#94a3b8',
    optionBg: isLightMode ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.05)',
    optionBorder: isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
    optionHoverBg: isLightMode ? `rgba(${currentCollegeColor.rgb}, 0.1)` : `rgba(${currentCollegeColor.rgb}, 0.1)`,
    optionHoverBorder: isLightMode ? `rgba(${currentCollegeColor.rgb}, 0.4)` : `rgba(${currentCollegeColor.rgb}, 0.4)`,
    activeColor: currentCollegeColor.primary,
    footerBg: isLightMode ? 'rgba(0, 0, 0, 0.03)' : 'rgba(0, 0, 0, 0.3)',
    footerBorder: isLightMode ? `rgba(${currentCollegeColor.rgb}, 0.15)` : `rgba(${currentCollegeColor.rgb}, 0.15)`,
    btnGradient: `linear-gradient(135deg, ${currentCollegeColor.primary} 0%, ${currentCollegeColor.dark} 100%)`,
    btnHoverGradient: `linear-gradient(135deg, ${currentCollegeColor.dark} 0%, ${currentCollegeColor.dark} 100%)`,
    btnShadow: `0 8px 24px rgba(${currentCollegeColor.rgb}, 0.4)`,
    dividerColor: isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(148, 163, 184, 0.2)',
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.overlay,
        backdropFilter: 'blur(12px)',
        padding: '20px',
      }} 
      onClick={handleOverlayClick}
    >
      <div 
        style={{
          background: colors.modalBg,
          border: `2px solid ${colors.modalBorder}`,
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: colors.modalShadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          background: colors.headerBg,
          borderBottom: `1px solid ${colors.headerBorder}`,
        }}>
          <h2 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: colors.titleColor,
            fontSize: '1.25rem',
            fontWeight: 700,
            margin: 0,
          }}>
            <Monitor size={24} />
            Settings
          </h2>
          <button 
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.closeBtnBg,
              border: 'none',
              borderRadius: '12px',
              color: colors.closeBtnColor,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.closeBtnBg
              e.currentTarget.style.color = colors.closeBtnColor
            }}
          >
            <X size={22} />
          </button>
        </div>
        
        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <h3 style={{ color: colors.textPrimary, fontSize: '0.875rem', fontWeight: 500, margin: '0 0 4px 0', opacity: 0.9 }}>
            Appearance
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: '0 0 20px 0' }}>
            Choose your preferred theme for the application
          </p>

          {/* Color Themes */}
          {colorThemes.map((colorTheme) => {
            const isActive = collegeTheme === colorTheme.id
            return (
              <button
                key={colorTheme.id}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: isActive ? 'rgba(16, 185, 129, 0.15)' : colors.optionBg,
                  border: `2px solid ${isActive ? colors.activeColor : colors.optionBorder}`,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  transition: 'all 0.2s',
                }}
                onClick={() => handleCollegeThemeChange(colorTheme.id as any)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = colors.optionHoverBg
                    e.currentTarget.style.borderColor = colors.optionHoverBorder
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = colors.optionBg
                    e.currentTarget.style.borderColor = colors.optionBorder
                  }
                }}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: colorTheme.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}>
                  <Monitor size={28} color="#ffffff" />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: colors.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
                    {colorTheme.name}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
                    {colorTheme.description}
                  </div>
                </div>
                {isActive && (
                  <span style={{
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '20px',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Active
                  </span>
                )}
              </button>
            )
          })}

          <div style={{ height: '1px', background: colors.dividerColor, margin: '20px 0' }} />

          <h3 style={{ color: colors.textPrimary, fontSize: '1rem', fontWeight: 600, margin: '0 0 8px 0' }}>
            Display Mode
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '0.875rem', margin: '0 0 20px 0' }}>
            Choose light or dark appearance
          </p>

          {/* Display Modes */}
          {displayModes.map((mode) => {
            const isModeActive = displayMode === mode.id
            return (
              <button
                key={mode.id}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: isModeActive ? 'rgba(16, 185, 129, 0.15)' : colors.optionBg,
                  border: `2px solid ${isModeActive ? colors.activeColor : colors.optionBorder}`,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  transition: 'all 0.2s',
                }}
                onClick={() => handleThemeChange(mode.id as 'light' | 'dark')}
                onMouseEnter={(e) => {
                  if (!isModeActive) {
                    e.currentTarget.style.background = colors.optionHoverBg
                    e.currentTarget.style.borderColor = colors.optionHoverBorder
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isModeActive) {
                    e.currentTarget.style.background = colors.optionBg
                    e.currentTarget.style.borderColor = colors.optionBorder
                  }
                }}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: mode.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}>
                  <mode.icon size={28} color={mode.iconColor} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: colors.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
                    {mode.name}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
                    {mode.description}
                  </div>
                </div>
                {isModeActive && (
                  <span style={{
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '20px',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Active
                  </span>
                )}
              </button>
            )
          })}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          background: colors.footerBg,
          borderTop: `1px solid ${colors.footerBorder}`,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button 
            style={{
              padding: '14px 40px',
              background: colors.btnGradient,
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.btnHoverGradient
              e.currentTarget.style.boxShadow = colors.btnShadow
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.btnGradient
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FacultySettingsModal({ isOpen, onClose }: FacultySettingsModalProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted || !isOpen) {
    return null
  }
  
  return createPortal(
    <FacultySettingsModalContent onClose={onClose} />,
    document.body
  )
}
