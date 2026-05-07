import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60','Кокошник Ягоды':'#7D3C98','Кокошник Петушки':'#E67E22'}
const PLBL = {'Кокошник Красный':'Красный','Кокошник Белый':'Белый','Кокошник Черный':'Чёрный','Кокошник Цветной':'Цветной','Кокошник Ягоды':'Ягоды','Кокошник Петушки':'Петушки'}
const PRODUCTS = Object.keys(PCOL)
const MIN_STOCK = 50

const MAT_COST = {
  'Кокошник Красный': 0.0476*288.16 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Белый':   0.0476*286.50 + 0.2*17.03 + 2*0.92 + 30 + 1.19 + 10.90,
  'Кокошник Черный':  0.0476*289.77 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Цветной': 0.0555*365.83 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Ягоды':   0.0555*365.83 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Петушки': 0.0650*365.83 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
}
const BOX_COST = 77.25
const IL = 1.40, IRP = 0.0207, VOL = 0.8, PRICE = 850

const WHS = [
  {id:'ekb',name:'Екатеринбург',fo:'Уральский',tariff:190,sdek:934},
  {id:'vlad',name:'Владимир',fo:'Центральный',tariff:130,sdek:1354},
  {id:'voronezh',name:'Воронеж',fo:'Центральный',tariff:130,sdek:1460},
  {id:'kotovsk',name:'Котовск',fo:'Центральный',tariff:120,sdek:1565},
  {id:'novosem',name:'Новосемейкино',fo:'Приволжский',tariff:160,sdek:1249},
  {id:'volgograd',name:'Волгоград',fo:'Южный',tariff:170,sdek:1670},
  {id:'ryazan',name:'Рязань',fo:'Центральный',tariff:130,sdek:1355},
]

function logCost(wh) { return wh.tariff || 0 }
function sdekPerUnit(wh) { return Math.round(wh.sdek / 96) }

