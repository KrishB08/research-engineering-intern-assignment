import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border-editorial p-3 shadow-sm rounded-none">
        <p className="text-[11px] font-mono mb-1 text-muted uppercase tracking-wider">{label}</p>
        <p className="text-[13px] font-sans font-bold text-burnt-orange">
          {payload[0].value} documents
        </p>
      </div>
    )
  }
  return null
}

export default function TimeSeries({ apiBase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState('week')
  const [error, setError] = useState(null)

  const fetchTimeSeries = async (searchQuery = '') => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL(`${apiBase}/api/timeseries`)
      url.searchParams.append('group_by', groupBy)
      if (searchQuery) url.searchParams.append('q', searchQuery)

      const res = await fetch(url)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError('Failed to fetch time series data.')
    } finally {
      setLoading(false)
    }
  }

  // Load overall timeseries on mount
  useEffect(() => {
    fetchTimeSeries()
  }, [groupBy])

  const handleSearch = () => {
    fetchTimeSeries(query)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const getTodayStr = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Page Header */}
      <div className="mb-8 border-b border-border-editorial pb-3">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-[32px] font-serif text-navy">Time Series Records</h2>
          <span className="font-mono text-[11px] text-muted">{getTodayStr()}</span>
        </div>
        <p className="text-[13px] font-sans italic text-muted">
          Historical analysis of narrative volumes. Track the emergence and frequency of semantic themes.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center bg-sidebar border border-border-editorial p-3">
        <div className="flex-1 flex gap-2 w-full">
          <input
            type="text"
            className="flex-1 bg-white border border-border-editorial rounded-none px-3 py-2 font-serif text-[14px] text-navy outline-none focus:border-navy transition-colors placeholder:text-muted/60"
            placeholder="Focus semantic query (e.g., 'climate change resistance')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            className="bg-navy hover:bg-black text-white px-5 py-2 font-mono text-[12px] uppercase rounded-none transition-colors" 
            onClick={handleSearch} 
            disabled={loading}
          >
            {loading ? 'Refining...' : 'Filter'}
          </button>
        </div>
        
        <div className="h-6 w-px bg-border-editorial hidden sm:block mx-2"></div>
        
        <div className="flex bg-white border border-border-editorial w-full sm:w-auto">
          <button
            className={`flex-1 px-4 py-2 font-mono text-[11px] uppercase transition-colors ${groupBy === 'day' ? 'bg-forest-green text-white font-bold' : 'text-navy hover:bg-newsprint'}`}
            onClick={() => setGroupBy('day')}
          >
            Daily
          </button>
          <div className="w-px bg-border-editorial"></div>
          <button
            className={`flex-1 px-4 py-2 font-mono text-[11px] uppercase transition-colors ${groupBy === 'week' ? 'bg-forest-green text-white font-bold' : 'text-navy hover:bg-newsprint'}`}
            onClick={() => setGroupBy('week')}
          >
            Weekly
          </button>
        </div>
      </div>

      {error && <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-6 font-sans text-sm">Error: {error}</div>}

      {/* AI Summary Note */}
      {data?.summary && (
        <div className="mb-8 border-t-[3px] border-t-burnt-orange bg-sidebar p-5 relative">
          <span className="font-mono text-[11px] font-bold text-burnt-orange uppercase tracking-widest absolute -top-[10px] bg-sidebar px-2 border border-border-editorial left-4">
            Analysis
          </span>
          <p className="font-serif italic text-[15px] leading-relaxed text-navy mt-1">
            {data.summary}
          </p>
        </div>
      )}

      {/* Chart Section */}
      <h3 className="font-serif text-[20px] text-navy mb-4 border-b border-border-editorial pb-2">
        Narrative Volume Distribution
      </h3>

      <div className="relative h-[450px] w-full bg-white border border-border-editorial p-6 pt-8">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <span className="font-mono text-[14px] text-navy">Running aggregation...</span>
          </div>
        )}
        
        {!loading && data?.data_points?.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center font-serif italic text-muted">
            No historical data found for this semantic filter.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.data_points || []} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D4CFC7" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#6B6B6B" 
                fontSize={11}
                fontFamily="SFMono-Regular, Consolas, monospace"
                tickMargin={12}
                tickFormatter={(val) => {
                  try {
                    return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                  } catch {
                    return val
                  }
                }}
              />
              <YAxis 
                stroke="#6B6B6B" 
                fontSize={11}
                fontFamily="SFMono-Regular, Consolas, monospace"
                tickMargin={12}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6B6B6B', strokeWidth: 1, strokeDasharray: '5 5' }} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#1A1A2E" 
                strokeWidth={2}
                dot={{ r: 2, fill: '#C1440E', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#C1440E', stroke: '#1A1A2E', strokeWidth: 2 }}
                animationDuration={0}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
