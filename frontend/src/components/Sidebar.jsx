import {
  HiOutlineSearch,
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlineColorSwatch,
  HiOutlineBookOpen,
} from 'react-icons/hi'

const navItems = [
  { id: 'search', label: 'Search & Chat', icon: HiOutlineSearch },
  { id: 'timeseries', label: 'Time Series', icon: HiOutlineChartBar },
  { id: 'network', label: 'Network Graph', icon: HiOutlineGlobeAlt },
  { id: 'clusters', label: 'Topic Clusters', icon: HiOutlineColorSwatch },
  { id: 'casestudy', label: 'Case Study', icon: HiOutlineBookOpen },
]

export default function Sidebar({ activeSection, onSectionChange, stats, statsLoading }) {
  return (
    <aside className="sidebar">
      {/* Logo / Brand */}
      <div className="p-6 pb-2">
        <h1 className="text-xl font-bold gradient-text tracking-tight">SimPPL</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Digital Narratives Dashboard
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => onSectionChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Stats footer */}
      <div className="p-4 mx-3 mb-4 rounded-xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        {statsLoading ? (
          <div className="flex items-center gap-2">
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading stats...</span>
          </div>
        ) : stats ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Posts</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-primary)' }}>
                {stats.total_posts?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Authors</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-secondary)' }}>
                {stats.unique_authors?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Subreddits</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-tertiary)' }}>
                {stats.unique_subreddits?.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Backend offline
          </span>
        )}
      </div>
    </aside>
  )
}
