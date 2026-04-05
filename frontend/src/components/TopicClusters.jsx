import { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const clusterColors = [
  '#FF4D00', '#0066FF', '#00A86B', '#8B5CF6', '#F59E0B',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
]

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE', padding: '12px', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#0066FF', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
          Cohort {data.cluster}
        </p>
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600, color: '#1C1C1C' }}>
          Record: {data.post_id}
        </p>
      </div>
    )
  }
  return null
}

export default function TopicClusters({ apiBase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nClusters, setNClusters] = useState('')
  const [activeCluster, setActiveCluster] = useState(null)
  const [clusterPosts, setClusterPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  const fetchClusters = async (overrideClusters = null) => {
    setLoading(true)
    setError(null)
    setActiveCluster(null)
    setClusterPosts([])
    try {
      const params = new URLSearchParams()
      const n = overrideClusters !== null ? overrideClusters : nClusters
      if (n && n >= 2 && n <= 50) {
        params.append('n_clusters', n)
      }
      
      const res = await fetch(`${apiBase}/api/clusters?${params.toString()}`)
      const json = await res.json()
      
      if (json.error || json.message) {
        setError(json.error || json.message)
      } else {
        setData(json)
      }
    } catch (err) {
      setError('Failed to fetch clusters.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClusters()
  }, [])

  const handleApplyClusters = () => {
    fetchClusters()
  }

  const loadClusterPosts = async (clusterId) => {
    if (activeCluster === clusterId) return
    setActiveCluster(clusterId)
    setLoadingPosts(true)
    
    try {
      const params = new URLSearchParams()
      if (nClusters && nClusters >= 2 && nClusters <= 50) {
        params.append('n_clusters', nClusters)
      }
      
      const res = await fetch(`${apiBase}/api/clusters/${clusterId}/posts?${params.toString()}`)
      const json = await res.json()
      setClusterPosts(json.posts || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPosts(false)
    }
  }

  const LoadingState = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '64px 0', flexDirection: 'column', gap: '16px', position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 10 }}>
      <div style={{ width: '32px', height: '2px', backgroundColor: '#FF4D00',
        animation: 'loadingBar 1.2s ease-in-out infinite' }} />
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', 
        color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Loading
      </span>
    </div>
  )

  const SubLoadingState = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 0', flexDirection: 'column', gap: '12px' }}>
      <div style={{ width: '24px', height: '2px', backgroundColor: '#0066FF',
        animation: 'loadingBar 1.2s ease-in-out infinite' }} />
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
        color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Loading
      </span>
    </div>
  )

  const renderTopPanel = () => {
    return (
      <div style={{ width: '100%', backgroundColor: '#FFFFFF',
        border: '1px solid #E8E4DE', borderRadius: '8px',
        padding: '24px', minHeight: '500px', position: 'relative', marginBottom: '24px' }}>
        {loading && <LoadingState />}
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
          color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
          marginBottom: '20px' }}>
          Projection Map: {data?.method === 'hdbscan' ? 'HDBSCAN Auto' : 'KMeans'}
        </div>
        
        <div style={{ height: '460px', width: '100%' }}>
          {data?.points && data.points.length > 0 && (() => {
            const sampledPoints = data.points.filter((_, i) => i % Math.ceil(data.points.length / 800) === 0)
            return (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                  <XAxis type="number" dataKey="x" tick={false} axisLine={false} domain={['auto', 'auto']} />
                  <YAxis type="number" dataKey="y" tick={false} axisLine={false} domain={['auto', 'auto']} />
                  <ZAxis type="number" range={[15, 15]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#1C1C1C' }} content={<CustomTooltip />} />
                  <Scatter 
                    name="Embeddings" 
                    data={sampledPoints} 
                    onClick={(data) => loadClusterPosts(data.cluster)}
                  >
                    {sampledPoints.map((entry, index) => {
                      const isNoise = entry.cluster === -1
                      const color = isNoise ? '#D4CFC7' : clusterColors[entry.cluster % clusterColors.length]
                      const isSelected = activeCluster !== null && activeCluster === entry.cluster
                      const opacity = isSelected ? 1 : (activeCluster !== null ? 0.1 : (isNoise ? 0.3 : 0.7))
                      return <Cell key={`cell-${index}`} fill={color} opacity={opacity} />
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )
          })()}
        </div>
      </div>
    )
  }

  const renderBottomPanelContent = () => {
    if (activeCluster !== null) {
      return (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE', borderRadius: '8px', padding: '20px', overflowY: 'auto', maxHeight: '550px' }}>
          <button style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#FF4D00', letterSpacing: '1px', textTransform: 'uppercase', border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: '16px' }} onClick={() => setActiveCluster(null)}>
            ← Return to overview
          </button>
          
          {loadingPosts ? (
            <SubLoadingState />
          ) : clusterPosts.length === 0 ? (
            <p style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '14px', color: '#9B9B9B', padding: '16px 0' }}>No records accessible for this cohort.</p>
          ) : (
            <div>
              {clusterPosts.map((p, i) => (
                <div key={p.post_id} style={{
                  paddingBottom: '16px', marginBottom: '16px',
                  borderBottom: i === clusterPosts.length - 1 ? 'none' : '1px solid #F0EDE8'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#FF4D00' }}>r/{p.subreddit}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#9B9B9B' }}>↑ {p.score}</span>
                  </div>
                  <div style={{ fontFamily: 'Playfair Display', fontSize: '14px', fontWeight: 600, color: '#1C1C1C', lineHeight: 1.4 }}>
                    {p.title}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
        gap: '16px', 
        maxHeight: '550px', 
        overflowY: 'auto' 
      }}>
        {data?.clusters?.map((cluster, i) => {
          const isNoise = cluster.cluster_id === -1
          const cLabel = cluster.label || (isNoise ? 'Uncategorized Noise' : `Cluster ${cluster.cluster_id}`)
          return (
            <div key={cluster.cluster_id} style={{
              backgroundColor: activeCluster === cluster.cluster_id ? '#FFF8F0' : '#FFFFFF',
              border: '1px solid',
              borderColor: activeCluster === cluster.cluster_id ? '#FF4D00' : '#E8E4DE',
              borderRadius: '8px', padding: '16px',
              cursor: 'pointer', transition: 'all 150ms'
            }} onClick={() => loadClusterPosts(cluster.cluster_id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%',
                  backgroundColor: isNoise ? '#D4CFC7' : clusterColors[cluster.cluster_id % clusterColors.length],
                  marginTop: '4px', flexShrink: 0 }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '20px',
                  fontWeight: 700, color: '#E8E4DE' }}>
                  {String(cluster.size || 0)}
                </span>
              </div>
              <div style={{ fontFamily: 'Playfair Display', fontSize: '14px',
                fontWeight: 600, color: '#1C1C1C', lineHeight: 1.4 }}>
                {cLabel}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px',
                color: '#9B9B9B', marginTop: '6px' }}>
                posts
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>
      
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
          color: '#FF4D00', letterSpacing: '2px', textTransform: 'uppercase',
          marginBottom: '12px' }}>
          Semantic Clustering
        </div>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: '36px', 
          fontWeight: 700, color: '#1C1C1C', lineHeight: 1.2, marginBottom: '12px' }}>
          Thematic Dimensionality
        </h1>
        <p style={{ fontFamily: 'Inter', fontSize: '15px', 
          color: '#6B6B6B', lineHeight: 1.6, maxWidth: '600px' }}>
          Two-dimensional semantic projections identifying macro-narratives through spatial proximity and HDBSCAN cohort grouping.
        </p>
        <div style={{ height: '1px', backgroundColor: '#E8E4DE', marginTop: '24px' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px',
        backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE',
        borderRadius: '8px', padding: '16px 24px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
          color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Clusters
        </span>
        <input type="number" min={2} max={50}
          value={nClusters}
          onChange={e => setNClusters(e.target.value)}
          placeholder="Auto"
          style={{ width: '72px', padding: '8px 12px',
            fontFamily: 'JetBrains Mono', fontSize: '14px', color: '#1C1C1C',
            backgroundColor: '#FAFAF8', border: '1.5px solid #E8E4DE',
            borderRadius: '4px', textAlign: 'center', outline: 'none' }} />
        <button style={{ padding: '10px 20px', backgroundColor: '#FF4D00',
          color: '#FFFFFF', fontFamily: 'JetBrains Mono', fontSize: '11px',
          letterSpacing: '2px', textTransform: 'uppercase', border: 'none',
          borderRadius: '4px', cursor: 'pointer' }} onClick={handleApplyClusters}>
          Apply
        </button>
        <div style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', 
          fontSize: '11px', color: '#9B9B9B' }}>
          {data?.clusters?.length || 0} clusters detected
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FFF5F0', border: '1px solid #FFD4C2',
          borderLeft: '4px solid #FF4D00', borderRadius: '0 8px 8px 0',
          padding: '16px 20px', marginBottom: '24px' }}>
          <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#CC3D00' }}>
            ⚠ {error}
          </span>
        </div>
      )}

      {data?.warning && (
        <div style={{ backgroundColor: '#FFFDF0', border: '1px solid #FFECB3',
          borderLeft: '4px solid #F5E642', borderRadius: '0 8px 8px 0',
          padding: '16px 20px', marginBottom: '24px' }}>
          <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#1C1C1C' }}>
            Note: {data.warning}
          </span>
        </div>
      )}

      {/* Main projection map (Full Landscape) */}
      {renderTopPanel()}
      
      {/* Themes grid/list below */}
      <div style={{ width: '100%' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
          color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
          marginBottom: '16px' }}>
          {activeCluster !== null ? `COHORT ${activeCluster} RECORDS` : 'DETECTED THEMES'}
        </div>
        
        {renderBottomPanelContent()}
      </div>

    </div>
  )
}
