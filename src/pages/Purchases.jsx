import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const fmtD = x => x.toFixed(1)

const DAILY_PROD = 900 / 7

const NORM = {
  'Кожа Белая': 0.0476, 'Кожа Красная': 0.0476, 'Кожа Черная': 0.0476,
  'Габардин Цветной': 0.0555, 'Резинка Черная': 0.2, 'Резинка Белая': 0.2,
  'Регулятор Белый': 2, 'Регулятор Черный': 2, 'Основа пластиковая': 1,
  'Бопп пакет': 1, 'Коробка 12×12×4': 1, 'Короб 60×40×40': 0.0093
}

export default function Purchases() {
  const [materials, setMaterials] = useState([])
  const [stocks, setStocks] = useState([])
  const [purchases, setPurchases] = useState([])
  const [sewers, setSewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('signals')

  // Форма заказа
  const [oMat, setOMat] = useState('')
  const [oQty, setOQty] = useState('')
  const [oSum, setOSum] = useState('')
  const [oDate, setODate] = useState(new Date().toISOString().split('T')[0])
  const [oSup, setOSup] = useState('')
  const [oDays, setODays] = useState(5)
  const [oDest, setODest] = useState('me')
  const [oFb, setOFb] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: m }, { data: st }, { data: p }, { data: sw }] = await Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('material_stock').select('*, materials(name, unit)'),
      supabase.from('purchases').select('*, materials(name, unit)').order('order_date', { ascending: false }),
      supabase.from('sewers').select('*').eq('active', true),
    ])
    setMaterials(m || [])
    setStocks(st || [])
    setPurchases(p || [])
    setSewers(sw || [])
    if (m?.length > 0) setOMat(m[0].id)
    setLoading(false)
  }

  function totalStock(matName) {
    return stocks
      .filter(s => s.materials?.name === matName && s.location !== 'ready')
      .reduce((a, s) => a + s.quantity, 0)
  }

  function inTransit(matName) {
    return purchases
      .filter(p => p.materials?.name === matName && p.status === 'transit')
      .reduce((a, p) => a + p.quantity, 0)
  }

  function daysLeft(matName) {
    const norm = NORM[matName]
    if (!norm) return null
    const total = totalStock(matName) + inTransit(matName)
    return Math.floor(total / (DAILY_PROD * norm))
  }

  async function addOrder() {
    if (!oQty || !oSum || !oDate) { setOFb('Заполните все поля'); return }
    const qty = parseFloat(oQty)
    const sum = parseFloat(oSum)
    const arrivalDate = new Date(oDate)
    arrivalDate.setDate(arrivalDate.getDate() + parseInt(oDays))

    await supabase.from('purchases').insert({
      material_id: oMat,
      quantity: qty,
      total_sum: sum,
      price_per_unit: sum / qty,
      supplier: oSup || '—',
      order_date: oDate,
      arrival_date: arrivalDate.toISOString().split('T')[0],
      destination: oDest,
      status: 'transit'
    })
    setOFb(`✓ Заказ оформлен · прибытие ${arrivalDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`)
    setOQty(''); setOSum('')
    loadAll()
  }

  async function receiveOrder(id) {
    const p = purchases.find(x => x.id === id)
    if (!p) return
    await supabase.from('purchases').update({ status: 'received' }).eq('id', id)
    // Зачисляем на склад
    const existing = stocks.find(s => s.material_id === p.material_id && s.location === 'warehouse')
    if (existing) {
      await supabase.from('material_stock').update({ quantity: existing.quantity + p.quantity }).eq('id', existing.id)
    } else {
      await supabase.from('material_stock').insert({ material_id: p.material_id, location: 'warehouse', quantity: p.quantity })
    }
    loadAll()
  }

  async function cancelOrder(id) {
    await supabase.from('purchases').update({ status: 'cancelled' }).eq('id', id)
    loadAll()
  }

  async function deleteOrder(id) {
    const p = purchases.find(x => x.id === id)
    if (p?.status === 'transit') { alert('Сначала отмените заказ'); return }
    await supabase.from('purchases').delete().eq('id', id)
    loadAll()
  }

  function prefillOrder(matId, matName) {
    setActiveTab('order')
    setOMat(matId)
    const total = totalStock(matName)
    const transit = inTransit(matName)
    const norm = NORM[matName] || 0
    const toOrder = Math.max(0, Math.ceil(DAILY_PROD * 14 * norm - total - transit))
    if (toOrder > 0) setOQty(Math.round(toOrder).toString())
    setODate(new Date().toISOString().split('T')[0])
  }

  const cats = [
    { name: 'Ткани', mats: ['Кожа Белая', 'Кожа Красная', 'Кожа Черная', 'Габардин Цветной'] },
    { name: 'Резинки', mats: ['Резинка Черная', 'Резинка Белая'] },
    { name: 'Регуляторы', mats: ['Регулятор Белый', 'Регулятор Черный'] },
    { name: 'Основа', mats: ['Основа пластиковая'] },
    { name: 'Расходники', mats: ['Бопп пакет', 'Коробка 12×12×4', 'Короб 60×40×40'] },
  ]

  const transit = purchases.filter(p => p.status === 'transit')
  const critCount = materials.filter(m => { const d = daysLeft(m.name); return d !== null && d <= 2 }).length
  const warnCount = materials.filter(m => { const d = daysLeft(m.name); return d !== null && d > 2 && d <= 7 }).length

  let frozen = 0
  stocks.filter(s => s.location !== 'ready').forEach(s => {
    const mat = materials.find(m => m.id === s.material_id)
    if (mat) frozen += s.quantity * mat.price_per_unit
  })

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Загрузка...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Златка <span style={{ color: '#5DCAA5' }}>/ Закупки</span></div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Срочно заказать', value: critCount, color: '#E24B4A', sub: 'позиций' },
          { label: 'Заказать скоро', value: warnCount, color: '#BA7517', sub: 'позиций' },
          { label: 'В пути', value: transit.length, color: '#111', sub: 'заказов' },
          { label: 'Заморожено в мат-лах', value: fmt(Math.round(frozen)) + ' ₽', color: '#111', sub: 'мой склад + у швей' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'signals', label: 'Сигналы' },
          { id: 'transit', label: 'В пути' },
          { id: 'order', label: 'Заказать' },
          { id: 'history', label: 'Реестр закупок' },
          { id: 'prices', label: 'Справочник цен' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '6px 16px', borderRadius: 20,
            border: activeTab === t.id ? '1px solid #5DCAA5' : '1px solid #e5e7eb',
            background: activeTab === t.id ? '#f0fdf8' : 'transparent',
            color: activeTab === t.id ? '#085041' : '#666',
            cursor: 'pointer', fontSize: 13
          }}>{t.label}</button>
        ))}
      </div>

      {/* СИГНАЛЫ */}
      {activeTab === 'signals' && (
        <div>
          <div style={{ fontSize: 12, color: '#888', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
            Запас в днях = (мой склад + у всех швей + в пути) ÷ (производительность ~129 шт/день × норма расхода на 1 шт)
          </div>
          {['Срочно заказать', 'Заказать скоро', 'В норме'].map(group => {
            const groupMats = materials.filter(m => {
              const d = daysLeft(m.name)
              if (d === null) return false
              if (group === 'Срочно заказать') return d <= 2
              if (group === 'Заказать скоро') return d > 2 && d <= 7
              return d > 7
            })
            if (groupMats.length === 0) return null
            const bgMap = { 'Срочно заказать': '#FCEBEB', 'Заказать скоро': '#FAEEDA', 'В норме': '#EAF3DE' }
            const colMap = { 'Срочно заказать': '#A32D2D', 'Заказать скоро': '#854F0B', 'В норме': '#3B6D11' }
            return (
              <div key={group}>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, marginTop: 12 }}>{group}</div>
                {groupMats.map(mat => {
                  const d = daysLeft(mat.name)
                  const total = totalStock(mat.name)
                  const tr = inTransit(mat.name)
                  const norm = NORM[mat.name] || 0
                  const toOrder = Math.max(0, Math.ceil(DAILY_PROD * 14 * norm - total - tr))
                  return (
                    <div key={mat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, marginBottom: 6, background: bgMap[group], gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{mat.name}</div>
                        <div style={{ fontSize: 12, color: colMap[group], marginTop: 2 }}>
                          Склад: {fmt(total)} {mat.unit} · В пути: {fmt(tr)} {mat.unit}
                          {toOrder > 0 ? ` · Заказать +${fmt(toOrder)} ${mat.unit}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: colMap[group] }}>{d > 99 ? '99+' : d}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>дней</div>
                      </div>
                      {group !== 'В норме' && (
                        <button onClick={() => prefillOrder(mat.id, mat.name)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Заказать →
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* В ПУТИ */}
      {activeTab === 'transit' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px', marginBottom: 12 }}>
            {transit.length === 0 ? (
              <div style={{ color: '#aaa', fontSize: 13 }}>Нет материалов в пути</div>
            ) : (
              transit.map(p => {
                const arr = new Date(p.arrival_date)
                const now = new Date(); now.setHours(0,0,0,0)
                const d = Math.round((arr - now) / 86400000)
                let badge = { bg: '#E6F1FB', color: '#185FA5', text: `через ${d} дн` }
                if (d <= 0) badge = { bg: '#EAF3DE', color: '#3B6D11', text: 'сегодня' }
                else if (d <= 2) badge = { bg: '#FAEEDA', color: '#854F0B', text: d === 1 ? 'завтра' : `через ${d} дн` }
                const dest = p.destination === 'me' ? 'Мой склад' : sewers.find(s => s.id === p.destination)?.name || p.destination
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, flex: 1, minWidth: 120 }}>{p.materials?.name}</span>
                    <span style={{ color: '#444' }}>{fmt(p.quantity)} {p.materials?.unit}</span>
                    <span style={{ color: '#888' }}>{p.supplier}</span>
                    <span style={{ color: '#888' }}>{dest}</span>
                    <span style={{ color: '#888' }}>{arr.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.text}</span>
                    <button onClick={() => receiveOrder(p.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>Получено</button>
                    <button onClick={() => cancelOrder(p.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#666' }}>Отменить</button>
                  </div>
                )
              })
            )}
          </div>
          <div style={{ fontSize: 12, color: '#888', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
            Цепочка: «Получено» → зачислилось на мой склад → швея отметила «Получила материал» → списалось с моего склада
          </div>
        </div>
      )}

      {/* ЗАКАЗАТЬ */}
      {activeTab === 'order' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Оформить заказ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Материал</div>
                <select value={oMat} onChange={e => setOMat(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Количество</div>
                <input type="number" value={oQty} onChange={e => setOQty(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Сумма, ₽</div>
                <input type="number" value={oSum} onChange={e => setOSum(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Дата заказа</div>
                <input type="date" value={oDate} onChange={e => setODate(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Поставщик</div>
                <input type="text" value={oSup} onChange={e => setOSup(e.target.value)} placeholder="star-tex.ru / Ozon" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Дней доставки</div>
                <input type="number" value={oDays} onChange={e => setODays(e.target.value)} min="1" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Куда</div>
              <select value={oDest} onChange={e => setODest(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                <option value="me">На мой склад</option>
                {sewers.map(s => <option key={s.id} value={s.id}>Сразу к {s.name}</option>)}
              </select>
            </div>
            <button onClick={addOrder} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              Оформить заказ
            </button>
            {oFb && <div style={{ fontSize: 12, color: '#085041', marginTop: 8 }}>{oFb}</div>}
          </div>
        </div>
      )}

      {/* РЕЕСТР */}
      {activeTab === 'history' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 650 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Дата', 'Материал', 'Поставщик', 'Кол-во', 'Сумма', '₽/ед', 'Куда', 'Статус', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => {
                const dest = p.destination === 'me' ? 'Мой склад' : sewers.find(s => s.id === p.destination)?.name || '—'
                let badge
                if (p.status === 'transit') badge = { bg: '#E6F1FB', color: '#185FA5', text: 'В пути' }
                else if (p.status === 'received') badge = { bg: '#EAF3DE', color: '#3B6D11', text: 'Получено' }
                else badge = { bg: '#f1f0f0', color: '#888', text: 'Отменён' }
                return (
                  <tr key={p.id} style={{ opacity: p.status === 'cancelled' ? 0.5 : 1 }}>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', color: '#888' }}>
                      {p.order_date ? new Date(p.order_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>{p.materials?.name}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', color: '#888' }}>{p.supplier}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>{fmt(p.quantity)} {p.materials?.unit}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>{fmt(p.total_sum)} ₽</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>{fmt(p.price_per_unit)} ₽</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', color: '#888' }}>{dest}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: badge.bg, color: badge.color }}>{badge.text}</span>
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>
                      <button onClick={() => deleteOrder(p.id)} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#888' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
              {purchases.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Нет закупок</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* СПРАВОЧНИК ЦЕН */}
      {activeTab === 'prices' && (
        <div>
          {cats.map(cat => (
            <div key={cat.name} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>{cat.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10 }}>
                {cat.mats.map(matName => {
                  const mat = materials.find(m => m.name === matName)
                  if (!mat) return null
                  const total = totalStock(matName)
                  const tr = inTransit(matName)
                  const d = daysLeft(matName)
                  let dColor = '#3B6D11'
                  if (d !== null && d <= 2) dColor = '#A32D2D'
                  else if (d !== null && d <= 7) dColor = '#854F0B'
                  return (
                    <div key={mat.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 6 }}>{mat.name}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{fmt(mat.price_per_unit)} ₽<span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>/{mat.unit}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#888' }}><span>Мой склад</span><span>{fmt(stocks.filter(s => s.location === 'warehouse' && s.materials?.name === matName).reduce((a, s) => a + s.quantity, 0))}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#888' }}><span>У швей</span><span>{fmt(stocks.filter(s => s.location !== 'warehouse' && s.location !== 'ready' && s.materials?.name === matName).reduce((a, s) => a + s.quantity, 0))}</span></div>
                      {tr > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}><span style={{ color: '#888' }}>В пути</span><span style={{ color: '#185FA5' }}>{fmt(tr)}</span></div>}
                      {d !== null && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}><span style={{ color: '#888' }}>Запас</span><span style={{ color: dColor }}>{d > 99 ? '99+' : d} дн</span></div>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#888', padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
            Цены — средние за последние 30 дней на основании реестра закупок.
          </div>
        </div>
      )}
    </div>
  )
}