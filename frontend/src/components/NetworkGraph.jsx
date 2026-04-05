import { useState, useEffect, useRef } from 'react'
import { Network } from 'vis-network'
import 'vis-network/styles/vis-network.css'

export default function NetworkGraph({ apiBase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Controls
  const [minPagerank, setMinPagerank] = useState(0)
  const [maxPagerankVal, setMaxPagerankVal] = useState(0.01)
  const [sliderVal, setSliderVal] = useState(0)
  
  const containerRef = useRef(null)
  const networkRef = useRef(null)

  // Fetch graph initially to get max values
  useEffect(() => {
    fetchGraph(0)
  }, [])

  const fetchGraph = async (threshold) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/api/network?min_pagerank=${threshold}`)
      const json = await res.json()
      
      if (json.error || json.message) {
        setError(json.error || json.message)
      } else {
        setData(json)
        // If it's the first load, set the max slider value
        if (threshold === 0 && json.nodes?.length > 0) {
          setMaxPagerankVal(json.nodes[0].pagerank)
        }
      }
    } catch (err) {
      setError('Failed to fetch network graph.')
    } finally {
      setLoading(false)
    }
  }

  // Effect to handle network rendering when data changes
  useEffect(() => {
    if (!containerRef.current || !data?.nodes) return

    // Transform data for vis.js
    const visNodes = data.nodes.map(n => ({
      id: n.id,
      label: n.id,
      group: n.community,
      value: n.pagerank,
      title: `User: ${n.id}<br>PageRank: ${n.pagerank}<br>Posts: ${n.post_count}<br>Community: ${n.community}`
    }))

    const visEdges = data.edges.map(e => ({
      from: e.from,
      to: e.to,
      value: e.weight,
      title: `Weight: ${e.weight}<br>Crossposts: ${e.crosspost_count}`
    }))

    const graphData = { nodes: visNodes, edges: visEdges }

    const options = {
      nodes: {
        shape: 'dot',
        scaling: { min: 5, max: 30 },
        font: { color: '#f1f5f9', size: 12, face: 'Inter' },
        borderWidth: 2,
        color: {
          border: '#222842',
          background: '#6366f1',
          highlight: { border: '#06b6d4', background: '#8b5cf6' },
          hover: { border: '#06b6d4', background: '#8b5cf6' }
        }
      },
      edges: {
        color: { color: '#334155', highlight: '#06b6d4', hover: '#06b6d4' },
        width: 1,
        smooth: { type: 'continuous' }
      },
      physics: {
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09,
        },
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomSpeed: 0.5
      }
    }

    if (networkRef.current) {
      networkRef.current.setData(graphData)
    } else {
      networkRef.current = new Network(containerRef.current, graphData, options)
    }

    return () => {
      // Don't destroy immediately so it re-renders cleanly, 
      // but you can destroy on unmount if needed
    }
  }, [data])

  const handleSliderChange = (e) => {
    setSliderVal(e.target.value)
  }

  const handleSliderRelease = (e) => {
    const val = parseFloat(e.target.value)
    setMinPagerank(val)
    fetchGraph(val)
  }

  return (
    <div className="fade-in max-w-6xl mx-auto h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-3xl font-bold gradient-text mb-2">Influence & Interaction Network</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Graph of author interactions. Nodes colored by Louvain community, sized by PageRank influence.
        </p>
      </div>

      <div className="flex gap-8 mb-6">
        {/* Controls */}
        <div className="glass-card p-4 min-w-[300px] flex flex-col justify-center">
          <label className="text-sm font-medium mb-3 flex justify-between" style={{ color: 'var(--color-text-primary)' }}>
            <span>Minimum PageRank</span>
            <span style={{ color: 'var(--color-accent-tertiary)' }}>{parseFloat(sliderVal).toFixed(5)}</span>
          </label>
          <input
            type="range"
            min="0"
            max={maxPagerankVal || 0.01}
            step={(maxPagerankVal || 0.01) / 100}
            value={sliderVal}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="mb-2"
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Filter out low-influence nodes to declutter the graph.
          </p>
        </div>

        {/* Stats */}
        <div className="glass-card p-4 flex-1 flex divide-x divide-[var(--color-border)]">
          <div className="px-4 flex flex-col justify-center">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Visible Nodes</span>
            <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {data?.total_nodes || 0}
            </span>
          </div>
          <div className="px-4 flex flex-col justify-center">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Visible Edges</span>
            <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {data?.total_edges || 0}
            </span>
          </div>
          <div className="px-4 flex flex-col justify-center">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Communities</span>
            <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {data?.num_communities || 0}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert-error mx-auto mt-10">⚠️ {error}</div>
      ) : (
        <div className="network-container flex-1 h-[600px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-card)]/50 backdrop-blur-sm">
              <div className="spinner" />
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>
      )}
    </div>
  )
}
