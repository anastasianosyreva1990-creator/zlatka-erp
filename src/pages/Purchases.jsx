import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const fmtD = x => parseFloat(x).toFixed(2)

const STATUSES = {
  'transit': { label: 'В пути', color: '#185FA5', bg: '#E6F1FB' },
  'delivered': { label: 'Получено', color: '#1A4A28', bg: '#D8EED8' },
  'ordered': { label: 'Заказано', color: '#6A4A10', bg: '#EEE4C8' },
}

const DAILY_USE = {
  'Кожа Красная': 515/14 * 0.0476,
  'Кожа Белая': 63/14 * 0.0476,
  'Кожа Черная': 164/14 * 0.0476,
  'Габардин Цветной': 19/14 * 0.0555,
  'Резинка Черная': (515+164+19)/14 * 0.2,
  'Резинка Белая': 63/14 * 0.2,
  'Регулятор Черный': (515+164+19)/14 * 2,
  'Регулятор Белый': 63/14 * 2,
  'Основа пластиковая': (515+63+164+19)/14 * 1,
  'Бопп пакет': (515+63+164+19)/14 * 1,
  'Коробка 12×12×4': (515+63+164+19)/14 * 1,
  'Коробка 12*12*4': (515+63+164+19)/14 * 1,
  'Короб 60×40×40': (515+63+164+19)/14 / 96,
  'Короб 60*40*40': (515+63+164+19)/14 / 96,
  'Коробка 60×40×40': (515+63+164+19)/14 / 96,
}

