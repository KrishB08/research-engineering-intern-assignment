import { useState, useRef } from 'react'

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

  const getTodayStr = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Top Bar / Page Header */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-[32px] font-serif text-navy">Semantic Search & Chat</h2>
          <span className="font-mono text-[11px] text-muted">{getTodayStr()}</span>
        </div>
        <hr className="border-t border-border-editorial mb-3" />
        <p className="text-[13px] font-sans italic text-muted">
          Search by meaning across thousands of digital records. The artificial intelligence evaluates thematic similarities, bypassing traditional keyword matching constraints.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="flex gap-0 mb-8">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-white border border-border-editorial rounded-none px-4 py-3 font-serif text-[16px] text-navy outline-none focus:border-navy transition-colors"
            placeholder="e.g., How are communities organizing resistance online?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className="bg-burnt-orange hover:bg-[#A33509] text-white px-6 py-3 font-mono text-[13px] tracking-wider uppercase rounded-none transition-colors duration-150 ease disabled:opacity-50"
          onClick={() => handleSearch()}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error & Warning */}
      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-6 font-sans text-sm">
          Error: {error}
        </div>
      )}
      {result?.warning && (
        <div className="border border-yellow-300 bg-yellow-highlight/30 text-navy p-3 mb-6 font-sans text-sm">
          Warning: {result.warning}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-24">
          <span className="font-mono text-[14px] text-navy">Loading...</span>
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-serif italic text-[18px] text-navy mb-6">
            Enter a query above to explore digital narratives across platforms.
          </p>
          <div className="flex flex-col gap-2 items-center">
            <span className="font-mono text-xs uppercase text-muted mb-2">Suggested Inquiries</span>
            {[
              'How do communities organize mutual aid?',
              'International solidarity movements',
              'Philosophical debates on radicalism',
            ].map((example, i) => (
              <button
                key={i}
                className="text-burnt-orange font-sans text-[14px] hover:underline"
                onClick={() => handleFollowUp(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && !loading && (
        <div className="space-y-6">
          
          {/* AI Analysis Block */}
          {result.chatbot?.summary && (
            <div className="mb-10 pl-6 border-l-4 border-forest-green bg-[#F0F7F4] py-4 pr-6">
              <span className="font-mono text-[11px] uppercase tracking-wider text-forest-green block mb-2">
                Automated Analysis
              </span>
              <p className="font-serif italic text-[16px] leading-relaxed text-navy">
                {result.chatbot.summary}
              </p>
              
              {result.chatbot?.follow_up_queries?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-forest-green/20">
                  <span className="font-mono text-[11px] text-forest-green uppercase block mb-2">Related threads</span>
                  <div className="flex flex-wrap gap-2">
                    {result.chatbot.follow_up_queries.map((fq, i) => (
                      <button
                        key={i}
                        className="border border-dashed border-burnt-orange text-burnt-orange rounded-none px-3 py-1 text-[12px] font-sans hover:bg-burnt-orange hover:text-white transition-colors duration-150 ease"
                        onClick={() => handleFollowUp(fq)}
                      >
                        {fq}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="font-mono text-[11px] text-muted border-b border-border-editorial pb-2 mb-4 uppercase tracking-widest flex justify-between">
            <span>Documents Found</span>
            <span>{result.total_results} items</span>
          </div>

          {/* Results List */}
          <div className="flex flex-col gap-0">
            {result.results?.map((post, idx) => (
              <div 
                key={post.post_id || idx} 
                className="border-b border-border-editorial/50 pl-4 py-6 border-l-[3px] border-l-burnt-orange hover:bg-sidebar transition-colors duration-100 ease"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-sans font-bold text-navy text-[15px]">
                      {post.author}
                    </span>
                    <span className="font-mono text-[11px] text-muted uppercase">
                      r/{post.subreddit}
                    </span>
                  </div>
                  <div className="flex gap-4">
                    {post.similarity_score && (
                      <span className="font-mono text-[11px] text-forest-green">
                        Relevance: {(post.similarity_score * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                
                <h4 className="font-serif font-bold text-[18px] text-navy mb-2 leading-snug">
                  {post.title}
                </h4>

                {post.selftext && (
                  <p className="font-serif text-[14px] text-navy/80 leading-relaxed max-h-[2.8em] overflow-hidden text-ellipsis mb-3">
                    {post.selftext}
                  </p>
                )}

                <div className="flex items-center gap-6 mt-3 font-mono text-[11px] text-muted uppercase tracking-wide">
                  <span>Comments: {post.num_comments}</span>
                  <span>Score: {post.score}</span>
                  <span>{post.created_utc ? new Date(post.created_utc).toLocaleDateString() : 'Unknown Date'}</span>
                  {post.permalink && (
                    <a
                      href={`https://reddit.com${post.permalink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-burnt-orange hover:underline ml-auto"
                    >
                      Source Link →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}
