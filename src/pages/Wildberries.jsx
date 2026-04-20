import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PCOL = {
  'Кокошник Красный': '#E24B4A',
  'Кокошник Белый': '#888780',
  'Кокошник Черный': '#2C2C2A',
  'Кокошник Цветной': '#1D9E75'
}
const PLBL = {
  'Кокошник Красный': 'Красный',
  'Кокошник Белый': 'Белый',
  'Кокошник Черный': 'Чёрный',
  'Кокошник Цветной': 'Цветной'
}
const PRODUCTS = Object.keys(PCOL)
const fmt = x => Math.round(x).toLocaleString('ru-RU')
const fD = x => x.toFixed(1)

// Скорость продаж в день (из апрельских данных)
const DAILY_SALES = {
  'Кокошник Красный': 515 / 14,
  'Кокошник Белый': 63 / 14,
  'Кокошник Черный': 164 / 14,
  'Кокошник Цветной': 19 / 14
}

// Склады WB с тарифами
const WAREHOUSES = [
  { id: 'ekb', name: 'Екатеринбург', fo: 'Уральский', tariff: 190, logFirst: 87.4, sdek: 934 },
  { id: 'vlad', name: 'Владимир', fo: 'Центральный', tariff: 130, logFirst: 59.8, sdek: 1354 },
  { id: 'voronezh', name: 'Воронеж', fo: 'Центральный', tariff: 130, logFirst: 59.8, sdek: 1460 },
  { id: 'kotovsk', name: 'Котовск', fo: 'Центральный', tariff: 120, logFirst: 55.2, sdek: 1565 },
  { id: 'novosem', name: 'Новосемейкино', fo: 'Приволжский', tariff: 160, logFirst: 73.6, sdek: 1249 },
]

const IL = 1.40
const IRP = 0.0207
const VOLUME = 0.8
const PRICE = 850

function calcLogistics(wh) {
  return VOLUME * 30 * (wh.tariff / 100) * IL + PRICE * IRP
}

