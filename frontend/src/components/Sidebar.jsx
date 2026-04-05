export default function Sidebar({ activeSection, onSectionChange, stats, statsLoading }) {
  const navItems = [
    { id: 'search', label: 'Search & Chat' },
    { id: 'timeseries', label: 'Time Series' },
    { id: 'network', label: 'Network Graph' },
    { id: 'clusters', label: 'Topic Clusters' },
    { id: 'casestudy', label: 'Case Study' },
  ];

  return (
    <aside className="w-[220px] min-w-[220px] h-screen bg-sidebar border-r border-border-editorial flex flex-col z-40 transition-all">
      {/* Logo / Brand */}
      <div className="px-6 py-8 border-b border-border-editorial">
        <h1 className="text-3xl font-bold font-serif text-navy tracking-tight">
          SimPPL
        </h1>
        <p className="text-[10px] mt-1 font-mono uppercase tracking-widest text-muted">
          Narratives Lab
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-8">
        <ul className="flex flex-col">
          {navItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  className={`w-full text-left py-3 px-6 text-[15px] cursor-pointer transition-colors duration-150 ease border-l-[4px] font-serif ${
                    isActive 
                      ? 'bg-newsprint border-burnt-orange font-semibold text-navy' 
                      : 'border-transparent text-navy hover:text-burnt-orange hover:border-burnt-orange/30'
                  }`}
                  onClick={() => onSectionChange(item.id)}
                >
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Stats footer & Status Indicator */}
      <div className="px-6 pb-6 pt-4 border-t border-border-editorial flex justify-between items-end">
        <div>
          {statsLoading ? (
            <span className="text-[11px] font-mono text-muted flex items-center gap-2">
              Loading...
            </span>
          ) : stats ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-forest-green" />
              <span className="text-[11px] font-mono text-navy">API Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-burnt-orange" />
              <span className="text-[11px] font-mono text-navy">API Offline</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
