import { useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { HiOutlineSearch } from 'react-icons/hi'

const HEATMAP_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#facc15',
  '#10b981', '#0ea5e9', '#d946ef', '#f97316', '#84cc16',
  '#14b8a6', '#3b82f6', '#6366f1'
]

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="glass-card p-3" style={{ border: '1px solid var(--color-border)', borderRadius: '8px' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Cluster {data.cluster}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Post ID: {data.post_id}
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
    <div className="fade-in max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Topic Clusters (UMAP)</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            2D projection of the semantic embedding space. Detects themes using HDBSCAN or KMeans.
          </p>
        </div>

        <div className="flex bg-[var(--color-bg-card)] rounded-lg p-2 border border-[var(--color-border)] items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Target Clusters:</span>
          <input 
            type="number" 
            min="2" max="50" 
            className="w-16 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md px-2 py-1 text-xs text-white outline-none"
            placeholder="Auto"
            value={nClusters}
            onChange={e => setNClusters(e.target.value)}
          />
          <button className="btn-secondary text-xs p-1 px-3" onClick={handleApplyClusters}>
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert-error mx-auto mt-10">⚠️ {error}</div>
      ) : data?.warning ? (
        <div className="alert-warning mb-6">💡 {data.warning}</div>
      ) : null}

      <div className="flex-1 flex gap-6 min-h-[500px]">
        {/* Left: UMAP Chart */}
        <div className="chart-container flex-[2] relative flex flex-col">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-card)]/50 backdrop-blur-sm rounded-2xl">
              <div className="spinner" />
            </div>
          )}
          
          <div className="flex justify-between mb-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Embeddings Projection 
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                ({data?.method === 'hdbscan' ? 'HDBSCAN Auto-detected' : 'KMeans'})
              </span>
            </h3>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {data?.n_clusters || 0} clusters found
            </span>
          </div>

          <div className="flex-1 w-full min-h-[400px]">
            {data?.points && data.points.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" dataKey="x" name="UMAP X" tick={false} axisLine={false} />
                  <YAxis type="number" dataKey="y" name="UMAP Y" tick={false} axisLine={false} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                  <Scatter 
                    name="Embeddings" 
                    data={data.points} 
                    onClick={(data) => loadClusterPosts(data.cluster)}
                  >
                    {data.points.map((entry, index) => {
                      const color = entry.cluster === -1 ? '#334155' : HEATMAP_COLORS[entry.cluster % HEATMAP_COLORS.length]
                      const opacity = entry.cluster === -1 ? 0.3 : 0.8
                      return <Cell key={`cell-${index}`} fill={color} opacity={opacity} />
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Click a dot to view posts from that cluster. Dark grey = Noise/Outliers.
          </p>
        </div>

        {/* Right: Cluster Details */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              {activeCluster !== null ? (
                <>Cluster {activeCluster} Posts</>
              ) : (
                <>Detected Themes</>
              )}
            </h3>
            
            {activeCluster !== null ? (
              <div className="space-y-4">
                <button 
                  className="text-xs hover:underline mb-2" 
                  style={{ color: 'var(--color-accent-tertiary)' }}
                  onClick={() => setActiveCluster(null)}
                >
                  ← Back to Themes
                </button>
                
                {loadingPosts ? (
                  <div className="flex justify-center p-4"><div className="spinner w-6 h-6 border-2" /></div>
                ) : clusterPosts.length === 0 ? (
                  <p className="text-xs text-gray-500">No posts collected.</p>
                ) : (
                  clusterPosts.map(p => (
                    <div key={p.post_id} className="border-b border-[var(--color-border)] pb-3">
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>{p.title}</p>
                      <div className="flex justify-between text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        <span>r/{p.subreddit}</span>
                        <span>u/{p.author}</span>
                        <span>↑ {p.score}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {data?.clusters?.map(c => {
                  const color = c.cluster_id === -1 ? '#334155' : HEATMAP_COLORS[c.cluster_id % HEATMAP_COLORS.length]
                  return (
                    <div 
                      key={c.cluster_id} 
                      className="p-3 rounded-lg border cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors"
                      style={{ borderColor: 'var(--color-border)', borderLeft: `4px solid ${color}` }}
                      onClick={() => loadClusterPosts(c.cluster_id)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {c.label || `Cluster ${c.cluster_id}`}
                        </span>
                        <span className="text-[10px] bg-[var(--color-bg-primary)] px-2 py-0.5 rounded" style={{ color: 'var(--color-text-muted)' }}>
                          {c.size} posts
                        </span>
                      </div>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {c.cluster_id === -1 ? 'Uncategorized data points' : 'Click to explore posts'}
                      </p>
                    </div>
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
