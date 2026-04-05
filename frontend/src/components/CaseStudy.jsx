import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import ReactMarkdown from 'react-markdown'

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

export default function CaseStudy({ apiBase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchCaseStudy = async () => {
      try {
        const res = await fetch(`${apiBase}/api/casestudy`)
        const json = await res.json()
        if (json.error || json.message) {
          setError(json.error || json.message)
        } else {
          setData(json)
        }
      } catch (err) {
        setError('Failed to fetch case study.')
      } finally {
        setLoading(false)
      }
    }
    fetchCaseStudy()
  }, [apiBase])

  const LoadingState = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '64px 0', flexDirection: 'column', gap: '16px', minHeight: '60vh' }}>
      <div style={{ width: '32px', height: '2px', backgroundColor: '#FF4D00',
        animation: 'loadingBar 1.2s ease-in-out infinite' }} />
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', 
        color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Loading
      </span>
    </div>
  )

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return (
      <div style={{ backgroundColor: '#FFF5F0', border: '1px solid #FFD4C2',
        borderLeft: '4px solid #FF4D00', borderRadius: '0 8px 8px 0',
        padding: '16px 20px', marginBottom: '24px', maxWidth: '600px', margin: '40px auto' }}>
        <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#CC3D00' }}>
          ⚠ {error}
        </span>
      </div>
    )
  }

  if (!data) return null

  const getTodayStr = () => {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '80px' }}>
      
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 0 48px', 
        borderBottom: '1px solid #E8E4DE', marginBottom: '48px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
          color: '#FF4D00', letterSpacing: '3px', textTransform: 'uppercase',
          marginBottom: '20px' }}>
          Special Report
        </div>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: '44px', 
          fontWeight: 700, color: '#1C1C1C', lineHeight: 1.2, 
          maxWidth: '700px', margin: '0 auto 24px' }}>
          {data.topic}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', 
          gap: '24px', alignItems: 'center' }}>
          {['Analysis', getTodayStr(), 'SimPPL Narratives Lab'].map((item, i) => (
            <React.Fragment key={item}>
              {i > 0 && <span style={{ color: '#E8E4DE' }}>|</span>}
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px',
                color: '#9B9B9B', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {item}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '48px' }}>
        
        {/* Left: narrative + chart */}
        <div style={{ paddingRight: '12px' }}>
          <div style={{ fontFamily: 'Inter', fontSize: '16px', color: '#1C1C1C',
            lineHeight: 1.8, marginBottom: '40px' }}>
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p style={{ marginBottom: '24px' }} {...props} />,
                strong: ({node, ...props}) => <strong style={{ fontWeight: 600, color: '#1C1C1C', backgroundColor: '#FFF0EB', padding: '0 4px' }} {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote style={{ 
                    margin: '32px 0', padding: '16px 24px', 
                    borderLeft: '4px solid #FF4D00', 
                    fontFamily: 'Playfair Display', fontStyle: 'italic',
                    fontSize: '20px', color: '#1C1C1C', backgroundColor: '#F0EDE8'
                  }}>
                    {props.children}
                  </blockquote>
                )
              }}
            >
              {data.narrative}
            </ReactMarkdown>
          </div>
          
          {/* Section label */}
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
            color: '#FF4D00', letterSpacing: '3px', textTransform: 'uppercase',
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Timeline of the Narrative
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E8E4DE' }} />
          </div>
          
          {/* Chart container */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE',
            borderRadius: '8px', padding: '24px', marginBottom: '32px' }}>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline.data_points} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9B9B9B" 
                    fontSize={10}
                    fontFamily="JetBrains Mono, Fira Code, monospace"
                    tickFormatter={(val) => {
                      try { return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return val }
                    }}
                  />
                  <YAxis stroke="#9B9B9B" fontSize={10} fontFamily="JetBrains Mono, Fira Code, monospace" />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E8E4DE' }} />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#0066FF" 
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#FF4D00', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#FF4D00', stroke: '#FFFFFF', strokeWidth: 2 }}
                    animationDuration={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Key takeaway box */}
          <div style={{ backgroundColor: '#F0FFF8', border: '1px solid #B8EDD4',
            borderLeft: '4px solid #00A86B', borderRadius: '0 8px 8px 0',
            padding: '20px 24px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
              color: '#00A86B', letterSpacing: '2px', textTransform: 'uppercase',
              marginBottom: '10px' }}>
              ✓ Analyst Key Takeaway
            </div>
            <p style={{ fontFamily: 'Inter', fontSize: '14px', 
              color: '#1C1C1C', lineHeight: 1.7, fontStyle: 'italic' }}>
              {data.timeline.summary}
            </p>
          </div>
        </div>
        
        {/* Right column: source material */}
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
            color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
            marginBottom: '16px' }}>
            Source Material
          </div>
          {data.key_posts.slice(0, 5).map((s, i) => (
            <div key={i} style={{ paddingBottom: '16px', marginBottom: '16px',
              borderBottom: '1px solid #F0EDE8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                marginBottom: '8px' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px',
                  color: '#FF4D00', textTransform: 'uppercase' }}>{s.subreddit} · {s.author}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px',
                  color: '#9B9B9B' }}>↑ {s.score}</span>
              </div>
              <div style={{ fontFamily: 'Playfair Display', fontSize: '15px',
                fontWeight: 600, color: '#1C1C1C', lineHeight: 1.4 }}>
                {s.title}
              </div>
            </div>
          ))}
          
          <div style={{ marginTop: '40px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
              color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
              marginBottom: '16px' }}>
              Platform Distribution
            </div>
            {data.subreddit_breakdown.slice(0, 5).map((sub, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                fontFamily: 'JetBrains Mono', fontSize: '12px', marginBottom: '12px',
                alignItems: 'center' }}>
                <span style={{ color: '#1C1C1C', textTransform: 'uppercase' }}>
                  r/{sub.subreddit}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#FF4D00', fontWeight: 600, display: 'block' }}>
                    {sub.total_score} pts
                  </span>
                  <span style={{ color: '#9B9B9B', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                    {sub.post_count} docs
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
              color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
              marginBottom: '16px' }}>
              Network Overview
            </div>
            <div style={{ border: '1px solid #E8E4DE', borderRadius: '6px', padding: '16px', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #F0EDE8' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#6B6B6B' }}>Nodes</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600, color: '#1C1C1C' }}>{data.network.total_nodes}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #F0EDE8' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#6B6B6B' }}>Edges</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600, color: '#1C1C1C' }}>{data.network.total_edges}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#6B6B6B' }}>Cohorts</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600, color: '#1C1C1C' }}>{data.network.num_communities}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
