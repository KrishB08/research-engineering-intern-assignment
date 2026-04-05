import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { HiOutlineSearch, HiOutlineLightBulb } from 'react-icons/hi'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3" style={{ border: '1px solid var(--color-border)', borderRadius: '8px' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--color-accent-primary)' }}>
          {payload[0].value} posts
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

  return (
    <div className="fade-in max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text mb-2">Time Series Analysis</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Track narrative volume over time. Search by topics to see their historical footprint.
          </p>
        </div>

        <div className="flex bg-[var(--color-bg-card)] rounded-lg p-1 border border-[var(--color-border)]">
          <button
            className={`px-4 py-1.5 text-xs rounded-md transition-colors ${groupBy === 'day' ? 'bg-[var(--color-accent-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
            onClick={() => setGroupBy('day')}
          >
            Daily
          </button>
          <button
            className={`px-4 py-1.5 text-xs rounded-md transition-colors ${groupBy === 'week' ? 'bg-[var(--color-accent-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
            onClick={() => setGroupBy('week')}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <HiOutlineSearch
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            className="search-input pl-12"
            placeholder="Filter by semantic search (e.g., 'climate change', 'protest action')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? <div className="spinner w-4 h-4" /> : 'Filter'}
        </button>
      </div>

      {error && <div className="alert-error mb-6">⚠️ {error}</div>}

      {/* AI Summary */}
      {data?.summary && (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineLightBulb size={20} style={{ color: 'var(--color-accent-tertiary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-accent-tertiary)' }}>
              Trend Analysis: {data.query}
            </h3>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {data.summary}
          </p>
        </div>
      )}

      {/* Chart */}
      <div className="chart-container relative h-[400px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-card)]/50 backdrop-blur-sm rounded-2xl">
            <div className="spinner" />
          </div>
        )}
        
        {!loading && data?.data_points?.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
            No data available for this query.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.data_points || []} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="var(--color-text-muted)" 
                fontSize={12}
                tickMargin={10}
                tickFormatter={(val) => {
                  try {
                    return new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  } catch {
                    return val
                  }
                }}
              />
              <YAxis 
                stroke="var(--color-text-muted)" 
                fontSize={12}
                tickMargin={10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="var(--color-accent-primary)" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: 'var(--color-bg-primary)', stroke: 'var(--color-accent-primary)', strokeWidth: 2 }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
