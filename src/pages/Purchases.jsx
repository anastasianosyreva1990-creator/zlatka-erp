import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
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
    return stocks.filter(s => s.materials?.name === matName && s.location !== 'ready').reduce((a, s) => a + s.quantity, 0)
  }

  function inTransit(matName) {
    return purchases.filter(p => p.materials?.name === matName && p.status === 'transit').reduce((a, p) => a + p.quantity, 0)
  }

  function daysLeft(matName) {
    const norm = NORM[matName]
    if (!norm) return null
    return Math.floor((totalStock(matName) + inTransit(matName)) / (DAILY_PROD * norm))
  }

  async function addOrder() {
    if (!oQty || !oSum || !oDate) { setOFb('Заполните все поля'); return }
    const qty = parseFloat(oQty), sum = parseFloat(oSum)
    const arr = new Date(oDate)
    arr.setDate(arr.getDate() + parseInt(oDays))
    await supabase.from('purchases').insert({
      material_id: oMat, quantity: qty, total_sum: sum,
      price_per_unit: sum / qty, supplier: oSup || '—',
      order_date: oDate, arrival_date: arr.toISOString().split('T')[0],
      destination: oDest, status: 'transit'
    })
    setOFb(`✓ Заказ оформлен · прибытие ${arr.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`)
    setOQty(''); setOSum('')
    loadAll()
  }

  async function receiveOrder(id) {
    const p = purchases.find(x => x.id === id)
    if (!p) return
    await supabase.from('purchases').update({ status: 'received' }).eq('id', id)
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
    const total = totalStock(matName), transit = inTransit(matName)
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

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Закупки <span>/ Материалы</span></h1>
      </div>

      <div className="metrics">
        <div className="metric-card wine">
          <div className="metric-label">Срочно заказать</div>
          <div className="metric-value" style={{ color: '#6A1030' }}>{critCount}</div>
          <div className="metric-sub">позиций</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Заказать скоро</div>
          <div className="metric-value" style={{ color: '#6A4A10' }}>{warnCount}</div>
          <div className="metric-sub">позиций</div>
        </div>
        <div className="metric-card dark">
          <div className="metric-label">В пути</div>
          <div className="metric-value">{transit.length}</div>
          <div className="metric-sub">заказов</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Заморожено в мат-лах</div>
          <div className="metric-value" style={{ fontSize: 18 }}>{fmt(Math.round(frozen))} ₽</div>
          <div className="metric-sub">склад + у швей</div>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'signals', label: 'Сигналы' },
          { id: 'transit', label: 'В пути' },
          { id: 'order', label: 'Заказать' },
          { id: 'history', label: 'Реестр закупок' },
          { id: 'prices', label: 'Справочник цен' },
        ].map(t => (
          <button key={t.id} className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* СИГНАЛЫ */}
      {activeTab === 'signals' && (
        <div>
          <div className="info-box mb-12">
            Запас в днях = (мой склад + у всех швей + в пути) ÷ (производительность ~129 шт/день × норма расхода на 1 шт)
          </div>
          {['crit', 'warn', 'ok'].map(group => {
            const groupMats = materials.filter(m => {
              const d = daysLeft(m.name)
              if (d === null) return false
              if (group === 'crit') return d <= 2
              if (group === 'warn') return d > 2 && d <= 7
              return d > 7
            })
            if (groupMats.length === 0) return null
            const labels = { crit: 'Срочно заказать', warn: 'Заказать скоро', ok: 'В норме' }
            const styles = {
              crit: { bg: '#EED4DD', border: '#6A1030', nameColor: '#3A0A1A', subColor: '#6A1030', dayColor: '#6A1030' },
              warn: { bg: '#EEE4C8', border: '#6A4A10', nameColor: '#3A2A0A', subColor: '#6A4A10', dayColor: '#6A4A10' },
              ok: { bg: '#D8EED8', border: '#1A4A28', nameColor: '#0A2A0A', subColor: '#1A4A28', dayColor: '#1A4A28' },
            }
            const s = styles[group]
            return (
              <div key={group}>
                <div style={{ fontSize: 10, color: '#5A4A3A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 14, fontWeight: 700 }}>
                  {labels[group]}
                </div>
                {groupMats.map(mat => {
                  const d = daysLeft(mat.name)
                  const total = totalStock(mat.name)
                  const tr = inTransit(mat.name)
                  const norm = NORM[mat.name] || 0
                  const toOrder = Math.max(0, Math.ceil(DAILY_PROD * 14 * norm - total - tr))
                  return (
                    <div key={mat.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',maxWidth: 900,
                      padding: '10px 14px', borderRadius: 10, marginBottom: 6,
                      background: s.bg, border: `1px solid ${s.border}22`, gap: 12
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: s.nameColor }}>{mat.name}</div>
                        <div style={{ fontSize: 11, color: s.subColor, marginTop: 2, fontWeight: 500 }}>
                          Склад: {fmt(total)} {mat.unit} · В пути: {fmt(tr)} {mat.unit}
                          {toOrder > 0 ? ` · Заказать +${fmt(toOrder)} ${mat.unit}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.dayColor, lineHeight: 1 }}>{d > 99 ? '99+' : d}</div>
                        <div style={{ fontSize: 10, color: s.subColor, fontWeight: 600 }}>дней</div>
                      </div>
                      {group !== 'ok' && (
                        <button onClick={() => prefillOrder(mat.id, mat.name)}
                          className="btn btn-primary btn-sm">
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
          <div className="card">
            {transit.length === 0 ? (
              <div style={{ color: '#5A4A3A', fontSize: 13 }}>Нет материалов в пути</div>
            ) : transit.map(p => {
              const arr = new Date(p.arrival_date)
              const now = new Date(); now.setHours(0, 0, 0, 0)
              const d = Math.round((arr - now) / 86400000)
              let badgeCls = 'badge badge-blue', bl = `через ${d} дн`
              if (d <= 0) { badgeCls = 'badge badge-green'; bl = 'сегодня' }
              else if (d <= 2) { badgeCls = 'badge badge-yellow'; bl = d === 1 ? 'завтра' : `через ${d} дн` }
              const dest = p.destination === 'me' ? 'Мой склад' : sewers.find(s => s.id === p.destination)?.name || '—'
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid rgba(74,111,82,0.1)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, flex: 1, minWidth: 120, color: '#1C2E26' }}>{p.materials?.name}</span>
                  <span style={{ color: '#1C2E26', fontWeight: 600 }}>{fmt(p.quantity)} {p.materials?.unit}</span>
                  <span style={{ color: '#5A4A3A', fontSize: 12 }}>{p.supplier}</span>
                  <span style={{ color: '#5A4A3A', fontSize: 12 }}>{dest}</span>
                  <span style={{ color: '#5A4A3A', fontSize: 12 }}>{arr.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                  <span className={badgeCls}>{bl}</span>
                  <button onClick={() => receiveOrder(p.id)} className="btn btn-green btn-sm">Получено</button>
                  <button onClick={() => cancelOrder(p.id)} className="btn btn-outline btn-sm">Отменить</button>
                </div>
              )
            })}
          </div>
          <div className="info-box">
            Цепочка: «Получено» → зачислилось на мой склад → швея отметила «Получила» → списалось с моего склада
          </div>
        </div>
      )}

      {/* ЗАКАЗАТЬ */}
      {activeTab === 'order' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div className="card-title">Оформить заказ</div>
            <div className="form-grid fg2" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Материал</label>
                <select value={oMat} onChange={e => setOMat(e.target.value)}>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Количество</label>
                <input type="number" value={oQty} onChange={e => setOQty(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Сумма, ₽</label>
                <input type="number" value={oSum} onChange={e => setOSum(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Дата заказа</label>
                <input type="date" value={oDate} onChange={e => setODate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Поставщик</label>
                <input type="text" value={oSup} onChange={e => setOSup(e.target.value)} placeholder="star-tex.ru / Ozon" />
              </div>
              <div className="form-group">
                <label className="form-label">Дней доставки</label>
                <input type="number" value={oDays} onChange={e => setODays(e.target.value)} min="1" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Куда</label>
              <select value={oDest} onChange={e => setODest(e.target.value)}>
                <option value="me">На мой склад</option>
                {sewers.map(s => <option key={s.id} value={s.id}>Сразу к {s.name}</option>)}
              </select>
            </div>
            <button onClick={addOrder} className="btn btn-primary">Оформить заказ</button>
            {oFb && <div className="mt-8 text-green text-sm" style={{ fontWeight: 600 }}>{oFb}</div>}
          </div>
        </div>
      )}

      {/* РЕЕСТР */}
      {activeTab === 'history' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th><th>Материал</th><th>Поставщик</th>
                <th style={{ textAlign: 'right' }}>Кол-во</th>
                <th style={{ textAlign: 'right' }}>Сумма</th>
                <th style={{ textAlign: 'right' }}>₽/ед</th>
                <th>Куда</th><th>Статус</th><th></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => {
                const dest = p.destination === 'me' ? 'Мой склад' : sewers.find(s => s.id === p.destination)?.name || '—'
                let badgeCls = 'badge badge-blue', badgeText = 'В пути'
                if (p.status === 'received') { badgeCls = 'badge badge-green'; badgeText = 'Получено' }
                else if (p.status === 'cancelled') { badgeCls = 'badge badge-gray'; badgeText = 'Отменён' }
                return (
                  <tr key={p.id} style={{ opacity: p.status === 'cancelled' ? 0.5 : 1 }}>
                    <td className="text-muted">{p.order_date ? new Date(p.order_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.materials?.name}</td>
                    <td className="text-muted">{p.supplier}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(p.quantity)} {p.materials?.unit}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.total_sum)} ₽</td>
                    <td style={{ textAlign: 'right' }}>{fmt(p.price_per_unit)} ₽</td>
                    <td className="text-muted">{dest}</td>
                    <td><span className={badgeCls}>{badgeText}</span></td>
                    <td>
                      <button onClick={() => deleteOrder(p.id)}
                        className="btn btn-outline btn-sm" style={{ padding: '2px 8px' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
              {purchases.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#5A4A3A' }}>Нет закупок</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* СПРАВОЧНИК ЦЕН */}
      {activeTab === 'prices' && (
        <div>
          {cats.map(cat => (
            <div key={cat.name} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#5A4A3A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(196,168,130,0.25)', fontWeight: 700 }}>
                {cat.name}
              </div>
              <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
                {cat.mats.map(matName => {
                  const mat = materials.find(m => m.name === matName)
                  if (!mat) return null
                  const total = totalStock(matName)
                  const tr = inTransit(matName)
                  const d = daysLeft(matName)
                  let dColor = '#1A6B28'
                  if (d !== null && d <= 2) dColor = '#6A1030'
                  else if (d !== null && d <= 7) dColor = '#6A4A10'
                  return (
                    <div key={mat.id} style={{ background: '#fff', border: '0.5px solid rgba(74,111,82,0.15)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#1C2E26', marginBottom: 5 }}>{mat.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1C2E26', marginBottom: 5 }}>
                        {fmt(mat.price_per_unit)} ₽<span style={{ fontSize: 11, color: '#5A4A3A', fontWeight: 500 }}>/{mat.unit}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#5A4A3A', fontWeight: 500 }}>
                        <span>Склад</span><span style={{ fontWeight: 700, color: '#1C2E26' }}>{fmt(stocks.filter(s => s.location === 'warehouse' && s.materials?.name === matName).reduce((a, s) => a + s.quantity, 0))}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#5A4A3A', fontWeight: 500 }}>
                        <span>У швей</span><span style={{ fontWeight: 700, color: '#1C2E26' }}>{fmt(stocks.filter(s => s.location !== 'warehouse' && s.location !== 'ready' && s.materials?.name === matName).reduce((a, s) => a + s.quantity, 0))}</span>
                      </div>
                      {tr > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}><span style={{ color: '#5A4A3A', fontWeight: 500 }}>В пути</span><span style={{ fontWeight: 700, color: '#185FA5' }}>{fmt(tr)}</span></div>}
                      {d !== null && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}><span style={{ color: '#5A4A3A', fontWeight: 500 }}>Запас</span><span style={{ fontWeight: 700, color: dColor }}>{d > 99 ? '99+' : d} дн</span></div>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="info-box mt-8">Цены — средние за последние 30 дней на основании реестра закупок.</div>
        </div>
      )}
    </div>
  )
}