export default function Batches() {
  const [batches, setBatches] = useState([])
  const [batchItems, setBatchItems] = useState([])
  const [sewers, setSewers] = useState([])
  const [warehouses, setWarehouses] = useState(WHS)
  const [wbStocks, setWbStocks] = useState([])
  const [wbSales, setWbSales] = useState([])
  const [readyStock, setReadyStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [newPopup, setNewPopup] = useState(false)
  const [detailPopup, setDetailPopup] = useState(null)
  const [editStockPopup, setEditStockPopup] = useState(false)
  const [recPopup, setRecPopup] = useState(false)
  const [batchSize, setBatchSize] = useState(96)
  const [customComposition, setCustomComposition] = useState({})
  const [selectedWh, setSelectedWh] = useState('')
  const [stockEdits, setStockEdits] = useState({})
  const [newFb, setNewFb] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: b }, { data: bi }, { data: sw }, { data: wb }, { data: rs }, { data: ws }, { data: whDb }] = await Promise.all([
      supabase.from('batches').select('*').order('created_at', { ascending: false }),
      supabase.from('batch_items').select('*, sewers(name, tariff)'),
      supabase.from('sewers').select('*').eq('active', true),
      supabase.from('wb_stocks').select('*'),
      supabase.from('ready_stock').select('*'),
      supabase.from('wb_sales_by_wh').select('*'),
      supabase.from('wb_warehouses').select('*').eq('active', true).order('name'),
    ])
    setBatches(b || [])
    setBatchItems(bi || [])
    setSewers(sw || [])
    setWbStocks(wb || [])
    setReadyStock(rs || [])
    setWbSales(ws || [])
    if (whDb?.length) setWarehouses(whDb.map(w => ({ id: w.id, name: w.name, fo: w.fo || '', tariff: w.wb_tariff || 0, sdek: w.sdek_tariff || 0 })))
    setLoading(false)
  }

  function getReadyQty(prod) {
    return readyStock.find(r => r.product === prod)?.quantity || 0
  }

  function getWbStock(whId, prod) {
    return wbStocks.find(s => s.warehouse === whId && s.product === prod)?.quantity || 0
  }

  function getDailyRate(whId, prod) {
    return wbSales.find(s => s.warehouse === whId && s.product === prod)?.daily_rate || 0
  }

  function batchByColor(batchId) {
    const byColor = {}
    batchItems.filter(i => i.batch_id === batchId).forEach(i => {
      byColor[i.product] = (byColor[i.product] || 0) + i.quantity
    })
    return byColor
  }

  function calcBatchCost(batchId) {
    const items = batchItems.filter(i => i.batch_id === batchId)
    let matCost = 0, laborCost = 0, totalQty = 0
    items.forEach(i => {
      matCost += (MAT_COST[i.product] || 60) * i.quantity
      laborCost += (i.sewers?.tariff || 120) * i.quantity
      totalQty += i.quantity
    })
    const boxCount = Math.ceil(totalQty / 96)
    const boxCost = BOX_COST * boxCount
    return {
      matCost: Math.round(matCost),
      laborCost: Math.round(laborCost),
      boxCost: Math.round(boxCost),
      total: Math.round(matCost + laborCost + boxCost),
      perUnit: totalQty > 0 ? Math.round((matCost + laborCost + boxCost) / totalQty) : 0,
      totalQty
    }
  }

  function calcGlobalRecommendation() {
    const available = {}
    PRODUCTS.forEach(p => available[p] = getReadyQty(p))

    // Считаем дефицит по всем складам и цветам
    const allDeficits = []
    warehouses.forEach(wh => {
      PRODUCTS.forEach(prod => {
        const qty = getWbStock(wh.id, prod)
        const dailyRate = getDailyRate(wh.id, prod)
        const needByRate = dailyRate > 0.1 ? Math.ceil(dailyRate * 14) : 0
        const needFor14Days = Math.max(needByRate, MIN_STOCK)
        const deficit = Math.max(0, needFor14Days - qty)
        if (deficit > 0) {
          // Срочность: 0 на складе = очень срочно
          const urgency = qty === 0 ? 9999 : deficit
          allDeficits.push({ wh, prod, deficit, urgency })
        }
      })
    })

    // Сортируем по срочности — самые критичные сначала
    allDeficits.sort((a, b) => b.urgency - a.urgency)

    // Распределяем доступный товар
    const whShip = {}
    const toProduce = {}

    allDeficits.forEach(({ wh, prod, deficit }) => {
      const avail = available[prod] || 0
      if (avail > 0) {
        const toGive = Math.min(deficit, avail)
        if (!whShip[wh.id]) whShip[wh.id] = { warehouse: wh, composition: {}, total: 0 }
        whShip[wh.id].composition[prod] = (whShip[wh.id].composition[prod] || 0) + toGive
        whShip[wh.id].total += toGive
        available[prod] -= toGive
        if (toGive < deficit) {
          toProduce[prod] = (toProduce[prod] || 0) + (deficit - toGive)
        }
      } else {
        toProduce[prod] = (toProduce[prod] || 0) + deficit
      }
    })

    const toShipList = Object.values(whShip).filter(w => w.total >= 5)
    const toProduceList = Object.entries(toProduce).map(([prod, qty]) => ({ prod, qty }))

    const remaining = {}
    PRODUCTS.forEach(p => { if (available[p] > 0) remaining[p] = available[p] })

    return { toShip: toShipList, toProduce: toProduceList, remaining }
  }

  async function setStatus(id, val) {
    if (val === 'Отгружено') {
      if (!window.confirm('Отметить как отгруженную? Изделия спишутся со склада готовых.')) return
      const items = batchItems.filter(i => i.batch_id === id)
      for (const item of items) {
        const rs = readyStock.find(r => r.product === item.product)
        if (rs) {
          await supabase.from('ready_stock').update({
            quantity: Math.max(0, rs.quantity - item.quantity),
            updated_at: new Date().toISOString()
          }).eq('id', rs.id)
        }
      }
    }
    await supabase.from('batches').update({ status: val }).eq('id', id)
    loadAll()
  }

  async function saveStockEdits() {
    for (const [prod, qty] of Object.entries(stockEdits)) {
      const rs = readyStock.find(r => r.product === prod)
      if (rs) {
        await supabase.from('ready_stock').update({
          quantity: parseInt(qty) || 0,
          updated_at: new Date().toISOString()
        }).eq('id', rs.id)
      }
    }
    setEditStockPopup(false)
    setStockEdits({})
    loadAll()
  }

  async function createBatch() {
    const total = Object.values(customComposition).reduce((a, b) => a + (parseInt(b) || 0), 0)
    if (total === 0) { setNewFb('Добавьте изделия'); return }
    const { data: batch } = await supabase.from('batches').insert({
      batch_num: batches.length + 1,
      status: 'Собирается',
      size: batchSize,
      filled: total,
      target_warehouse: selectedWh || null,
    }).select().single()
    if (batch) {
      for (const [prod, qty] of Object.entries(customComposition)) {
        if (!qty || parseInt(qty) <= 0) continue
        await supabase.from('batch_items').insert({
          batch_id: batch.id,
          sewer_id: null,
          product: prod,
          quantity: parseInt(qty),
        })
      }
    }
    setNewFb('✓ Партия создана')
    setTimeout(() => { setNewPopup(false); setNewFb(''); setCustomComposition({}); setSelectedWh(''); loadAll() }, 1500)
  }

  async function deleteBatch(id) {
    if (!window.confirm('Удалить партию?')) return
    await supabase.from('batch_items').delete().eq('batch_id', id)
    await supabase.from('batches').delete().eq('id', id)
    loadAll()
  }

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  const filtered = batches.filter(b => {
    if (filter === 'active') return b.status !== 'Отгружено'
    if (filter === 'shipped') return b.status === 'Отгружено'
    return true
  })

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setFilter(id)} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${filter === id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
      background: filter === id ? '#1C2E26' : 'transparent',
      color: filter === id ? '#C4A882' : '#4A3A2A'
    }}>{label}</button>
  )

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2E26', marginBottom: 20 }}>
        Партии / <span style={{ color: '#C4A882' }}>Склад готовых</span>
      </h1>

      {/* Склад готовых */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Склад готовых изделий
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { const ed = {}; readyStock.forEach(r => ed[r.product] = r.quantity); setStockEdits(ed); setEditStockPopup(true) }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(74,111,82,0.2)', background: 'transparent', color: '#4A3A2A', cursor: 'pointer', fontWeight: 700 }}>
              ✎ Редактировать
            </button>
            <button onClick={() => setRecPopup(true)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #C4A882', background: 'rgba(196,168,130,0.15)', color: '#6A4A10', cursor: 'pointer', fontWeight: 700 }}>
              💡 Рекомендация
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {PRODUCTS.map(prod => {
            const qty = getReadyQty(prod)
            return (
              <div key={prod} style={{ background: '#F5F0E8', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[prod] }}></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1C2E26' }}>{PLBL[prod]}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: qty > 0 ? '#1C2E26' : '#9A8878' }}>{fmt(qty)} шт</div>
              </div>
            )
          })}
          <div style={{ background: '#1C2E26', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(196,168,130,0.7)', marginBottom: 4 }}>Итого</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#C4A882' }}>{fmt(PRODUCTS.reduce((a, p) => a + getReadyQty(p), 0))} шт</div>
          </div>
        </div>
      </div>

      {/* Управление */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <TabBtn id="active" label="Активные"/>
          <TabBtn id="shipped" label="Отгруженные"/>
          <TabBtn id="all" label="Все"/>
        </div>
        <button onClick={() => { setNewPopup(true); setNewFb(''); setCustomComposition({}); setSelectedWh('') }}
          style={{ padding: '7px 16px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + Новая партия
        </button>
      </div>

      {/* Таблица партий */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: '#F5F0E8' }}>
              {[
                {label:'#',align:'left'},
                {label:'Дата',align:'left'},
                {label:'Размер',align:'right'},
                {label:'Состав',align:'left'},
                {label:'Склад WB',align:'left'},
                {label:'Себес/шт',align:'right'},
                {label:'Статус',align:'left'},
                {label:'',align:'left'},
              ].map(h => (
                <th key={h.label} style={{ padding: '10px 12px', textAlign: h.align, color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)', whiteSpace: 'nowrap' }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(batch => {
              const byColor = batchByColor(batch.id)
              const cost = calcBatchCost(batch.id)
              const wh = warehouses.find(w => w.id === batch.target_warehouse)
              return (
                <tr key={batch.id}>
                  <td style={{ padding: '9px 12px', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>#{batch.batch_num}</td>
                  <td style={{ padding: '9px 12px', color: '#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                    {new Date(batch.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%', textAlign: 'right' }}>{batch.size} шт</td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {Object.entries(byColor).filter(([,q]) => q > 0).map(([prod, q]) => (
                        <span key={prod} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '1px 6px', background: '#F5F0E8', borderRadius: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: PCOL[prod] }}></span>
                          {PLBL[prod]} {q}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 700, borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>{wh?.name || '—'}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 800, color: '#1A6B28', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%', textAlign: 'right' }}>{fmt(cost.perUnit)} ₽</td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                    <select value={batch.status} onChange={e => setStatus(batch.id, e.target.value)}
                      style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(74,111,82,0.25)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                      <option value="Собирается">Собирается</option>
                      <option value="Готово к отгрузке">Готово к отгрузке</option>
                      <option value="Отгружено">Отгружено</option>
                    </select>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap', width: '1%' }}>
                    <button onClick={() => setDetailPopup(batch)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(196,168,130,0.4)', background: 'rgba(196,168,130,0.1)', color: '#4A3A2A', cursor: 'pointer', fontWeight: 700, marginRight: 4 }}>
                      Детали
                    </button>
                    <button onClick={() => deleteBatch(batch.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #EED4DD', background: '#EED4DD', color: '#6A1030', cursor: 'pointer', fontWeight: 700 }}>
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#7A6A5A' }}>Нет партий</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ПОПАП — РЕДАКТИРОВАТЬ СКЛАД */}
      {editStockPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditStockPopup(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>Редактировать склад готовых</span>
              <button onClick={() => setEditStockPopup(false)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#6A4A10', background: '#EEE4C8', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
              Введите актуальные остатки готовых изделий на вашем складе
            </div>
            {PRODUCTS.map(prod => (
              <div key={prod} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: PCOL[prod] }}></span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{PLBL[prod]}</span>
                <input type="number" value={stockEdits[prod] ?? ''} onChange={e => setStockEdits({ ...stockEdits, [prod]: e.target.value })}
                  style={{ width: 80, padding: '5px 8px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
                <span style={{ fontSize: 11, color: '#7A6A5A' }}>шт</span>
              </div>
            ))}
            <button onClick={saveStockEdits} style={{ width: '100%', marginTop: 12, padding: '10px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* ПОПАП — РЕКОМЕНДАЦИЯ */}
      {recPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setRecPopup(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 580, maxHeight: '85vh', overflowX: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>💡 Рекомендация</span>
              <button onClick={() => setRecPopup(false)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#6A4A10', background: '#EEE4C8', padding: '10px 12px', borderRadius: 8, marginBottom: 16 }}>
              ⓘ Минимум {MIN_STOCK} шт на каждом складе для поддержания локализации. Приоритет — склады где 0 остаток.
            </div>
            {(() => {
              const rec = calcGlobalRecommendation()
              return (
                <>
                  {rec.toShip.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A4A28', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        📦 Отгрузить сейчас
                      </div>
                      {rec.toShip.map((item, i) => (
                        <div key={i} style={{ background: '#D8EED8', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#1C2E26' }}>{item.warehouse.name}</div>
                              <div style={{ fontSize: 10, color: '#5A4A3A', marginTop: 2 }}>
                                WB {logCost(item.warehouse)} + СДЭК {sdekPerUnit(item.warehouse)} = <strong>{logCost(item.warehouse) + sdekPerUnit(item.warehouse)} ₽/шт логистика</strong>
                              </div>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#1A6B28' }}>{item.total} шт</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {Object.entries(item.composition).map(([prod, q]) => (
                              <span key={prod} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 8px', background: '#fff', borderRadius: 6 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOL[prod] }}></span>
                                {PLBL[prod]} {q} шт
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {rec.toProduce.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#185FA5', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        🧵 Произвести дополнительно
                      </div>
                      <div style={{ background: '#E6F1FB', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, color: '#5A4A3A', marginBottom: 10 }}>
                          Не хватает для покрытия всех складов на 14 дней (мин. {MIN_STOCK} шт/склад):
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {rec.toProduce.map(({ prod, qty }) => (
                            <div key={prod} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, padding: '6px 12px', background: '#fff', borderRadius: 8, border: '1px solid #185FA5' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[prod] }}></span>
                              {PLBL[prod]}: {fmt(qty)} шт
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {Object.keys(rec.remaining).length > 0 && (
                    <div style={{ background: '#F5F0E8', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: '#7A6A5A', fontWeight: 700, marginBottom: 6 }}>
                        💤 Пока не отгружать — все склады обеспечены:
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.entries(rec.remaining).map(([prod, q]) => (
                          <span key={prod} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 8px', background: '#fff', borderRadius: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOL[prod] }}></span>
                            {PLBL[prod]} {q} шт
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {rec.toShip.length === 0 && rec.toProduce.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: '#7A6A5A', fontSize: 13 }}>
                      Все склады WB обеспечены 🎉
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ПОПАП — НОВАЯ ПАРТИЯ */}
      {newPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setNewPopup(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px', maxHeight: '85vh', overflowX: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>Новая партия</span>
              <button onClick={() => setNewPopup(false)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 6 }}>Размер партии</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[96, 108].map(s => (
                  <button key={s} onClick={() => setBatchSize(s)} style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${batchSize === s ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
                    background: batchSize === s ? '#1C2E26' : 'transparent',
                    color: batchSize === s ? '#C4A882' : '#4A3A2A'
                  }}>{s} шт</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 6 }}>Состав партии</div>
              {PRODUCTS.map(prod => {
                const avail = getReadyQty(prod)
                return (
                  <div key={prod} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: PCOL[prod] }}></span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{PLBL[prod]}</span>
                    <span style={{ fontSize: 11, color: '#7A6A5A' }}>есть {avail} шт</span>
                    <input type="number" value={customComposition[prod] || ''} onChange={e => setCustomComposition({ ...customComposition, [prod]: parseInt(e.target.value) || 0 })}
                      placeholder="0" min="0" max={avail}
                      style={{ width: 70, padding: '5px 8px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
                  </div>
                )
              })}
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#F5F0E8', borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>Итого в партии</span>
                <strong>{Object.values(customComposition).reduce((a, b) => a + (b || 0), 0)} / {batchSize} шт</strong>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 6 }}>Склад WB</div>
              <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}>
                <option value="">— Не выбран —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.fo})</option>)}
              </select>
            </div>
            <button onClick={createBatch}
              style={{ width: '100%', padding: '10px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Создать партию
            </button>
            {newFb && <div style={{ marginTop: 10, fontSize: 12, color: newFb.startsWith('✓') ? '#1A6B28' : '#6A1030', fontWeight: 700 }}>{newFb}</div>}
          </div>
        </div>
      )}

      {/* ПОПАП — ДЕТАЛИ */}
      {detailPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetailPopup(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 500, maxHeight: '80vh', overflowX: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>Партия #{detailPopup.batch_num} — детали</span>
              <button onClick={() => setDetailPopup(null)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, marginBottom: 14, whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  {['Изделие','Кол-во'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Кол-во' ? 'right' : 'left', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchItems.filter(i => i.batch_id === detailPopup.id).map(item => (
                  <tr key={item.id}>
                    <td style={{ padding: '8px 12px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOL[item.product] || '#888' }}></span>
                        {PLBL[item.product] || item.product}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(item.quantity)} шт</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(() => {
              const cost = calcBatchCost(detailPopup.id)
              return (
                <div style={{ background: '#F5F0E8', borderRadius: 8, padding: '12px 14px' }}>
                  {[
                    { l: 'Материалы', v: fmt(cost.matCost) + ' ₽' },
                    { l: 'Зарплата', v: fmt(cost.laborCost) + ' ₽' },
                    { l: `Коробá (${Math.ceil(cost.totalQty / 96)} × ${fmt(BOX_COST)} ₽)`, v: fmt(cost.boxCost) + ' ₽' },
                    { l: 'Итого', v: fmt(cost.total) + ' ₽', bold: true },
                    { l: 'Себестоимость/шт', v: fmt(cost.perUnit) + ' ₽', bold: true, green: true },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 4 ? '0.5px solid rgba(196,168,130,0.2)' : 'none', fontSize: r.bold ? 13 : 12 }}>
                      <span style={{ color: '#5A4A3A', fontWeight: r.bold ? 800 : 600 }}>{r.l}</span>
                      <span style={{ fontWeight: 800, color: r.green ? '#1A6B28' : '#1C2E26' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}