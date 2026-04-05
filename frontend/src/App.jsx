import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SearchChat from './components/SearchChat'
import TimeSeries from './components/TimeSeries'
import NetworkGraph from './components/NetworkGraph'
import TopicClusters from './components/TopicClusters'
import CaseStudy from './components/CaseStudy'

const API_BASE = import.meta.env.VITE_API_URL || ''

function App() {
  const [activeSection, setActiveSection] = useState('search')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch(() => setStatsLoading(false))
  }, [])

  const renderSection = () => {
    switch (activeSection) {
      case 'search':
        return <SearchChat apiBase={API_BASE} />
      case 'timeseries':
        return <TimeSeries apiBase={API_BASE} />
      case 'network':
        return <NetworkGraph apiBase={API_BASE} />
      case 'clusters':
        return <TopicClusters apiBase={API_BASE} />
      case 'casestudy':
        return <CaseStudy apiBase={API_BASE} />
      default:
        return <SearchChat apiBase={API_BASE} />
    }
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#FAFAF8', overflow: 'hidden' }}>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        stats={stats}
        statsLoading={statsLoading}
      />
      
      <main style={{ 
        marginLeft: '240px', 
        height: '100vh', 
        backgroundColor: '#FAFAF8',
        padding: '48px 56px',
        flex: 1,
        overflowY: 'auto'
      }}>
        {renderSection()}
      </main>
    </div>
  )
}

export default App
