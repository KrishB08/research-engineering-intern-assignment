import { useState, useEffect } from 'react'
import { HiOutlineBookOpen, HiOutlineTrendingUp, HiOutlineChatAlt2 } from 'react-icons/hi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import ReactMarkdown from 'react-markdown'

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
      <div className="h-full flex flex-col items-center justify-center">
        <div className="spinner mb-4" />
        <p style={{ color: 'var(--color-text-muted)' }}>Generating case study narrative and analyzing network...</p>
      </div>
    )
  }

  if (error) {
    return <div className="alert-error max-w-2xl mx-auto mt-10">⚠️ {error}</div>
  }

  if (!data) return null

  return (
    <div className="fade-in max-w-5xl mx-auto pb-20">
      <div className="mb-8 border-b border-[var(--color-border)] pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(99,102,241,0.1)] text-[var(--color-accent-primary)] rounded-full text-xs font-semibold mb-4">
          <HiOutlineBookOpen size={16} />
          Auto-Generated Case Study
        </div>
        <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
          {data.topic}
        </h2>
        <div className="flex gap-6 text-sm text-[var(--color-text-muted)]">
          <span>Based on top {data.key_posts.length} high-engagement posts</span>
          <span>•</span>
          <span>{data.network.total_nodes} key influencers analyzed</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Narrative Column */}
        <div className="flex-[3]">
          <div className="glass-card p-6 mb-8 prose prose-invert prose-indigo max-w-none">
            {/* The narrative is straight text from Gemini, but we can treat it as markdown */}
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-secondary)]" {...props} />,
                strong: ({node, ...props}) => <strong className="text-[var(--color-text-primary)]" {...props} />
              }}
            >
              {data.narrative}
            </ReactMarkdown>
          </div>

          <h3 className="text-xl font-bold mb-4 text-white">Timeline of the Narrative</h3>
          <div className="chart-container h-[250px] mb-4">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeline.data_points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--color-text-muted)" 
                  fontSize={10}
                  tickFormatter={(val) => {
                    try { return new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) } catch { return val }
                  }}
                />
                <YAxis stroke="var(--color-text-muted)" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="var(--color-accent-primary)" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] p-3 rounded-lg border border-[var(--color-border)] mb-8">
            <HiOutlineTrendingUp className="inline mr-2 text-[var(--color-accent-secondary)]" />
            {data.timeline.summary}
          </p>

          <h3 className="text-xl font-bold mb-4 text-white">Source Material</h3>
          <div className="space-y-4">
            {data.key_posts.slice(0, 5).map(post => (
              <div key={post.post_id} className="post-card text-xs">
                <div className="flex justify-between mb-2 text-[var(--color-text-muted)]">
                  <span>r/{post.subreddit} • u/{post.author}</span>
                  <span className="text-[var(--color-accent-warm)]">↑ {post.score}</span>
                </div>
                <p className="font-semibold text-white mb-1">{post.title}</p>
                <p className="text-[var(--color-text-secondary)] line-clamp-2">{post.selftext}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Info Column */}
        <div className="flex-[2] space-y-6">
          <div className="glass-card p-5">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <HiOutlineChatAlt2 className="text-[var(--color-accent-primary)]" />
              Amplification Hubs
            </h4>
            <div className="space-y-3">
              {data.subreddit_breakdown.map((sub, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-[var(--color-text-primary)] font-medium">r/{sub.subreddit}</span>
                  <div className="text-right">
                    <span className="block text-[var(--color-accent-warm)]">↑ {sub.total_score} pts</span>
                    <span className="block text-[var(--color-text-muted)]">{sub.post_count} posts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h4 className="text-sm font-bold text-white mb-4">Network Snapshot</h4>
            <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
              <div className="flex justify-between">
                <span>Key Actors:</span>
                <span className="text-[var(--color-text-primary)]">{data.network.total_nodes}</span>
              </div>
              <div className="flex justify-between">
                <span>Cross-interactions:</span>
                <span className="text-[var(--color-text-primary)]">{data.network.total_edges}</span>
              </div>
              <div className="flex justify-between">
                <span>Sub-communities:</span>
                <span className="text-[var(--color-text-primary)]">{data.network.num_communities}</span>
              </div>
              <div className="mt-4 p-3 bg-[var(--color-bg-primary)] rounded border border-[var(--color-border)]">
                <p className="font-semibold text-[var(--color-accent-tertiary)] mb-1">Top Influencer</p>
                <p>u/{data.network.top_influencer}</p>
                <p className="text-[10px] mt-1 text-[var(--color-text-muted)]">PageRank: {data.network.top_pagerank?.toFixed(5)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
