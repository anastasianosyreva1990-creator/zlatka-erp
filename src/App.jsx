import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { signOut, getRole } from './lib/auth'
import Production from './pages/Production'
import Batches from './pages/Batches'
import Purchases from './pages/Purchases'
import Wildberries from './pages/Wildberries'
import Finance from './pages/Finance'
import Documents from './pages/Documents'
import Login from './pages/Login'
import SewerDashboard from './pages/SewerDashboard'
import * as XLSX from 'xlsx'
import './index.css'

const NAV_ITEMS = [
  { to: '/', label: 'Производство', end: true },
  { to: '/batches', label: 'Партии' },
  { to: '/purchases', label: 'Закупки' },
  { to: '/wb', label: 'Wildberries' },
  { to: '/finance', label: 'Финансы' },
  { to: '/docs', label: 'Документы' },
]

async function exportToExcel() {
  const wb = XLSX.utils.book_new()

  const [
    { data: orders },
    { data: shipments },
    { data: wbStocks },
    { data: productions },
    { data: purchases },
    { data: wbMonthly },
    { data: wbPayouts },
    { data: sewers },
  ] = await Promise.all([
    supabase.from('wb_orders').select('*').order('date'),
    supabase.from('shipments').select('*').order('ship_date'),
    supabase.from('wb_stocks').select('*'),
    supabase.from('productions').select('*, sewers(name, tariff)').order('date'),
    supabase.from('purchases').select('*, materials(name, unit)').order('order_date'),
    supabase.from('wb_monthly').select('*').order('month'),
    supabase.from('wb_payouts').select('*').order('payout_date'),
    supabase.from('sewers').select('*'),
  ])

  // 1. Заказы WB
  if (orders?.length) {
    const ws = XLSX.utils.json_to_sheet(orders.map(o => ({
      'Дата': o.date,
      'Красный': o.red,
      'Белый': o.white,
      'Черный': o.black,
      'Цветной': o.color,
      'Итого': o.red + o.white + o.black + o.color,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Заказы WB')
  }

  // 2. Отгрузки
  if (shipments?.length) {
    const ws = XLSX.utils.json_to_sheet(shipments.map(s => ({
      'Дата сдачи': s.ship_date,
      'Товар': s.product,
      'Количество': s.quantity,
      'Склад WB': s.warehouse,
      'ТК': s.tk,
      '№ Накладной': s.invoice_num,
      '№ Поставки WB': s.wb_supply_num,
      'ШК Короба': s.shk_box,
      'Дата прихода': s.arrival_date,
      'Статус': s.status,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Отгрузки')
  }

  // 3. Остатки WB
  if (wbStocks?.length) {
    const ws = XLSX.utils.json_to_sheet(wbStocks.map(s => ({
      'Склад': s.warehouse,
      'Товар': s.product,
      'Остаток': s.quantity,
      'В пути к клиенту': s.in_way_to_client || 0,
      'От клиента': s.in_way_from_client || 0,
      'Обновлено': s.updated_at,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Остатки WB')
  }

  // 4. Производство
  if (productions?.length) {
    const ws = XLSX.utils.json_to_sheet(productions.map(p => ({
      'Дата': p.date,
      'Швея': p.sewers?.name,
      'Изделие': p.product,
      'Количество': p.quantity,
      'Тариф': p.sewers?.tariff,
      'Начислено': p.earned,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Производство')
  }

  // 5. Закупки
  if (purchases?.length) {
    const ws = XLSX.utils.json_to_sheet(purchases.map(p => ({
      'Дата': p.order_date,
      'Материал': p.materials?.name,
      'Количество': p.quantity,
      'Ед.': p.materials?.unit,
      'Сумма': p.total_sum,
      'Цена/ед': p.price_per_unit,
      'Поставщик': p.supplier,
      'Статус': p.status === 'delivered' ? 'Получено' : p.status === 'transit' ? 'В пути' : 'Заказано',
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Закупки')
  }

  // 6. Финансы по месяцам
  if (wbMonthly?.length) {
    const ws = XLSX.utils.json_to_sheet(wbMonthly.map(d => ({
      'Месяц': d.month,
      'Выручка WB': d.revenue,
      'Логистика продажи': d.log_sale,
      'Логистика отмены': d.log_cancel,
      'Комиссия ВВ': d.vv,
      'Штрафы': d.shtraf,
      'Продано Красных': d.sold_red,
      'Продано Белых': d.sold_white,
      'Продано Черных': d.sold_black,
      'Продано Цветных': d.sold_color,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Финансы')
  }

  // 7. Выплаты WB
  if (wbPayouts?.length) {
    const ws = XLSX.utils.json_to_sheet(wbPayouts.map(p => ({
      'Дата выплаты': p.payout_date,
      'Период начала': p.period_start,
      'Период конца': p.period_end,
      'Сумма': p.net_amount,
      '№ Отчёта': p.report_num,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Выплаты WB')
  }

  // 8. Зарплаты по месяцам
  if (productions?.length && sewers?.length) {
    const months = [...new Set(productions.map(p => p.date?.slice(0, 7)))].sort()
    const rows = []
    sewers.forEach(sw => {
      months.forEach(month => {
        const prods = productions.filter(p => p.sewer_id === sw.id && p.date?.startsWith(month))
        const qty = prods.reduce((a, p) => a + p.quantity, 0)
        if (qty > 0) {
          rows.push({
            'Месяц': month,
            'Швея': sw.name,
            'Тариф': sw.tariff,
            'Сдано шт': qty,
            'Начислено': qty * sw.tariff,
          })
        }
      })
    })
    if (rows.length) {
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Зарплаты')
    }
  }

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `zlatka_export_${date}.xlsx`)
}

export default function App() {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const data = await getRole(userId)
    setProfile(data || { role: 'admin' })
  }

  async function handleLogout() {
    await signOut()
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportToExcel()
    } catch(e) {
      alert('Ошибка экспорта: ' + e.message)
    }
    setExporting(false)
  }

  if (user === undefined) return (
    <div style={{ minHeight:'100vh', background:'#F0EBE1', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:14, color:'#7A6A5A', fontWeight:600 }}>Загрузка...</div>
    </div>
  )

  if (!user) return <Login onLogin={() => {}} />

  if (profile?.role === 'sewer') return <SewerDashboard profile={profile} onLogout={handleLogout} />

  return (
    <BrowserRouter>
      <div style={{ display:'flex', minHeight:'100vh' }}>
        <nav style={{ width:210, background:'#1C2E26', flexShrink:0, position:'fixed', top:0, left:0, bottom:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'20px 18px 14px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#F2EBE0', letterSpacing:-0.5 }}>
              Злат<span style={{ color:'#C4A882' }}>ка</span>
            </div>
            <div style={{ fontSize:9, color:'#7A9B84', letterSpacing:3, textTransform:'uppercase', marginTop:3, fontWeight:600 }}>
              ERP · Производство
            </div>
            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ flex:1, height:'1px', background:'rgba(196,168,130,0.25)' }}/>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M5 0L6.5 3.5H10L7 5.5L8.5 9L5 7L1.5 9L3 5.5L0 3.5H3.5L5 0Z" fill="rgba(196,168,130,0.5)"/>
              </svg>
              <div style={{ flex:1, height:'1px', background:'rgba(196,168,130,0.25)' }}/>
            </div>
          </div>
          <div style={{ padding:'4px 10px', flex:1 }}>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center',
                  padding:'9px 12px', borderRadius:8, marginBottom:2,
                  color:isActive?'#C4A882':'rgba(242,235,224,0.8)',
                  background:isActive?'rgba(196,168,130,0.15)':'transparent',
                  border:isActive?'1px solid rgba(196,168,130,0.25)':'1px solid transparent',
                  textDecoration:'none', fontSize:13, fontWeight:isActive?700:500,
                })}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <div style={{ padding:'0 10px 10px' }}>
            <button onClick={handleExport} disabled={exporting} style={{
              width:'100%', padding:'8px 12px', borderRadius:8,
              border:'1px solid rgba(196,168,130,0.3)',
              background:'rgba(196,168,130,0.12)',
              color:'rgba(196,168,130,0.9)',
              fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'left',
              marginBottom:6
            }}>
              {exporting ? '⏳ Экспорт...' : '📥 Экспорт в Excel'}
            </button>
            <button onClick={handleLogout} style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid rgba(196,168,130,0.2)', background:'rgba(196,168,130,0.08)', color:'rgba(196,168,130,0.7)', fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'left' }}>
              Выйти из системы
            </button>
          </div>
          <div style={{ padding:'8px 16px 18px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:12 }}>
              <div style={{ flex:1, height:'1px', background:'rgba(196,168,130,0.25)' }}/>
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="rgba(196,168,130,0.4)"/></svg>
              <div style={{ flex:1, height:'1px', background:'rgba(196,168,130,0.25)' }}/>
            </div>
            <svg width="178" height="100" viewBox="0 0 178 100" fill="none" style={{ display:'block', margin:'0 auto' }}>
              <path d="M89 95 Q89 70 89 45" stroke="rgba(196,168,130,0.5)" strokeWidth="1.2"/>
              <path d="M89 75 Q68 62 52 52" stroke="rgba(196,168,130,0.4)" strokeWidth="1"/>
              <path d="M89 62 Q110 50 126 42" stroke="rgba(196,168,130,0.4)" strokeWidth="1"/>
              <ellipse cx="50" cy="50" rx="9" ry="5" transform="rotate(-35 50 50)" fill="rgba(74,111,82,0.25)" stroke="rgba(122,155,132,0.5)" strokeWidth="0.8"/>
              <ellipse cx="128" cy="40" rx="9" ry="5" transform="rotate(35 128 40)" fill="rgba(74,111,82,0.25)" stroke="rgba(122,155,132,0.5)" strokeWidth="0.8"/>
              <path d="M72 45 Q89 28 106 45" stroke="rgba(196,168,130,0.7)" strokeWidth="1.2" fill="rgba(196,168,130,0.1)"/>
              <line x1="67" y1="45" x2="111" y2="45" stroke="rgba(196,168,130,0.8)" strokeWidth="1.5"/>
              <circle cx="89" cy="29" r="2.5" fill="rgba(196,168,130,0.6)"/>
              <circle cx="52" cy="49" r="3.5" fill="rgba(106,48,74,0.2)" stroke="rgba(106,48,74,0.4)" strokeWidth="0.8"/>
              <circle cx="126" cy="40" r="3.5" fill="rgba(106,48,74,0.2)" stroke="rgba(106,48,74,0.4)" strokeWidth="0.8"/>
            </svg>
            <div style={{ textAlign:'center', fontSize:9, color:'rgba(196,168,130,0.5)', letterSpacing:2.5, marginTop:8, fontWeight:700 }}>
              ЗЛАТКА · 2026
            </div>
          </div>
        </nav>
        <main style={{ marginLeft:210, flex:1, padding:'20px 24px', background:'#F0EBE1', minHeight:'100vh', minWidth:0 }}>
          <div style={{ maxWidth:1600, margin:'0 auto' }}>
            <Routes>
              <Route path="/" element={<Production/>}/>
              <Route path="/batches" element={<Batches/>}/>
              <Route path="/purchases" element={<Purchases/>}/>
              <Route path="/wb" element={<Wildberries/>}/>
              <Route path="/finance" element={<Finance/>}/>
              <Route path="/docs" element={<Documents/>}/>
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}