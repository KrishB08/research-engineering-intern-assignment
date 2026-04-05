import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE', padding: '12px', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#9B9B9B', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
          {label}
        </p>
        <p style={{ fontFamily: 'Inter', fontSize: '13px', fontWeight: 600, color: '#FF4D00' }}>
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
      const params = new URLSearchParams()
      params.append('group_by', groupBy)
      if (searchQuery) params.append('q', searchQuery)

      const res = await fetch(`${apiBase}/api/timeseries?${params.toString()}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError('Failed to fetch time series data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeSeries(query)
  }, [groupBy])

  const handleSearch = () => {
    fetchTimeSeries(query)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
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

  const EmptyChart = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
       <span style={{ fontFamily: 'Playfair Display', fontSize: '16px', color: '#9B9B9B', fontStyle: 'italic' }}>
         No historical data found for this filter.
       </span>
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '80px' }}>
      
      {/* Page header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
          color: '#FF4D00', letterSpacing: '2px', textTransform: 'uppercase',
          marginBottom: '12px' }}>
          Temporal Analysis
        </div>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: '36px', 
          fontWeight: 700, color: '#1C1C1C', lineHeight: 1.2, marginBottom: '12px' }}>
          Time Series Records
        </h1>
        <p style={{ fontFamily: 'Inter', fontSize: '15px', 
          color: '#6B6B6B', lineHeight: 1.6, maxWidth: '600px' }}>
          Historical analysis of narrative volumes. Track the emergence and frequency of semantic themes.
        </p>
        <div style={{ height: '1px', backgroundColor: '#E8E4DE', marginTop: '24px' }} />
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0', flex: 1, minWidth: '300px' }}>
          <input style={{
            flex: 1, padding: '14px 18px',
            fontFamily: 'Inter', fontSize: '14px', color: '#1C1C1C',
            backgroundColor: '#FFFFFF', border: '1.5px solid #E8E4DE',
            borderRight: 'none', outline: 'none', borderRadius: '6px 0 0 6px'
          }} 
          placeholder="Filter by semantic focus..." 
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          />
          <button style={{
            padding: '14px 24px', backgroundColor: '#FF4D00', color: '#FFFFFF',
            fontFamily: 'JetBrains Mono', fontSize: '11px', letterSpacing: '2px',
            textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            borderRadius: '0 6px 6px 0', transition: 'background 150ms'
          }}
          onClick={handleSearch}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E64400'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF4D00'}>
            Filter
          </button>
        </div>

        <div style={{ display: 'flex', backgroundColor: '#FFFFFF', border: '1.5px solid #E8E4DE', borderRadius: '6px', overflow: 'hidden' }}>
          <button style={{
            padding: '14px 20px', 
            backgroundColor: groupBy === 'day' ? '#00A86B' : 'transparent',
            color: groupBy === 'day' ? '#FFFFFF' : '#1C1C1C',
            fontFamily: 'JetBrains Mono', fontSize: '11px', 
            fontWeight: groupBy === 'day' ? 600 : 400,
            textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            transition: 'background 150ms'
          }} onClick={() => setGroupBy('day')}>
            Daily
          </button>
          <div style={{ width: '1px', backgroundColor: '#E8E4DE' }} />
          <button style={{
            padding: '14px 20px', 
            backgroundColor: groupBy === 'week' ? '#00A86B' : 'transparent',
            color: groupBy === 'week' ? '#FFFFFF' : '#1C1C1C',
            fontFamily: 'JetBrains Mono', fontSize: '11px', 
            fontWeight: groupBy === 'week' ? 600 : 400,
            textTransform: 'uppercase', border: 'none', cursor: 'pointer',
            transition: 'background 150ms'
          }} onClick={() => setGroupBy('week')}>
            Weekly
          </button>
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

      {/* Chart container */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE',
        borderRadius: '8px', padding: '28px', marginBottom: '24px', position: 'relative' }}>
        <div style={{ fontFamily: 'Playfair Display', fontSize: '18px', 
          fontWeight: 600, color: '#1C1C1C', marginBottom: '24px' }}>
          Narrative Volume Distribution
        </div>
        
        {loading ? <LoadingState /> : null}
        
        <div style={{ height: '350px', width: '100%' }}>
           {(!data?.data_points || data.data_points.length === 0) && !loading ? (
             <EmptyChart />
           ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.data_points || []} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9B9B9B" 
                  fontSize={11}
                  fontFamily="JetBrains Mono, Fira Code, Courier New, monospace"
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
                  stroke="#9B9B9B" 
                  fontSize={11}
                  fontFamily="JetBrains Mono, Fira Code, Courier New, monospace"
                  tickMargin={12}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E8E4DE', strokeWidth: 1 }} />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#0066FF" 
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#FF4D00', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#FF4D00', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
           )}
        </div>
      </div>

      {/* Reporter's note (AI summary) */}
      {data?.summary && (
        <div style={{ backgroundColor: '#F0FFF8', border: '1px solid #B8EDD4',
          borderLeft: '4px solid #00A86B', borderRadius: '0 8px 8px 0', padding: '20px 24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
            color: '#00A86B', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
            ◆ Trend Analysis
          </div>
          <p style={{ fontFamily: 'Inter', fontSize: '14px', 
            color: '#1C1C1C', lineHeight: 1.7, fontStyle: 'italic' }}>
            {data.summary}
          </p>
        </div>
      )}

    </div>
  )
}