export default function Purchases() {
  const [materials, setMaterials] = useState([])
  const [purchases, setPurchases] = useState([])
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('signals')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const [newMat, setNewMat] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newSum, setNewSum] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newSupplier, setNewSupplier] = useState('')
  const [newArrival, setNewArrival] = useState('')
  const [newStatus, setNewStatus] = useState('ordered')
  const [newFb, setNewFb] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: m }, { data: p }, { data: s }] = await Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('purchases').select('*, materials(name, unit)').order('order_date', { ascending: false }),
      supabase.from('material_stock').select('*, materials(name, unit)'),
    ])
    setMaterials(m || [])
    setPurchases(p || [])
    setStocks(s || [])
    if (m?.length > 0) setNewMat(m[0].id)
    setLoading(false)
  }

  function getStock(matId) {
    return stocks.filter(s => s.material_id === matId && s.location === 'warehouse').reduce((a, s) => a + s.quantity, 0)
  }

  function getInTransit(matId) {
    return purchases.filter(p => p.material_id === matId && p.status === 'transit').reduce((a, p) => a + p.quantity, 0)
  }

  function daysLeft(mat) {
    const stock = getStock(mat.id)
    const transit = getInTransit(mat.id)
    const daily = DAILY_USE[mat.name] || 0
    if (daily <= 0) return 999
    return Math.floor((stock + transit) / daily)
  }

  function needToOrder(mat) {
    const stock = getStock(mat.id)
    const transit = getInTransit(mat.id)
    const daily = DAILY_USE[mat.name] || 0
    const need14 = Math.ceil(daily * 14)
    return Math.max(0, need14 - stock - transit)
  }

  async function addPurchase() {
    if (!newMat || !newQty) { setNewFb('Заполните материал и количество'); return }
    const qty = parseFloat(newQty)
    const sum = parseFloat(newSum) || 0
    await supabase.from('purchases').insert({
      material_id: newMat, quantity: qty, total_sum: sum,
      price_per_unit: qty > 0 ? sum / qty : 0,
      order_date: newDate, arrival_date: newArrival || null,
      supplier: newSupplier || '—', status: newStatus,
    })
    setNewFb('✓ Закупка добавлена')
    setNewQty(''); setNewSum(''); setNewSupplier(''); setNewArrival('')
    loadAll()
  }

  async function setStatus(id, val) {
    await supabase.from('purchases').update({ status: val }).eq('id', id)
    loadAll()
  }

  async function deletePurchase(id) {
    if (!window.confirm('Удалить запись?')) return
    await supabase.from('purchases').delete().eq('id', id)
    loadAll()
  }

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  // Группируем по категории
  const categoryOrder = ['🧵 Ткани и кожа', '⚙️ Фурнитура', '📦 Упаковка', 'Прочее']
  const catMap = { 'Ткань': '🧵 Ткани и кожа', 'Кожа': '🧵 Ткани и кожа', 'Фурнитура': '⚙️ Фурнитура', 'Упаковка': '📦 Упаковка' }
  const grouped = {}
  categoryOrder.forEach(c => grouped[c] = [])
  materials.forEach(mat => {
    const cat = catMap[mat.category] || 'Прочее'
    grouped[cat].push(mat)
  })

  const filteredPurchases = purchases.filter(p => {
    if (filter === 'transit') return p.status === 'transit'
    if (filter === 'ordered') return p.status === 'ordered'
    if (filter === 'delivered') return p.status === 'delivered'
    return true
  })
  const totalPages = Math.ceil(filteredPurchases.length / PAGE_SIZE)
  const pagedPurchases = filteredPurchases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const criticalCount = materials.filter(m => DAILY_USE[m.name] > 0 && daysLeft(m) <= 3).length
  const warningCount = materials.filter(m => DAILY_USE[m.name] > 0 && daysLeft(m) > 3 && daysLeft(m) <= 7).length

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${activeTab === id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
      background: activeTab === id ? '#1C2E26' : 'transparent',
      color: activeTab === id ? '#C4A882' : '#4A3A2A'
    }}>{label}</button>
  )

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2E26', marginBottom: 20 }}>
        Закупки / <span style={{ color: '#C4A882' }}>Материалы</span>
      </h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <TabBtn id="signals" label={`Сигналы${criticalCount > 0 ? ` 🔴${criticalCount}` : warningCount > 0 ? ` 🟡${warningCount}` : ''}`}/>
        <TabBtn id="registry" label="Реестр закупок"/>
        <TabBtn id="add" label="Добавить закупку"/>
      </div>

      {activeTab === 'signals' && (
        <div>
          <div style={{ fontSize: 12, color: '#6A4A10', background: '#EEE4C8', padding: '8px 14px', borderRadius: 8, marginBottom: 16 }}>
            ⓘ Расчёт потребности на 14 дней исходя из темпа производства апреля 2026: 515 красных + 63 белых + 164 чёрных + 19 цветных = 761 шт/мес. Норматив расхода на 1 изделие × темп = расход/день.
          </div>
          {categoryOrder.map(catLabel => {
            const mats = grouped[catLabel]
            if (!mats || mats.length === 0) return null
            return (
              <div key={catLabel} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: '#5A4A3A', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  {catLabel}
                </div>
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F5F0E8' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#4A3A2A', fontWeight: 700, fontSize: 10, borderBottom: '1px solid rgba(196,168,130,0.2)', whiteSpace: 'nowrap' }}>Материал</th>
                        {['На складе','В пути','Расход/день','Дней запаса','','Заказать'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 10, borderBottom: '1px solid rgba(196,168,130,0.2)', whiteSpace: 'nowrap', width: '1%' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mats.map(mat => {
                        const stock = getStock(mat.id)
                        const transit = getInTransit(mat.id)
                        const days = daysLeft(mat)
                        const need = needToOrder(mat)
                        const daily = DAILY_USE[mat.name] || 0
                        let dayColor = '#1A6B28', dayBg = 'transparent'
                        if (days <= 3 && daily > 0) { dayColor = '#6A1030'; dayBg = '#EED4DD' }
                        else if (days <= 7 && daily > 0) { dayColor = '#6A4A10'; dayBg = '#EEE4C8' }
                        return (
                          <tr key={mat.id}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1C2E26', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap' }}>{mat.name}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontWeight: 700, whiteSpace: 'nowrap', width: '1%' }}>{fmt(stock)} {mat.unit}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)', color: transit > 0 ? '#185FA5' : '#D5CEC5', fontWeight: transit > 0 ? 700 : 400, whiteSpace: 'nowrap', width: '1%' }}>
                              {transit > 0 ? `${fmt(transit)} ${mat.unit}` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)', color: '#7A6A5A', whiteSpace: 'nowrap', width: '1%' }}>
                              {daily > 0 ? `${daily.toFixed(2)} ${mat.unit}` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: dayColor, background: dayBg, padding: '2px 8px', borderRadius: 6 }}>
                                {daily <= 0 ? '—' : days > 99 ? '∞' : `${days} дн`}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                              {daily <= 0 ? '' : days <= 3 ? <span style={{ fontSize: 10, fontWeight: 800, color: '#6A1030' }}>🔴 Срочно</span>
                                : days <= 7 ? <span style={{ fontSize: 10, fontWeight: 800, color: '#6A4A10' }}>🟡 Скоро</span>
                                : <span style={{ fontSize: 10, fontWeight: 700, color: '#1A6B28' }}>🟢 Норма</span>}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                              {need > 0
                                ? <span style={{ fontSize: 11, fontWeight: 800, color: days <= 3 ? '#6A1030' : '#6A4A10' }}>+{fmt(need)} {mat.unit}</span>
                                : <span style={{ fontSize: 11, color: '#D5CEC5' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'registry' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[
              { id: 'all', label: 'Все' },
              { id: 'ordered', label: 'Заказано' },
              { id: 'transit', label: 'В пути' },
              { id: 'delivered', label: 'Получено' },
            ].map(f => (
              <button key={f.id} onClick={() => { setFilter(f.id); setPage(1) }} style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${filter === f.id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
                background: filter === f.id ? '#1C2E26' : 'transparent',
                color: filter === f.id ? '#C4A882' : '#4A3A2A'
              }}>{f.label}</button>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  <th style={{ padding:'8px 10px', textAlign:'left', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap', width:'1%' }}>Дата</th>
                  <th style={{ padding:'8px 10px', textAlign:'left', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap' }}>Материал</th>
                  {['Кол-во','Сумма','Цена/ед'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'right', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap', width:'1%' }}>{h}</th>
                  ))}
                  <th style={{ padding:'8px 10px', textAlign:'left', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap', width:'1%' }}>Поставщик</th>
                  <th style={{ padding:'8px 10px', textAlign:'left', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap', width:'1%' }}>Статус</th>
                  <th style={{ padding:'8px 10px', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap', width:'1%' }}></th>
                </tr>
              </thead>
              <tbody>
                {pagedPurchases.map(p => {
                  const st = STATUSES[p.status] || STATUSES['delivered']
                  return (
                    <tr key={p.id}>
                      <td style={{ padding: '7px 10px', color: '#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                        {p.order_date ? new Date(p.order_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap' }}>{p.materials?.name}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontWeight: 700, whiteSpace: 'nowrap', width: '1%', textAlign: 'right' }}>{fmt(p.quantity)} {p.materials?.unit}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontWeight: 800, color: '#1C2E26', whiteSpace: 'nowrap', width: '1%', textAlign: 'right' }}>{fmt(p.total_sum)} ₽</td>
                      <td style={{ padding: '7px 10px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', color: '#7A6A5A', whiteSpace: 'nowrap', width: '1%', textAlign: 'right' }}>{fmtD(p.price_per_unit)} ₽</td>
                      <td style={{ padding: '7px 10px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', color: '#7A6A5A', whiteSpace: 'nowrap', width: '1%' }}>{p.supplier || '—'}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                        <select value={p.status} onChange={e => setStatus(p.id, e.target.value)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${st.color}`, background: st.bg, cursor: 'pointer', fontWeight: 700, color: st.color }}>
                          <option value="ordered">Заказано</option>
                          <option value="transit">В пути</option>
                          <option value="delivered">Получено</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                        <button onClick={() => deletePurchase(p.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #EED4DD', background: '#EED4DD', color: '#6A1030', cursor: 'pointer', fontWeight: 700 }}>
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredPurchases.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#7A6A5A' }}>Нет закупок</td></tr>
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(196,168,130,0.15)', fontSize: 12 }}>
                <span style={{ color: '#7A6A5A' }}>Показано {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filteredPurchases.length)} из {filteredPurchases.length}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(74,111,82,0.2)', background: page===1?'#F5F5F5':'#fff', cursor: page===1?'default':'pointer', fontSize: 11, fontWeight: 700, color: page===1?'#CCC':'#4A3A2A' }}>
                    ←
                  </button>
                  {Array.from({length: totalPages}, (_, i) => i+1).filter(n => Math.abs(n-page) <= 2).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${n===page?'#1C2E26':'rgba(74,111,82,0.2)'}`, background: n===page?'#1C2E26':'#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: n===page?'#C4A882':'#4A3A2A' }}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(74,111,82,0.2)', background: page===totalPages?'#F5F5F5':'#fff', cursor: page===totalPages?'default':'pointer', fontSize: 11, fontWeight: 700, color: page===totalPages?'#CCC':'#4A3A2A' }}>
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', padding: '20px 22px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2E26', marginBottom: 16 }}>Добавить закупку</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Материал</div>
                <select value={newMat} onChange={e => setNewMat(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Количество</div>
                <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="0"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Сумма, ₽</div>
                <input type="number" value={newSum} onChange={e => setNewSum(e.target.value)} placeholder="0"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Дата заказа</div>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Дата прихода</div>
                <input type="date" value={newArrival} onChange={e => setNewArrival(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Поставщик</div>
                <input type="text" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="Название"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Статус</div>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}>
                  <option value="ordered">Заказано</option>
                  <option value="transit">В пути</option>
                  <option value="delivered">Получено</option>
                </select>
              </div>
            </div>
            <button onClick={addPurchase} style={{ padding: '8px 20px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Добавить
            </button>
            {newFb && <div style={{ marginTop: 10, fontSize: 12, color: '#1A6B28', fontWeight: 700 }}>{newFb}</div>}
          </div>
        </div>
      )}
    </div>
  )
}