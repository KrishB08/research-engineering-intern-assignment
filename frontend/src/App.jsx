import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SearchChat from './components/SearchChat'
import TimeSeries from './components/TimeSeries'
import NetworkGraph from './components/NetworkGraph'
import TopicClusters from './components/TopicClusters'
import CaseStudy from './components/CaseStudy'
import './index.css'

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
    <>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        stats={stats}
        statsLoading={statsLoading}
      />
      <div className="flex-1 h-screen overflow-y-auto px-8 py-10 md:px-12 bg-newsprint">
        {renderSection()}
      </div>
    </>
  )
}

export default App
