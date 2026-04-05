import { useState, useRef } from 'react'

export default function SearchChat({ apiBase }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const suggestions = [
    'How do communities organize mutual aid?',
    'International solidarity movements',
    'Philosophical debates on radicalism'
  ]

  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || query).trim()
    if (!q) {
      setError('Please enter a search query.')
      return
    }
    setQuery(q)
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

  const LoadingState = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '64px 0', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '32px', height: '2px', backgroundColor: '#FF4D00',
        animation: 'loadingBar 1.2s ease-in-out infinite' }} />
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', 
        color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Loading
      </span>
    </div>
  )

  const EmptyState = () => (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '32px', 
        color: '#E8E4DE', marginBottom: '16px' }}>○</div>
      <p style={{ fontFamily: 'Playfair Display', fontSize: '18px', 
        color: '#9B9B9B', fontStyle: 'italic', marginBottom: '24px' }}>
        No results found. Try a broader search.
      </p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => handleSearch(s)}
            style={{ fontFamily: 'Inter', fontSize: '13px', color: '#FF4D00',
              backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
              textDecoration: 'underline' }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '80px' }}>
      
      {/* Page header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
          color: '#FF4D00', letterSpacing: '2px', textTransform: 'uppercase',
          marginBottom: '12px' }}>
          Search & Analysis
        </div>
        <h1 style={{ fontFamily: 'Playfair Display', fontSize: '36px', 
          fontWeight: 700, color: '#1C1C1C', lineHeight: 1.2, marginBottom: '12px' }}>
          Semantic Search & Chat
        </h1>
        <p style={{ fontFamily: 'Inter', fontSize: '15px', 
          color: '#6B6B6B', lineHeight: 1.6, maxWidth: '600px' }}>
          Search by meaning, not keywords. The AI finds thematically 
          similar posts across thousands of records.
        </p>
        <div style={{ height: '1px', backgroundColor: '#E8E4DE', marginTop: '24px' }} />
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '32px' }}>
        <input
          ref={inputRef}
          style={{
            flex: 1, padding: '16px 20px',
            fontFamily: 'Inter', fontSize: '15px', color: '#1C1C1C',
            backgroundColor: '#FFFFFF', border: '1.5px solid #E8E4DE',
            borderRight: 'none', outline: 'none',
            borderRadius: '6px 0 0 6px'
          }}
          placeholder="e.g. How are communities organizing resistance online?"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={{
          padding: '16px 28px', backgroundColor: '#FF4D00',
          color: '#FFFFFF', fontFamily: 'JetBrains Mono', fontSize: '12px',
          fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer', borderRadius: '0 6px 6px 0',
          transition: 'background 150ms', opacity: loading ? 0.7 : 1
        }}
        onClick={() => handleSearch()}
        disabled={loading}
        onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#E64400')}
        onMouseLeave={e => !loading && (e.currentTarget.style.backgroundColor = '#FF4D00')}>
          Search
        </button>
      </div>

      {!result && !loading && !error && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
          {suggestions.map(s => (
            <button key={s} style={{
              padding: '8px 16px', backgroundColor: '#F0EDE8',
              border: '1px solid #E8E4DE', borderRadius: '100px',
              fontFamily: 'Inter', fontSize: '13px', color: '#6B6B6B',
              cursor: 'pointer', transition: 'all 150ms'
            }}
            onClick={() => handleSearch(s)}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FF4D00'; 
              e.currentTarget.style.color = '#FFFFFF'; 
              e.currentTarget.style.borderColor = '#FF4D00'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F0EDE8'; 
              e.currentTarget.style.color = '#6B6B6B'; 
              e.currentTarget.style.borderColor = '#E8E4DE'; }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#FFF5F0', border: '1px solid #FFD4C2',
          borderLeft: '4px solid #FF4D00', borderRadius: '0 8px 8px 0',
          padding: '16px 20px', marginBottom: '24px' }}>
          <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#CC3D00' }}>
            ⚠ {error}
          </span>
        </div>
      )}
      
      {result?.warning && (
        <div style={{ backgroundColor: '#FFFDF0', border: '1px solid #FFECB3',
          borderLeft: '4px solid #F5E642', borderRadius: '0 8px 8px 0',
          padding: '16px 20px', marginBottom: '24px' }}>
          <span style={{ fontFamily: 'Inter', fontSize: '13px', color: '#1C1C1C' }}>
            Note: {result.warning}
          </span>
        </div>
      )}

      {loading && <LoadingState />}

      {result?.results?.length === 0 && !loading && !error && <EmptyState />}

      {result && result.results && result.results.length > 0 && !loading && (
        <div>
          {/* AI Summary box */}
          {result.chatbot?.summary && (
            <div style={{
              backgroundColor: '#F0F7FF', border: '1px solid #CCE0FF',
              borderLeft: '4px solid #0066FF', borderRadius: '0 8px 8px 0',
              padding: '20px 24px', marginBottom: '32px'
            }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
                color: '#0066FF', letterSpacing: '2px', textTransform: 'uppercase',
                marginBottom: '10px' }}>
                ◆ AI Analysis
              </div>
              <p style={{ fontFamily: 'Inter', fontSize: '14px', 
                color: '#1C1C1C', lineHeight: 1.7, fontStyle: 'italic' }}>
                {result.chatbot.summary}
              </p>
            </div>
          )}

          {/* Follow-up suggestions */}
          {result.chatbot?.follow_up_queries?.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', 
                color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase',
                marginBottom: '12px' }}>
                Explore next
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.chatbot.follow_up_queries.map(q => (
                  <button key={q} style={{
                    padding: '8px 14px', backgroundColor: 'transparent',
                    border: '1.5px dashed #FF4D00', borderRadius: '4px',
                    fontFamily: 'Inter', fontSize: '12px', color: '#FF4D00',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSearch(q)}>
                    → {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents Found Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', 
            alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
              color: '#9B9B9B', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Documents Found
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#FF4D00' }}>
              {result.total_results} items
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.results.map((post, idx) => {
              const relevance = post.similarity_score ? (post.similarity_score * 100).toFixed(1) : 0;
              const date = post.created_utc ? new Date(post.created_utc).toLocaleDateString() : 'Unknown';

              return (
                <div key={post.post_id || idx} style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E8E4DE',
                  borderLeft: '4px solid #FF4D00', borderRadius: '0 8px 8px 0',
                  padding: '20px 24px', transition: 'box-shadow 150ms'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', 
                    alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'Inter', fontSize: '13px', 
                        fontWeight: 600, color: '#1C1C1C' }}>{post.author}</span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px',
                        color: '#FF4D00', backgroundColor: '#FFF0EB', padding: '2px 8px',
                        borderRadius: '100px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        r/{post.subreddit}
                      </span>
                    </div>
                    {relevance > 0 && (
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
                        color: '#00A86B', fontWeight: 600 }}>
                        {relevance}% match
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'Playfair Display', fontSize: '16px', 
                    color: '#1C1C1C', lineHeight: 1.5, marginBottom: '12px' }}>
                    {post.title}
                  </p>
                  {post.selftext && (
                    <p style={{ fontFamily: 'Inter', fontSize: '13.5px', color: '#6B6B6B',
                      marginBottom: '16px', lineHeight: 1.6, maxHeight: '3.2em', 
                      WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.selftext}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#9B9B9B' }}>
                        ↑ {post.score}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#9B9B9B' }}>
                        💬 {post.num_comments}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#9B9B9B' }}>
                        {date}
                      </span>
                    </div>
                    {post.permalink && (
                      <a href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', 
                        color: '#0066FF', textDecoration: 'none' }}>
                        Source →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}
