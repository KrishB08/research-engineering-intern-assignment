import { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const HEATMAP_COLORS = ['#8B6F47', '#4A7C59', '#C1440E', '#1A1A2E', '#7B8FA1', '#2C497F', '#5D4A66', '#87675D']

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white border border-border-editorial p-3 shadow-none">
        <p className="text-[11px] font-mono mb-1 text-muted uppercase tracking-wider">
          Cohort {data.cluster}
        </p>
        <p className="text-[12px] font-mono text-navy font-bold">
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
      const url = new URL(`${apiBase}/api/clusters`)
      const n = overrideClusters !== null ? overrideClusters : nClusters
      if (n && n >= 2 && n <= 50) {
        url.searchParams.append('n_clusters', n)
      }
      
      const res = await fetch(url)
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
      const url = new URL(`${apiBase}/api/clusters/${clusterId}/posts`)
      if (nClusters && nClusters >= 2 && nClusters <= 50) {
        url.searchParams.append('n_clusters', nClusters)
      }
      
      const res = await fetch(url)
      const json = await res.json()
      setClusterPosts(json.posts || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPosts(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col pb-10">
      <div className="mb-8 border-b border-border-editorial pb-3">
        <h2 className="text-[32px] font-serif text-navy mb-2">Thematic Dimensionality</h2>
        <p className="text-[13px] font-sans italic text-muted">
          Two-dimensional semantic projections identifying macro-narratives through spatial proximity.
        </p>
      </div>

      <div className="flex items-center gap-4 border border-border-editorial bg-sidebar p-3 mb-6 w-full sm:w-auto">
        <span className="font-mono text-[11px] uppercase text-navy font-bold">Cohorts:</span>
        <input 
          type="number" 
          min="2" max="50" 
          className="w-16 bg-white border border-border-editorial rounded-none px-2 py-1 text-xs text-navy outline-none focus:border-navy"
          placeholder="Auto"
          value={nClusters}
          onChange={e => setNClusters(e.target.value)}
        />
        <button className="bg-navy hover:bg-black text-white px-3 py-1 font-mono text-[11px] uppercase transition-colors" onClick={handleApplyClusters}>
          Apply
        </button>
      </div>

      {error && <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-6 font-sans text-sm">Error: {error}</div>}
      {data?.warning && <div className="border border-yellow-300 bg-yellow-highlight/30 text-navy p-3 mb-6 font-sans text-sm">Note: {data.warning}</div>}

      <div className="flex-1 flex flex-col lg:flex-row gap-0 border border-border-editorial bg-white">
        
        {/* Left: UMAP Chart */}
        <div className="flex-[5] relative flex flex-col border-r border-border-editorial">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
              <span className="font-mono text-[14px] text-navy">Projecting tensor space...</span>
            </div>
          )}
          
          <div className="p-4 border-b border-border-editorial flex justify-between bg-sidebar">
            <h3 className="text-[14px] font-sans font-bold text-navy uppercase tracking-wide">
              Projection Map
            </h3>
            <span className="text-[11px] font-mono text-muted uppercase">
              {data?.method === 'hdbscan' ? 'HDBSCAN Auto' : 'KMeans'} • {data?.n_clusters || 0} discovered
            </span>
          </div>

          <div className="w-full flex-1 min-h-[500px] p-6 relative bg-newsprint/40">
            {data?.points && data.points.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4CFC7" />
                  <XAxis type="number" dataKey="x" tick={false} axisLine={false} />
                  <YAxis type="number" dataKey="y" tick={false} axisLine={false} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#1A1A2E' }} content={<CustomTooltip />} />
                  <Scatter 
                    name="Embeddings" 
                    data={data.points} 
                    onClick={(data) => loadClusterPosts(data.cluster)}
                  >
                    {data.points.map((entry, index) => {
                      const isNoise = entry.cluster === -1
                      const color = isNoise ? '#D4CFC7' : HEATMAP_COLORS[entry.cluster % HEATMAP_COLORS.length]
                      const isSelected = activeCluster !== null && activeCluster === entry.cluster
                      
                      // Highlight selected points
                      const opacity = isSelected ? 1 : (activeCluster !== null ? 0.2 : (isNoise ? 0.4 : 0.9))
                      const radius = isSelected ? 30 : 20
                      
                      return <Cell key={`cell-${index}`} fill={color} opacity={opacity} />
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
            <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none">
              <span className="bg-white/90 px-3 py-1 text-[10px] font-mono uppercase tracking-wide text-muted border border-border-editorial">
                Select a cluster to analyze qualitative sources
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cluster Post List in Newspaper column style */}
        <div className="flex-[3] flex flex-col bg-white">
          <div className="p-4 border-b border-border-editorial bg-sidebar">
            <h3 className="text-[14px] font-sans font-bold text-navy uppercase tracking-wide">
              {activeCluster !== null ? `Cohort ${activeCluster} Records` : 'Detected Themes'}
            </h3>
          </div>
          
          <div className="p-0 overflow-y-auto max-h-[600px]">
            {activeCluster !== null ? (
              <div className="p-4">
                <button 
                  className="font-mono text-[11px] text-burnt-orange uppercase tracking-wide hover:underline mb-4 flex items-center gap-1" 
                  onClick={() => setActiveCluster(null)}
                >
                  ← Return to overview
                </button>
                
                {loadingPosts ? (
                  <p className="font-mono text-[11px] text-muted p-4">Indexing records...</p>
                ) : clusterPosts.length === 0 ? (
                  <p className="font-serif italic text-[14px] text-muted p-4">No records accessible for this cohort.</p>
                ) : (
                  <div className="flex flex-col gap-0 border-t border-border-editorial">
                    {clusterPosts.map(p => (
                      <div key={p.post_id} className="py-4 border-b border-border-editorial">
                        <p className="font-serif font-bold text-[16px] text-navy mb-2 leading-snug">{p.title}</p>
                        <div className="flex justify-between font-mono text-[10px] text-muted uppercase tracking-wider">
                          <span>r/{p.subreddit}</span>
                          <span>Score {p.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                {data?.clusters?.map(c => {
                  const isNoise = c.cluster_id === -1
                  const themeColor = isNoise ? '#D4CFC7' : HEATMAP_COLORS[c.cluster_id % HEATMAP_COLORS.length]
                  
                  return (
                    <button 
                      key={c.cluster_id} 
                      className={`text-left p-4 border-b border-border-editorial hover:bg-newsprint transition-colors group flex flex-col gap-2 ${activeCluster === c.cluster_id ? 'bg-yellow-highlight' : ''}`}
                      onClick={() => loadClusterPosts(c.cluster_id)}
                    >
                      <div className="flex justify-between items-start w-full gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 block" style={{ backgroundColor: themeColor }} />
                          <span className="font-sans font-bold text-[14px] text-navy">
                            {c.label || (isNoise ? 'Uncategorized Noise' : `Cohort ${c.cluster_id}`)}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-muted group-hover:text-burnt-orange transition-colors whitespace-nowrap">
                          {c.size} docs
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
