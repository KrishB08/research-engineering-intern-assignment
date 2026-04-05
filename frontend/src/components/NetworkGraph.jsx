import { useState, useEffect, useRef } from 'react'
import { Network } from 'vis-network'

export default function NetworkGraph({ apiBase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [minPagerank, setMinPagerank] = useState(0)
  const [maxPagerankVal, setMaxPagerankVal] = useState(0.01)
  const [sliderVal, setSliderVal] = useState(0)
  
  const containerRef = useRef(null)
  const networkRef = useRef(null)

  const clusterColors = [
    '#FF4D00', '#0066FF', '#00A86B', '#8B5CF6', '#F59E0B',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ]

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

  useEffect(() => {
    if (!containerRef.current || !data?.nodes) return

    const visNodes = data.nodes.map(n => {
      const gColor = clusterColors[n.community % clusterColors.length]
      return {
        id: n.id,
        label: n.id,
        group: n.community,
        value: n.pagerank,
        title: `Actor: ${n.id}\nInfluence Metric: ${n.pagerank}\nDocuments: ${n.post_count}\nCohort: ${n.community}`,
        color: {
          background: gColor,
          border: '#1C1C1C',
          highlight: { border: '#FF4D00', background: '#F0F7FF' },
          hover: { border: '#1C1C1C', background: gColor }
        }
      }
    })

    const visEdges = data.edges.map(e => ({
      from: e.from,
      to: e.to,
      value: e.weight,
      title: `Interaction density: ${e.weight}`
    }))

    const graphData = { nodes: visNodes, edges: visEdges }

    const options = {
      nodes: {
        shape: 'dot',
        scaling: { min: 6, max: 28 },
        font: { color: '#1C1C1C', size: 10, face: 'JetBrains Mono, Fira Code, monospace' },
        borderWidth: 1,
      },
      edges: {
        color: { color: '#E8E4DE', highlight: '#0066FF', hover: '#0066FF' },
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

    return () => {}
  }, [data])

  const handleSliderChange = (e) => setSliderVal(e.target.value)
  const handleSliderRelease = (e) => {
    const val = parseFloat(e.target.value)
    setMinPagerank(val)
    fetchGraph(val)
  }

  const topActors = data?.nodes?.slice(0, 5) || []

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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>
      
      {/* Page header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
          color: '#FF4D00', letterSpacing: '2px', textTransform: 'uppercase',
          marginBottom: '12px' }}>
          Network Topography
        </div>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: '36px', 
          fontWeight: 700, color: '#1C1C1C', lineHeight: 1.2, marginBottom: '12px' }}>
          Interactive Graph
        </h1>
        <p style={{ fontFamily: 'Inter', fontSize: '15px', 
          color: '#6B6B6B', lineHeight: 1.6, maxWidth: '600px' }}>
          Mapping digital relationships. Nodes are sized by algorithmic influence and colored by sociological cohort structures.
        </p>
        <div style={{ height: '1px', backgroundColor: '#E8E4DE', marginTop: '24px' }} />
      </div>

      {/* Stats toolbar */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center',
        backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE',
        borderRadius: '8px', padding: '16px 24px', marginBottom: '20px',
        flexWrap: 'wrap' }}>
        
        {/* Slider control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
            color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
            whiteSpace: 'nowrap' }}>
            Influence Filter
          </span>
          <input 
            type="range" 
            min="0"
            max={maxPagerankVal || 0.01}
            step={(maxPagerankVal || 0.01) / 100}
            value={sliderVal}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            style={{ flex: 1 }} 
          />
        </div>
        
        {/* Stats */}
        {[{label: 'Nodes', value: data?.total_nodes || 0}, {label: 'Edges', value: data?.total_edges || 0}, {label: 'Cohorts', value: data?.num_communities || 0}].map(s => (
          <div key={s.label} style={{ textAlign: 'center', paddingLeft: '24px', borderLeft: '1px solid #E8E4DE' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '22px', 
              fontWeight: 600, color: '#FF4D00' }}>{s.value}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
              color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
              {s.label}
            </div>
          </div>
        ))}
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

      {/* Graph + sidebar layout */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Graph canvas */}
        <div style={{ flex: 1, backgroundColor: '#FFFFFF', 
          border: '1px solid #E8E4DE', borderRadius: '8px',
          height: '520px', position: 'relative', overflow: 'hidden' }}>
          {loading && <LoadingState />}
          {!loading && (!data?.nodes || data.nodes.length === 0) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Playfair Display', fontSize: '16px', color: '#9B9B9B', fontStyle: 'italic' }}>
                No network data matching this filter.
              </span>
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%', outline: 'none' }} />
        </div>
        
        {/* Top actors panel */}
        <div style={{ width: '220px', backgroundColor: '#FFFFFF',
          border: '1px solid #E8E4DE', borderRadius: '8px', padding: '20px',
          overflow: 'auto', maxHeight: '520px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
            color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
            marginBottom: '16px' }}>
            Top Actors
          </div>
          {topActors.map((actor, i) => (
            <div key={actor.id} style={{ display: 'flex', alignItems: 'flex-start',
              gap: '12px', paddingBottom: '12px', marginBottom: '12px',
              borderBottom: '1px solid #F0EDE8' }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '18px',
                fontWeight: 700, color: '#E8E4DE', lineHeight: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ width: '100%' }}>
                <div style={{ fontFamily: 'Inter', fontSize: '13px', 
                  fontWeight: 600, color: '#1C1C1C', wordBreak: 'break-all' }}>{actor.id}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
                  color: '#FF4D00', marginTop: '4px' }}>{actor.pagerank?.toFixed(4)}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
                  color: '#9B9B9B', letterSpacing: '1px', marginTop: '4px' }}>
                  COHORT {actor.community}
                </div>
              </div>
            </div>
          ))}
          {!loading && topActors.length === 0 && (
            <span style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '14px', color: '#9B9B9B' }}>No actors.</span>
          )}
        </div>
      </div>
    </div>
  )
}
