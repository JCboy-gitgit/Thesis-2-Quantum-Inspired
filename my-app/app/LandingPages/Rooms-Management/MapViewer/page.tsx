'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'
import { 
  Map, 
  Building2, 
  Layers, 
  Maximize2,
  Info,
  Construction
} from 'lucide-react'

export default function MapViewerPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  return (
    <div className={styles.pageContainer}>
      <MenuBar 
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.contentWrapper}>
          {/* Header */}
          <div className={styles.headerCard}>
            <div className={styles.headerTitleRow}>
              <div className={styles.headerIcon}>
                <Map className="w-6 h-6" />
              </div>
              <h1 className={styles.headerTitle}>2D / 3D Map Viewer</h1>
            </div>
            <p className={styles.headerSubtitle}>
              Interactive visualization of campus buildings and room locations
            </p>
          </div>

          {/* Coming Soon Card */}
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonContent}>
              {/* Icon */}
              <div className={styles.constructionIcon}>
                <Construction className="w-12 h-12" />
              </div>
              
              <h2 className={styles.comingSoonTitle}>Coming Soon</h2>
              <p className={styles.comingSoonText}>
                The interactive 2D/3D map viewer is currently under development. 
                This feature will allow you to visualize building layouts and room locations.
              </p>

              {/* Feature Preview */}
              <div className={styles.featurePreviewGrid}>
                <div className={styles.featurePreviewCard}>
                  <div className={`${styles.featurePreviewIcon} ${styles.blue}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className={styles.featurePreviewTitle}>Building View</h3>
                  <p className={styles.featurePreviewText}>
                    Navigate through campus buildings
                  </p>
                </div>
                
                <div className={styles.featurePreviewCard}>
                  <div className={`${styles.featurePreviewIcon} ${styles.purple}`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className={styles.featurePreviewTitle}>Floor Plans</h3>
                  <p className={styles.featurePreviewText}>
                    View detailed floor layouts
                  </p>
                </div>
                
                <div className={styles.featurePreviewCard}>
                  <div className={`${styles.featurePreviewIcon} ${styles.green}`}>
                    <Maximize2 className="w-5 h-5" />
                  </div>
                  <h3 className={styles.featurePreviewTitle}>3D Visualization</h3>
                  <p className={styles.featurePreviewText}>
                    Interactive 3D room models
                  </p>
                </div>
              </div>

              {/* Info Note */}
              <div className={styles.infoNote}>
                <Info className={styles.infoIcon} />
                <p className={styles.infoText}>
                  In the meantime, you can use the <strong>Room List & Details</strong> page to view and manage rooms, or <strong>Search / Filter Rooms</strong> to find specific rooms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