export default function Wildberries() {
  const [wbStocks, setWbStocks] = useState([])
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('signals')

  // Форма отгрузки
  const [shDate, setShDate] = useState(new Date().toISOString().split('T')[0])
  const [shType, setShType] = useState('Кокошник Красный')
  const [shQty, setShQty] = useState('')
  const [shWh, setShWh] = useState('ekb')
  const [shTk, setShTk] = useState('СДЭК')
  const [shNakl, setShNakl] = useState('')
  const [shArrival, setShArrival] = useState('')
  const [shWbNum, setShWbNum] = useState('')
  const [shShk, setShShk] = useState('')
  const [shShkp, setShShkp] = useState('')
  const [shFb, setShFb] = useState('')

  // Обновление остатков
  const [upWh, setUpWh] = useState('ekb')
  const [upProd, setUpProd] = useState('Кокошник Красный')
  const [upQty, setUpQty] = useState('')
  const [upFb, setUpFb] = useState('')

  // Цель месяца
  const [goalProfit, setGoalProfit] = useState(400000)
  const [goalBuyout, setGoalBuyout] = useState(47)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: wb }, { data: sh }] = await Promise.all([
      supabase.from('wb_stocks').select('*'),
      supabase.from('shipments').select('*').order('ship_date', { ascending: false }),
    ])
    setWbStocks(wb || [])
    setShipments(sh || [])
    setLoading(false)
  }

  function getStock(whId, prod) {
    return wbStocks.find(s => s.warehouse === whId && s.product === prod)?.quantity || 0
  }

  function daysLeft(whId, prod) {
    const qty = getStock(whId, prod)
    const spd = DAILY_SALES[prod] || 1
    return Math.floor(qty / spd)
  }

  async function updateStock() {
    if (!upQty) return
    const qty = parseInt(upQty)
    const existing = wbStocks.find(s => s.warehouse === upWh && s.product === upProd)
    if (existing) {
      await supabase.from('wb_stocks').update({ quantity: qty, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('wb_stocks').insert({ warehouse: upWh, product: upProd, quantity: qty })
    }
    setUpFb(`✓ Обновлено: ${WAREHOUSES.find(w => w.id === upWh)?.name} / ${PLBL[upProd]} = ${qty} шт`)
    setUpQty('')
    loadAll()
  }

  async function addShipment() {
    if (!shQty || !shDate) { setShFb('Заполните дату и количество'); return }
    const wh = WAREHOUSES.find(w => w.id === shWh)
    await supabase.from('shipments').insert({
      ship_date: shDate,
      product: shType,
      quantity: parseInt(shQty),
      warehouse: wh?.name || shWh,
      tk: shTk,
      invoice_num: shNakl,
      wb_supply_num: shWbNum,
      shk_box: shShk,
      shk_supply: shShkp,
      arrival_date: shArrival || null,
      status: 'В пути'
    })
    setShFb(`✓ Отгрузка добавлена: ${PLBL[shType]} → ${wh?.name} ${shQty} шт`)
    setShQty(''); setShNakl(''); setShWbNum(''); setShShk(''); setShShkp('')
    loadAll()
  }

  async function setShipStatus(id, val) {
    await supabase.from('shipments').update({ status: val }).eq('id', id)
    loadAll()
  }

  const foGroups = {}
  WAREHOUSES.forEach(wh => {
    if (!foGroups[wh.fo]) foGroups[wh.fo] = []
    foGroups[wh.fo].push(wh)
  })

  let deficitCount = 0
  WAREHOUSES.forEach(wh => {
    PRODUCTS.forEach(prod => {
      const d = daysLeft(wh.id, prod)
      const spd = DAILY_SALES[prod] || 0
      if (spd > 0.5 && d <= 3) deficitCount++
    })
  })

  const avgProfit = 88
  const needSold = Math.ceil(goalProfit / avgProfit)
  const needOrders = Math.ceil(needSold / (goalBuyout / 100))
  const needProd = Math.ceil(needSold * 1.05)

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Загрузка...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Златка <span style={{ color: '#5DCAA5' }}>/ Wildberries</span></div>
        <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: '#FAEEDA', color: '#854F0B', border: '1px solid #FAC775' }}>API не подключён · данные ручные</div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Заказов в день (апр)', value: '54', sub: 'средний темп' },
          { label: 'Складов с дефицитом', value: deficitCount, color: deficitCount > 0 ? '#E24B4A' : '#111', sub: 'нужна отгрузка' },
          { label: 'Индекс локализации', value: '1.40', color: '#E24B4A', sub: 'наценка ~40%' },
          { label: 'Процент выкупа', value: '47%', sub: 'из статистики WB' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: m.color || '#111' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'signals', label: 'Сигналы по складам' },
          { id: 'shipments', label: 'Отгрузки' },
          { id: 'sales', label: 'Продажи' },
          { id: 'goal', label: 'Цель месяца' },
          { id: 'update', label: 'Обновить остатки' },
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
          {Object.entries(foGroups).map(([fo, whs]) => (
            <div key={fo} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{fo} ФО</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                {whs.map(wh => {
                  const logCost = calcLogistics(wh)
                  let hasCrit = false, hasWarn = false
                  PRODUCTS.forEach(prod => {
                    const d = daysLeft(wh.id, prod)
                    const spd = DAILY_SALES[prod] || 0
                    if (spd > 0.5 && d <= 3) hasCrit = true
                    else if (spd > 0.5 && d <= 7) hasWarn = true
                  })
                  const borderColor = hasCrit ? '#E24B4A' : hasWarn ? '#BA7517' : '#e5e7eb'
                  const tariffColor = wh.tariff <= 130 ? '#3B6D11' : wh.tariff <= 160 ? '#854F0B' : '#A32D2D'
                  return (
                    <div key={wh.id} style={{ background: '#fff', border: `1px solid ${borderColor}`, borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb' }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{hasCrit ? '⚠ ' : ''}{wh.name}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{wh.fo}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: tariffColor === '#3B6D11' ? '#EAF3DE' : tariffColor === '#854F0B' ? '#FAEEDA' : '#FCEBEB', color: tariffColor }}>тариф {wh.tariff}%</span>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>лог. ~{Math.round(logCost)} ₽/шт</div>
                        </div>
                      </div>
                      <div style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 4, fontSize: 10, color: '#aaa', paddingBottom: 4, borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
                          <span>Цвет</span><span style={{ textAlign: 'right' }}>Остаток</span><span style={{ textAlign: 'right' }}>шт/день</span><span style={{ textAlign: 'right' }}>Статус</span>
                        </div>
                        {PRODUCTS.map(prod => {
                          const spd = DAILY_SALES[prod] || 0
                          if (spd < 0.3) return null
                          const qty = getStock(wh.id, prod)
                          const d = daysLeft(wh.id, prod)
                          const recQty = Math.max(0, Math.ceil(spd * 14 - qty))
                          let statusEl
                          if (qty === 0 || d <= 3) {
                            statusEl = <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 5, background: '#FCEBEB', color: '#A32D2D', whiteSpace: 'nowrap' }}>🔴 {qty === 0 ? 'нет' : `${d}дн +${fmt(recQty)}`}</span>
                          } else if (d <= 7) {
                            statusEl = <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 5, background: '#FAEEDA', color: '#854F0B', whiteSpace: 'nowrap' }}>🟡 {d}дн +{fmt(recQty)}</span>
                          } else {
                            statusEl = <span style={{ fontSize: 10, color: '#3B6D11' }}>{d}дн</span>
                          }
                          return (
                            <div key={prod} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 4, padding: '4px 0', borderBottom: '1px solid #f9f9f9', fontSize: 12, alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[prod], flexShrink: 0 }}></span>
                                <span style={{ color: '#555' }}>{PLBL[prod]}</span>
                              </span>
                              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(qty)}</span>
                              <span style={{ textAlign: 'right', color: '#888', fontSize: 11 }}>{fD(spd)}</span>
                              <span style={{ textAlign: 'right' }}>{statusEl}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ОТГРУЗКИ */}
      {activeTab === 'shipments' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Добавить отгрузку на WB</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Дата сдачи</div>
                <input type="date" value={shDate} onChange={e => setShDate(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Тип (цвет)</div>
                <select value={shType} onChange={e => setShType(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Количество</div>
                <input type="number" value={shQty} onChange={e => setShQty(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Склад WB</div>
                <select value={shWh} onChange={e => setShWh(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>ТК</div>
                <input type="text" value={shTk} onChange={e => setShTk(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>№ Накладной</div>
                <input type="text" value={shNakl} onChange={e => setShNakl(e.target.value)} placeholder="10..." style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Дата прихода на WB</div>
                <input type="date" value={shArrival} onChange={e => setShArrival(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>№ Поставки WB</div>
                <input type="text" value={shWbNum} onChange={e => setShWbNum(e.target.value)} placeholder="WB_1..." style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>ШК Короба</div>
                <input type="text" value={shShk} onChange={e => setShShk(e.target.value)} placeholder="WB_14..." style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>ШК Поставки</div>
                <input type="text" value={shShkp} onChange={e => setShShkp(e.target.value)} placeholder="WB-GI-..." style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <button onClick={addShipment} style={{ background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Добавить отгрузку</button>
            {shFb && <div style={{ fontSize: 12, color: '#085041', marginTop: 8 }}>{shFb}</div>}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Дата', 'Тип', 'Кол-во', 'Направление', 'ТК', '№ Накладной', '№ Поставки WB', 'ШК Короба', 'ШК Поставки', 'Приход WB', 'Статус'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => {
                  let badge
                  if (s.status === 'Доставлено') badge = { bg: '#EAF3DE', color: '#3B6D11' }
                  else if (s.status === 'В пути') badge = { bg: '#E6F1FB', color: '#185FA5' }
                  else badge = { bg: '#FAEEDA', color: '#854F0B' }
                  return (
                    <tr key={s.id}>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888', whiteSpace: 'nowrap' }}>
                        {s.ship_date ? new Date(s.ship_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOL[s.product] || '#888' }}></span>
                          {PLBL[s.product] || s.product}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5' }}>{fmt(s.quantity)}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#555' }}>{s.warehouse}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888' }}>{s.tk}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888', fontSize: 11 }}>{s.invoice_num || '—'}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888', fontSize: 11 }}>{s.wb_supply_num || '—'}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888', fontSize: 11 }}>{s.shk_box || '—'}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888', fontSize: 11 }}>{s.shk_supply || '—'}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5', color: '#888', fontSize: 11 }}>{s.arrival_date ? new Date(s.arrival_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #f5f5f5' }}>
                        <select value={s.status} onChange={e => setShipStatus(s.id, e.target.value)} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '1px solid #e5e7eb', background: badge.bg, color: badge.color, cursor: 'pointer' }}>
                          <option value="В пути">В пути</option>
                          <option value="Доставлено">Доставлено</option>
                          <option value="Принято WB">Принято WB</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {shipments.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Нет отгрузок</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ПРОДАЖИ */}
      {activeTab === 'sales' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Март 2026 (заказы)', value: '1 893', sub: 'лучший месяц' },
              { label: 'Апрель (14 дн, заказы)', value: '761', sub: 'темп ~1 628/мес' },
              { label: 'Лидер', value: 'Красный', sub: '78% всех заказов' },
              { label: 'В день (апрель)', value: '54', sub: 'заказов среднее' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Месяц', 'Красный', 'Чёрный', 'Белый', 'Цветной', 'Итого (заказы)', 'В день'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Месяц' ? 'left' : 'right', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { m: 'Апрель 2026*', r: 515, b: 164, w: 63, c: 19, days: 14 },
                  { m: 'Март 2026', r: 1477, b: 336, w: 6, c: 74, days: 31 },
                  { m: 'Февраль 2026', r: 462, b: 20, w: 0, c: 34, days: 28 },
                  { m: 'Январь 2026', r: 255, b: 4, w: 0, c: 93, days: 31 },
                ].map(row => {
                  const tot = row.r + row.b + row.w + row.c
                  return (
                    <tr key={row.m}>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>{row.m}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', textAlign: 'right' }}>{fmt(row.r)}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', textAlign: 'right' }}>{fmt(row.b)}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', textAlign: 'right' }}>{fmt(row.w)}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', textAlign: 'right' }}>{fmt(row.c)}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', textAlign: 'right', fontWeight: 500 }}>{fmt(tot)}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', textAlign: 'right', color: '#888' }}>{(tot / row.days).toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#888', padding: '6px 10px' }}>* Все цифры — заказы (не выкупы). Выкупы ≈ заказы × 47%</div>
        </div>
      )}

      {/* ЦЕЛЬ МЕСЯЦА */}
      {activeTab === 'goal' && (
        <div style={{ maxWidth: 500 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Хочу заработать чистыми</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Желаемая прибыль, ₽</div>
                <input type="number" value={goalProfit} onChange={e => setGoalProfit(parseInt(e.target.value))} step="10000" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Процент выкупа, %</div>
                <input type="number" value={goalBuyout} onChange={e => setGoalBuyout(parseInt(e.target.value))} min="1" max="100" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
            {[
              { label: 'Нужно заказов на WB', value: fmt(needOrders) + ' шт', accent: true },
              { label: '▸ Красных (~78%)', value: fmt(Math.ceil(needOrders * 0.78)) + ' шт' },
              { label: '▸ Чёрных (~9%)', value: fmt(Math.ceil(needOrders * 0.09)) + ' шт' },
              { label: '▸ Белых (~8%)', value: fmt(Math.ceil(needOrders * 0.08)) + ' шт' },
              { label: '▸ Цветных (~5%)', value: fmt(Math.ceil(needOrders * 0.05)) + ' шт' },
              { label: `Нужно выкупов (${goalBuyout}%)`, value: fmt(needSold) + ' шт', accent: true },
              { label: 'Нужно произвести', value: fmt(needProd) + ' шт' },
              { label: 'Зарплата швеям (≈)', value: fmt(needProd * 110) + ' ₽' },
              { label: 'Себест. материалов (≈)', value: fmt(needProd * 58) + ' ₽' },
              { label: 'Средняя ЧП/шт', value: fmt(avgProfit) + ' ₽' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{r.label}</span>
                <span style={{ fontWeight: 500, color: r.accent ? '#1D9E75' : '#111' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ОБНОВИТЬ ОСТАТКИ */}
      {activeTab === 'update' && (
        <div style={{ maxWidth: 500 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Обновить остатки на складах WB</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16, padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
              Пока API не подключён — вводите остатки вручную. После подключения API WB будет обновляться автоматически.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Склад WB</div>
                <select value={upWh} onChange={e => setUpWh(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Артикул (цвет)</div>
                <select value={upProd} onChange={e => setUpProd(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Остаток (шт)</div>
                <input type="number" value={upQty} onChange={e => setUpQty(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <button onClick={updateStock} style={{ background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Обновить остаток</button>
            {upFb && <div style={{ fontSize: 12, color: '#085041', marginTop: 8 }}>{upFb}</div>}
          </div>
        </div>
      )}
    </div>
  )
}