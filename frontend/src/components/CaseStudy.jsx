import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import ReactMarkdown from 'react-markdown'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border-editorial p-3 shadow-none">
        <p className="text-[11px] font-mono mb-1 text-muted uppercase tracking-wider">{label}</p>
        <p className="text-[13px] font-sans font-bold text-burnt-orange">
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

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <span className="font-mono text-[14px] text-navy uppercase tracking-widest border-b-[2px] border-navy pb-2">
          Printing Editorial Analysis...
        </span>
      </div>
    )
  }

  if (error) {
    return <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-6 font-sans text-sm max-w-2xl mx-auto mt-10">Error: {error}</div>
  }

  if (!data) return null

  const getTodayStr = () => {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      {/* Hero Header */}
      <div className="mb-10 text-center border-b-[3px] border-navy pb-8 pt-6 relative">
        <span className="absolute top-0 left-1/2 -translate-x-1/2 bg-navy text-white px-4 py-1 font-mono text-[10px] uppercase tracking-widest">
          Special Report
        </span>
        <h2 className="text-[48px] font-serif text-navy mt-8 mb-6 leading-tight max-w-4xl mx-auto px-4">
          {data.topic}
        </h2>
        <div className="flex justify-center items-center gap-4 text-[12px] font-mono text-muted uppercase tracking-widest flex-wrap">
          <span className="font-bold text-navy">Analysis</span>
          <span className="text-border-editorial">|</span>
          <span>{getTodayStr()}</span>
          <span className="text-border-editorial">|</span>
          <span className="font-bold text-burnt-orange">SimPPL Narratives Lab</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* Main Narrative Column */}
        <div className="flex-[3]">
          
          <div className="font-serif text-[18px] leading-[1.8] text-navy mb-12">
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="mb-6" {...props} />,
                strong: ({node, ...props}) => <strong className="bg-[#F5E642] px-1 font-bold" {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote className="my-8 py-2 pl-6 border-l-[4px] border-burnt-orange text-[22px] italic text-navy/80 bg-newsprint">
                    <span className="text-[32px] text-burnt-orange leading-none align-top block -mt-1 -mb-4">“</span>
                    {props.children}
                    <span className="text-[32px] text-burnt-orange leading-none align-bottom ml-2 block -mt-4 text-right">”</span>
                  </blockquote>
                )
              }}
            >
              {data.narrative}
            </ReactMarkdown>
          </div>

          <div className="border-t-[2px] border-navy pt-8 mb-12">
             <h3 className="font-sans font-bold text-[14px] text-navy uppercase tracking-widest mb-6">Timeline of the Narrative</h3>
            <div className="h-[250px] w-full mb-6 border border-border-editorial bg-white p-4">
               <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline.data_points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4CFC7" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B6B6B" 
                    fontSize={10}
                    fontFamily="SFMono-Regular, Consolas, monospace"
                    tickFormatter={(val) => {
                      try { return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return val }
                    }}
                  />
                  <YAxis stroke="#6B6B6B" fontSize={10} fontFamily="SFMono-Regular, Consolas, monospace" />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6B6B6B' }} />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#1A1A2E" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-sidebar p-4 border border-border-editorial flex items-start gap-4">
              <span className="font-serif text-[24px] text-forest-green font-bold leading-none mt-1">✓</span>
              <p className="font-serif italic text-navy text-[15px] leading-relaxed">
                <span className="font-mono text-[10px] text-forest-green uppercase tracking-widest font-bold block mb-1">Analyst Key Takeaway</span>
                {data.timeline.summary}
              </p>
            </div>
          </div>

        </div>

        {/* Sidebar Info Column */}
        <div className="flex-[2] space-y-8 pl-0 lg:pl-12 lg:border-l border-border-editorial">
          
          <div>
            <h4 className="font-sans font-bold text-[14px] text-navy uppercase tracking-widest border-b-[2px] border-navy pb-2 mb-6">
              Source Material
            </h4>
            <div className="space-y-6">
              {data.key_posts.slice(0, 5).map((post, idx) => (
                <div key={post.post_id} className="pb-6 border-b border-border-editorial/50">
                  <div className="flex justify-between items-center font-mono text-[10px] text-muted uppercase tracking-wider mb-2">
                    <span>r/{post.subreddit} • u/{post.author}</span>
                    <span className="text-burnt-orange font-bold">Score {post.score}</span>
                  </div>
                  <p className="font-serif font-bold text-[16px] text-navy leading-snug mb-2">{post.title}</p>
                  <p className="font-serif text-[13px] text-navy/70 line-clamp-3">{post.selftext}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-sidebar p-6 border border-border-editorial">
            <h4 className="font-sans font-bold text-[13px] text-navy uppercase tracking-widest mb-6">
              Platform Distribution
            </h4>
            <div className="space-y-4">
              {data.subreddit_breakdown.map((sub, i) => (
                <div key={i} className="flex justify-between items-center text-[12px] font-mono">
                  <span className="text-navy uppercase w-2/3 truncate pr-2">r/{sub.subreddit}</span>
                  <div className="text-right w-1/3">
                    <span className="block text-burnt-orange font-bold">{sub.total_score} pts</span>
                    <span className="block text-muted">{sub.post_count} docs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-sidebar p-6 border border-border-editorial">
            <h4 className="font-sans font-bold text-[13px] text-navy uppercase tracking-widest mb-6">
              Network Snapshot
            </h4>
            <div className="space-y-4 font-mono text-[11px] text-navy uppercase tracking-wide">
              <div className="flex justify-between border-b border-border-editorial/50 pb-2">
                <span className="text-muted">High-Value Actors</span>
                <span className="font-bold">{data.network.total_nodes}</span>
              </div>
              <div className="flex justify-between border-b border-border-editorial/50 pb-2">
                <span className="text-muted">Interactions</span>
                <span className="font-bold">{data.network.total_edges}</span>
              </div>
              <div className="flex justify-between border-b border-border-editorial/50 pb-2">
                <span className="text-muted">Cohorts</span>
                <span className="font-bold">{data.network.num_communities}</span>
              </div>
              
              <div className="mt-6 p-4 bg-white border border-border-editorial relative">
                <span className="absolute -top-[8px] bg-white px-2 left-2 text-burnt-orange font-bold text-[10px]">Primary Vector</span>
                <p className="font-serif text-[16px] font-bold text-navy mt-1 truncate">u/{data.network.top_influencer}</p>
                <p className="text-[10px] mt-1 text-muted">Influence Metric: {data.network.top_pagerank?.toFixed(5)}</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
