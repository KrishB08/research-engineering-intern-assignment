export default function Sidebar({ activeSection, onSectionChange, stats, statsLoading }) {
  const navItems = [
    { id: 'search', label: 'Search & Chat' },
    { id: 'timeseries', label: 'Time Series' },
    { id: 'network', label: 'Network Graph' },
    { id: 'clusters', label: 'Topic Clusters' },
    { id: 'casestudy', label: 'Case Study' },
  ];

  const isOnline = !statsLoading && stats !== null;

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      backgroundColor: '#1C1C1C',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      zIndex: 100
    }}>
      {/* Logo area */}
      <div style={{ padding: '24px 28px', borderBottom: '1px solid #333' }}>
        <div style={{ 
          fontFamily: 'Playfair Display', fontSize: '22px', 
          fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.5px' 
        }}>
          SimPPL
        </div>
        <div style={{ 
          fontFamily: 'JetBrains Mono', fontSize: '10px', 
          color: '#666', letterSpacing: '3px', marginTop: '4px', textTransform: 'uppercase' 
        }}>
          Narratives Lab
        </div>
      </div>

      {/* Navigation items */}
      <div style={{ padding: '20px 0', flex: 1 }}>
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          
          if (isActive) {
            return (
              <div 
                key={item.id}
                style={{ 
                  padding: '14px 28px', cursor: 'pointer',
                  color: '#FFFFFF', fontSize: '14px', fontWeight: 600,
                  fontFamily: 'Inter', backgroundColor: '#2A2A2A',
                  borderLeft: '3px solid #FF4D00' 
                }}
                onClick={() => onSectionChange(item.id)}
              >
                {item.label}
              </div>
            );
          } else {
            return (
              <div 
                key={item.id}
                style={{ 
                  padding: '14px 28px', cursor: 'pointer', 
                  color: '#999', fontSize: '14px', fontWeight: 500,
                  fontFamily: 'Inter', transition: 'all 150ms',
                  borderLeft: '3px solid transparent' 
                }}
                onClick={() => onSectionChange(item.id)}
                onMouseEnter={e => { 
                  e.currentTarget.style.color = '#E8E8E6'; 
                  e.currentTarget.style.borderLeftColor = '#444'; 
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.color = '#999'; 
                  e.currentTarget.style.borderLeftColor = 'transparent'; 
                }}
              >
                {item.label}
              </div>
            );
          }
        })}
      </div>

      {/* Status indicator */}
      <div style={{ 
        marginTop: 'auto', padding: '20px 28px', 
        borderTop: '1px solid #333', display: 'flex', alignItems: 'center', gap: '8px' 
      }}>
        {statsLoading ? (
           <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#666' }}>
             Checking...
           </span>
        ) : (
          <>
            <div style={{ 
              width: '7px', height: '7px', borderRadius: '50%',
              backgroundColor: isOnline ? '#00A86B' : '#FF4D00' 
            }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: '#666' }}>
              {isOnline ? 'API Connected' : 'API Offline'}
            </span>
          </>
        )}
      </div>
    </aside>
  );
}
