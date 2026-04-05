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

  const EDITORIAL_COLORS = ['#8B6F47', '#4A7C59', '#C1440E', '#1A1A2E', '#7B8FA1']

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
      const gColor = EDITORIAL_COLORS[n.community % EDITORIAL_COLORS.length]
      return {
        id: n.id,
        label: n.id,
        group: n.community,
        value: n.pagerank,
        title: `Actor: ${n.id}\nInfluence Metric: ${n.pagerank}\nDocuments: ${n.post_count}\nCohort: ${n.community}`,
        color: {
          background: gColor,
          border: '#1A1A2E',
          highlight: { border: '#C1440E', background: '#F5E642' },
          hover: { border: '#1A1A2E', background: gColor }
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
        scaling: { min: 5, max: 25 },
        font: { color: '#1A1A2E', size: 10, face: 'ui-monospace, SFMono-Regular, monospace' },
        borderWidth: 1,
      },
      edges: {
        color: { color: '#D4CFC7', highlight: '#1A1A2E', hover: '#6B6B6B' },
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

  const activeNodes = data?.nodes?.slice(0, 5) || []

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col pb-10">
      
      {/* Header */}
      <div className="mb-6 border-b border-border-editorial pb-3">
        <h2 className="text-[32px] font-serif text-navy mb-2">Interaction Network</h2>
        <p className="text-[13px] font-sans italic text-muted">
          Mapping digital relationships. Nodes are sized by algorithmic influence and colored by sociological cohort structures.
        </p>
      </div>

      {/* Editorial Toolbar (Horizontal above graph) */}
      <div className="flex border border-border-editorial bg-white mb-6 align-stretch font-mono text-[11px] uppercase tracking-wide">
        
        {/* Controls block */}
        <div className="flex items-center gap-4 px-4 py-3 bg-sidebar border-r border-border-editorial min-w-[280px]">
          <span className="text-navy font-bold">Influence Filter</span>
          <input
            type="range"
            min="0"
            max={maxPagerankVal || 0.01}
            step={(maxPagerankVal || 0.01) / 100}
            value={sliderVal}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="flex-1 h-[2px] bg-border-editorial appearance-none rounded-none outline-none focus:outline-none"
            style={{
              accentColor: '#C1440E'
            }}
          />
        </div>

        {/* Stats Blocks */}
        <div className="flex px-4 py-3 border-r border-border-editorial flex-col justify-center">
          <span className="text-muted">Nodes</span>
          <span className="text-[15px] font-bold text-navy">{data?.total_nodes || 0}</span>
        </div>
        <div className="flex px-4 py-3 border-r border-border-editorial flex-col justify-center">
          <span className="text-muted">Edges</span>
          <span className="text-[15px] font-bold text-navy">{data?.total_edges || 0}</span>
        </div>
        <div className="flex px-4 py-3 flex-col justify-center">
          <span className="text-muted">Cohorts</span>
          <span className="text-[15px] font-bold text-navy">{data?.num_communities || 0}</span>
        </div>
      </div>

      {error && <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-6 font-sans text-sm">Error: {error}</div>}

      <div className="flex flex-1 gap-6 min-h-[600px]">
        {/* Main Graph Area */}
        <div className="w-full h-full bg-white border border-border-editorial relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
               <span className="font-mono text-[14px] text-navy">Constructing matrix...</span>
            </div>
          )}
          <div ref={containerRef} className="w-full h-[600px] outline-none" />
        </div>

        {/* Top 5 Nodes Sidebar */}
        <div className="w-[300px] border border-border-editorial bg-white p-5 flex flex-col mt-0 h-fit">
          <h3 className="font-sans font-bold text-navy uppercase text-[12px] tracking-widest border-b-[2px] border-navy pb-2 mb-4">
            Most Central Actors
          </h3>
          <div className="flex flex-col gap-4">
            {activeNodes.map((n, i) => (
              <div key={n.id} className="border-b border-border-editorial pb-3 flex items-start gap-3">
                <span className="font-serif font-bold text-burnt-orange text-[18px] leading-none pt-1">
                  {i + 1}.
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-sans font-bold text-navy text-[14px] break-all">
                    {n.id}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
                    <span className="uppercase" style={{ color: EDITORIAL_COLORS[n.community % EDITORIAL_COLORS.length] }}>
                      Cohort {n.community}
                    </span>
                    <span>•</span>
                    <span>Score: {n.pagerank.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            ))}
            {activeNodes.length === 0 && !loading && (
              <span className="font-serif italic text-muted text-sm">No actors match criteria.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
