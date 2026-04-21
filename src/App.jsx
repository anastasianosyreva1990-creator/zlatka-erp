import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Production from './pages/Production'
import Batches from './pages/Batches'
import Purchases from './pages/Purchases'
import Wildberries from './pages/Wildberries'
import Finance from './pages/Finance'
import Documents from './pages/Documents'
import './index.css'

const NAV_ITEMS = [
  { to: '/', label: 'Производство', end: true },
  { to: '/batches', label: 'Партии' },
  { to: '/purchases', label: 'Закупки' },
  { to: '/wb', label: 'Wildberries' },
  { to: '/finance', label: 'Финансы' },
  { to: '/docs', label: 'Документы' },
]

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <nav style={{
          width: 210, background: '#1C2E26', flexShrink: 0,
          position: 'fixed', top: 0, left: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          {/* Лого */}
          <div style={{ padding: '20px 18px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F2EBE0', letterSpacing: -0.5 }}>
              Злат<span style={{ color: '#C4A882' }}>ка</span>
            </div>
            <div style={{ fontSize: 9, color: '#7A9B84', letterSpacing: 3, textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>
              ERP · Производство
            </div>
            {/* Орнаментальный разделитель */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(196,168,130,0.25)' }}/>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M5 0L6.5 3.5H10L7 5.5L8.5 9L5 7L1.5 9L3 5.5L0 3.5H3.5L5 0Z" fill="rgba(196,168,130,0.5)"/>
              </svg>
              <div style={{ flex: 1, height: '1px', background: 'rgba(196,168,130,0.25)' }}/>
            </div>
          </div>

          {/* Навигация */}
          <div style={{ padding: '4px 10px', flex: 1 }}>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center',
                  padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                  color: isActive ? '#C4A882' : 'rgba(242,235,224,0.8)',
                  background: isActive ? 'rgba(196,168,130,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(196,168,130,0.25)' : '1px solid transparent',
                  textDecoration: 'none', fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 0.1,
                })}>
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Орнамент снизу — крупный, яркий */}
          <div style={{ padding: '10px 16px 18px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16 }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(196,168,130,0.25)' }}/>
              <svg width="8" height="8" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="3" fill="rgba(196,168,130,0.4)"/>
              </svg>
              <div style={{ flex: 1, height: '1px', background: 'rgba(196,168,130,0.25)' }}/>
            </div>

            {/* Ботанический орнамент с кокошником — крупнее и ярче */}
            <svg width="178" height="110" viewBox="0 0 178 110" fill="none" style={{ display: 'block', margin: '0 auto' }}>
              {/* Главный стебель */}
              <path d="M89 105 Q89 75 89 45" stroke="rgba(196,168,130,0.5)" strokeWidth="1.2"/>
              {/* Ветви */}
              <path d="M89 75 Q68 62 52 52" stroke="rgba(196,168,130,0.4)" strokeWidth="1"/>
              <path d="M89 62 Q110 50 126 42" stroke="rgba(196,168,130,0.4)" strokeWidth="1"/>
              <path d="M89 85 Q72 80 60 85" stroke="rgba(122,155,132,0.4)" strokeWidth="0.8"/>
              <path d="M89 85 Q106 80 118 85" stroke="rgba(122,155,132,0.4)" strokeWidth="0.8"/>
              {/* Листья крупнее */}
              <ellipse cx="50" cy="50" rx="9" ry="5" transform="rotate(-35 50 50)" fill="rgba(74,111,82,0.25)" stroke="rgba(122,155,132,0.5)" strokeWidth="0.8"/>
              <ellipse cx="35" cy="40" rx="7" ry="4" transform="rotate(-50 35 40)" fill="rgba(74,111,82,0.18)" stroke="rgba(122,155,132,0.4)" strokeWidth="0.6"/>
              <ellipse cx="60" cy="68" rx="7" ry="4" transform="rotate(-20 60 68)" fill="rgba(74,111,82,0.2)" stroke="rgba(122,155,132,0.4)" strokeWidth="0.6"/>
              <ellipse cx="128" cy="40" rx="9" ry="5" transform="rotate(35 128 40)" fill="rgba(74,111,82,0.25)" stroke="rgba(122,155,132,0.5)" strokeWidth="0.8"/>
              <ellipse cx="143" cy="30" rx="7" ry="4" transform="rotate(50 143 30)" fill="rgba(74,111,82,0.18)" stroke="rgba(122,155,132,0.4)" strokeWidth="0.6"/>
              <ellipse cx="118" cy="68" rx="7" ry="4" transform="rotate(20 118 68)" fill="rgba(74,111,82,0.2)" stroke="rgba(122,155,132,0.4)" strokeWidth="0.6"/>
              {/* Кокошник центральный — крупнее и ярче */}
              <path d="M72 45 Q89 28 106 45" stroke="rgba(196,168,130,0.7)" strokeWidth="1.2" fill="rgba(196,168,130,0.1)"/>
              <path d="M68 45 Q89 22 110 45" stroke="rgba(196,168,130,0.4)" strokeWidth="0.7" fill="none"/>
              <line x1="67" y1="45" x2="111" y2="45" stroke="rgba(196,168,130,0.8)" strokeWidth="1.5"/>
              <line x1="65" y1="48" x2="113" y2="48" stroke="rgba(196,168,130,0.3)" strokeWidth="1"/>
              <circle cx="89" cy="29" r="2.5" fill="rgba(196,168,130,0.6)"/>
              <circle cx="80" cy="36" r="1.2" fill="rgba(196,168,130,0.4)"/>
              <circle cx="98" cy="36" r="1.2" fill="rgba(196,168,130,0.4)"/>
              {/* Цветочки на ветках */}
              <circle cx="52" cy="49" r="3.5" fill="rgba(106,48,74,0.2)" stroke="rgba(106,48,74,0.4)" strokeWidth="0.8"/>
              <circle cx="52" cy="49" r="1.5" fill="rgba(196,168,130,0.5)"/>
              <circle cx="126" cy="40" r="3.5" fill="rgba(106,48,74,0.2)" stroke="rgba(106,48,74,0.4)" strokeWidth="0.8"/>
              <circle cx="126" cy="40" r="1.5" fill="rgba(196,168,130,0.5)"/>
              <circle cx="35" cy="38" r="2.5" fill="rgba(74,111,82,0.25)" stroke="rgba(122,155,132,0.4)" strokeWidth="0.6"/>
              <circle cx="143" cy="28" r="2.5" fill="rgba(74,111,82,0.25)" stroke="rgba(122,155,132,0.4)" strokeWidth="0.6"/>
              {/* Мелкие цветочки */}
              <circle cx="60" cy="66" r="2" fill="rgba(106,48,74,0.15)" stroke="rgba(106,48,74,0.3)" strokeWidth="0.5"/>
              <circle cx="118" cy="66" r="2" fill="rgba(106,48,74,0.15)" stroke="rgba(106,48,74,0.3)" strokeWidth="0.5"/>
              {/* Нижние травинки */}
              <path d="M68 88 Q64 78 68 70" stroke="rgba(122,155,132,0.35)" strokeWidth="0.8" fill="none"/>
              <path d="M110 88 Q114 78 110 70" stroke="rgba(122,155,132,0.35)" strokeWidth="0.8" fill="none"/>
              <path d="M78 98 Q74 86 79 78" stroke="rgba(122,155,132,0.25)" strokeWidth="0.7" fill="none"/>
              <path d="M100 98 Q104 86 99 78" stroke="rgba(122,155,132,0.25)" strokeWidth="0.7" fill="none"/>
            </svg>

            <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(196,168,130,0.5)', letterSpacing: 2.5, marginTop: 10, fontWeight: 700 }}>
              ЗЛАТКА · 2026
            </div>
          </div>
        </nav>

        <main style={{ marginLeft: 210, flex: 1, padding: '20px 24px', background: '#F0EBE1', minHeight: '100vh', minWidth: 0 }}>
<div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Production />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/wb" element={<Wildberries />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/docs" element={<Documents />} />
          </Routes>
        </div></main>
      </div>
    </BrowserRouter>
  )
}

export default App