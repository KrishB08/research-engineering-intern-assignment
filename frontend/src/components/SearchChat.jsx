import { useState, useRef } from 'react'
import { HiOutlineSearch, HiOutlineLightBulb, HiOutlineArrowRight } from 'react-icons/hi'

export default function SearchChat({ apiBase }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || query).trim()
    if (!q) {
      setError('Please enter a search query.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(q)}&top_k=10`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      }
      setResult(data)
    } catch (err) {
      setError('Failed to connect to the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleFollowUp = (followUpQuery) => {
    setQuery(followUpQuery)
    handleSearch(followUpQuery)
  }

  return (
    <div className="fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold gradient-text mb-2">Semantic Search & Chat</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Search by meaning, not keywords. Ask questions about digital narratives, influence patterns, and information spread.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <HiOutlineSearch
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            ref={inputRef}
            type="text"
            className="search-input pl-12"
            placeholder="e.g., How are communities organizing resistance online?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className="btn-primary"
          onClick={() => handleSearch()}
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Searching...
            </>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error mb-6">⚠️ {error}</div>
      )}

      {/* Warning */}
      {result?.warning && (
        <div className="alert-warning mb-6">💡 {result.warning}</div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="spinner mb-4" />
          <p style={{ color: 'var(--color-text-muted)' }}>Searching across {'>'}8,000 posts...</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6 fade-in">
          {/* AI Summary */}
          {result.chatbot?.summary && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <HiOutlineLightBulb size={20} style={{ color: 'var(--color-accent-warm)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-accent-warm)' }}>
                  AI Analysis
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {result.chatbot.summary}
              </p>
            </div>
          )}

          {/* Follow-up suggestions */}
          {result.chatbot?.follow_up_queries?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-medium mr-1" style={{ color: 'var(--color-text-muted)' }}>
                Explore further:
              </span>
              {result.chatbot.follow_up_queries.map((fq, i) => (
                <button
                  key={i}
                  className="btn-secondary text-xs flex items-center gap-1"
                  onClick={() => handleFollowUp(fq)}
                >
                  {fq}
                  <HiOutlineArrowRight size={12} />
                </button>
              ))}
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {result.total_results} results found
            </p>
          </div>

          {/* Post cards */}
          {result.results?.map((post, idx) => (
            <div key={post.post_id || idx} className="post-card fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tag">r/{post.subreddit}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    by u/{post.author}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {post.similarity_score && (
                    <span className="text-xs px-2 py-1 rounded-md font-mono"
                      style={{
                        background: `rgba(16, 185, 129, ${Math.min(post.similarity_score, 1) * 0.3})`,
                        color: 'var(--color-accent-success)',
                      }}
                    >
                      {(post.similarity_score * 100).toFixed(1)}% match
                    </span>
                  )}
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-warm)' }}>
                    ↑ {post.score}
                  </span>
                </div>
              </div>

              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {post.title}
              </h4>

              {post.selftext && (
                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {post.selftext.slice(0, 250)}
                  {post.selftext.length > 250 ? '...' : ''}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span>💬 {post.num_comments} comments</span>
                <span>{post.created_utc ? new Date(post.created_utc).toLocaleDateString() : ''}</span>
                {post.permalink && (
                  <a
                    href={`https://reddit.com${post.permalink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'var(--color-accent-tertiary)' }}
                  >
                    View on Reddit →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
            <HiOutlineSearch size={36} style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Explore Digital Narratives
          </h3>
          <p className="text-sm max-w-md" style={{ color: 'var(--color-text-muted)' }}>
            Try searching for concepts, themes, or questions. The AI finds semantically similar posts — 
            no keyword matching needed.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {[
              'How do communities organize mutual aid?',
              'International solidarity movements',
              'Debates about political philosophy',
            ].map((example, i) => (
              <button
                key={i}
                className="btn-secondary text-xs"
                onClick={() => handleFollowUp(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
