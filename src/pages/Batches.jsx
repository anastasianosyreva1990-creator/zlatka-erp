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
const fmt = x => Math.round(x).toLocaleString('ru-RU')

export default function Batches() {
  const [batches, setBatches] = useState([])
  const [batchItems, setBatchItems] = useState([])
  const [sewers, setSewers] = useState([])
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('batches')
  const [filter, setFilter] = useState('all')
  const [popup, setPopup] = useState(null)
  const [nbSize, setNbSize] = useState(108)
  const [nbFeedback, setNbFeedback] = useState('')
  const [apProd, setApProd] = useState('Кокошник Красный')
  const [apQty, setApQty] = useState('')
  const [apWho, setApWho] = useState('')
  const [apFeedback, setApFeedback] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: b }, { data: bi }, { data: sw }, { data: st }] = await Promise.all([
      supabase.from('batches').select('*').order('batch_num'),
      supabase.from('batch_items').select('*, sewers(name)'),
      supabase.from('sewers').select('*').eq('active', true),
      supabase.from('material_stock').select('*, materials(name)').eq('location', 'ready'),
    ])
    setBatches(b || [])
    setBatchItems(bi || [])
    setSewers(sw || [])
    setStock(st || [])
    if (sw?.length > 0) setApWho(sw[0].id)
    setLoading(false)
  }

  function getBatchItems(batchId) {
    return batchItems.filter(i => i.batch_id === batchId)
  }

  function getStockByColor() {
    const out = {}
    stock.forEach(s => {
      const name = s.materials?.name
      if (name) out[name] = (out[name] || 0) + s.quantity
    })
    return out
  }

  async function createBatch() {
    const byColor = getStockByColor()
    const total = Object.values(byColor).reduce((a, b) => a + b, 0)
    if (total === 0) { setNbFeedback('Склад готовых пуст — сначала примите изделия'); return }

    const toTake = Math.min(nbSize, total)
    const details = []
    let filled = 0
    const products = ['Кокошник Красный', 'Кокошник Белый', 'Кокошник Черный', 'Кокошник Цветной']

    for (const prod of products) {
      if (filled >= toTake) break
      const have = byColor[prod] || 0
      if (have === 0) continue
      const take = Math.min(toTake - filled, have)
      details.push({ product: prod, quantity: take })
      filled += take
    }

    const matCost = filled * 58
    const laborCost = filled * 110
    const batchNum = batches.length + 1

    const { data: newBatch } = await supabase.from('batches').insert({
      batch_num: batchNum,
      size: nbSize,
      filled,
      status: '',
      mat_cost: matCost,
      labor_cost: laborCost
    }).select().single()

    if (newBatch) {
      for (const d of details) {
        await supabase.from('batch_items').insert({
          batch_id: newBatch.id,
          product: d.product,
          quantity: d.quantity
        })
        // Списываем со склада готовых
        const stockItem = stock.find(s => s.materials?.name === d.product && s.location === 'ready')
        if (stockItem) {
          await supabase.from('material_stock').update({
            quantity: Math.max(0, stockItem.quantity - d.quantity)
          }).eq('id', stockItem.id)
        }
      }
    }

    setNbFeedback(`✓ Партия №${batchNum} создана: ${filled} шт`)
    loadAll()
  }

  async function addToStock() {
    if (!apQty) return
    const qty = parseInt(apQty)
    const existing = stock.find(s => s.materials?.name === apProd && s.location === 'ready')

    if (existing) {
      await supabase.from('material_stock').update({
        quantity: existing.quantity + qty
      }).eq('id', existing.id)
    } else {
      const { data: mat } = await supabase.from('materials').select('id').eq('name', apProd).single()
      if (mat) {
        await supabase.from('material_stock').insert({
          material_id: mat.id,
          location: 'ready',
          quantity: qty
        })
      }
    }

    // Записываем в productions
    const sewer = sewers.find(s => s.id === apWho)
    if (sewer) {
      await supabase.from('productions').insert({
        sewer_id: apWho,
        product: apProd,
        quantity: qty,
        date: new Date().toISOString().split('T')[0],
        earned: qty * sewer.tariff
      })
    }

    setApFeedback(`✓ Добавлено на склад готовых: ${PLBL[apProd]} ${qty} шт`)
    setApQty('')
    loadAll()
  }

  async function setStatus(batchId, val) {
    await supabase.from('batches').update({ status: val }).eq('id', batchId)
    loadAll()
  }

  function showDetail(batch) {
    const items = getBatchItems(batch.id)
    setPopup({ batch, items })
  }

  const filtered = batches.filter(b => {
    if (filter === 'active') return b.status !== 'Отгружено'
    if (filter === 'shipped') return b.status === 'Отгружено'
    return true
  })

  const byColor = getStockByColor()
  const totalStock = Object.values(byColor).reduce((a, b) => a + b, 0)

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Загрузка...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Златка <span style={{ color: '#5DCAA5' }}>/ Партии к отгрузке</span></div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Всего партий', value: batches.length },
          { label: 'К отгрузке', value: batches.filter(b => b.filled >= b.size && b.status !== 'Отгружено').length },
          { label: 'Отгружено', value: batches.filter(b => b.status === 'Отгружено').length },
          { label: 'На складе готовых', value: fmt(totalStock) + ' шт' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'batches', label: 'Партии' },
          { id: 'stock', label: 'Склад готовых' },
          { id: 'new', label: 'Новая партия' },
          { id: 'add', label: 'Принять изделия' },
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

      {/* ПАРТИИ */}
      {activeTab === 'batches' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['all','Все'],['active','Активные'],['shipped','Отгружённые']].map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 10,
                border: filter === k ? '1px solid #5DCAA5' : '1px solid #e5e7eb',
                background: filter === k ? '#f0fdf8' : 'transparent',
                color: filter === k ? '#085041' : '#666', cursor: 'pointer'
              }}>{l}</button>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['№ · Состав', 'Размер', 'Собрано', 'Мат-лы', 'Работа', '₽/шт', 'Сигнал', 'Статус', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].reverse().map(b => {
                  const items = getBatchItems(b.id)
                  const isShipped = b.status === 'Отгружено'
                  const unit = b.filled > 0 ? Math.round((b.mat_cost + b.labor_cost) / b.filled) : 0
                  return (
                    <tr key={b.id} style={{ opacity: isShipped ? 0.6 : 1, background: isShipped ? '#f8fdf9' : '#fff' }}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>
                        <div style={{ fontWeight: 500, fontSize: 12 }}>Партия №{b.batch_num}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                          {items.map((it, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#666' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOL[it.product] || '#888' }}></span>
                              {PLBL[it.product]} {fmt(it.quantity)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>{fmt(b.size)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', color: b.filled >= b.size ? '#1D9E75' : '#854F0B' }}>{fmt(b.filled)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>{fmt(b.mat_cost)} ₽</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' }}>{fmt(b.labor_cost)} ₽</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmt(unit)} ₽</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: b.filled >= b.size ? '#EAF3DE' : '#FAEEDA', color: b.filled >= b.size ? '#3B6D11' : '#854F0B', whiteSpace: 'nowrap' }}>
                          {b.filled >= b.size ? 'Отгрузите' : 'Собирается'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>
                        <select value={b.status} onChange={e => setStatus(b.id, e.target.value)} style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', minWidth: 130 }}>
                          <option value="">—</option>
                          <option value="Собирается">Собирается</option>
                          <option value="Готово к отгрузке">Готово к отгрузке</option>
                          <option value="Отгружено">Отгружено</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f5f5f5' }}>
                        <button onClick={() => showDetail(b)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#666' }}>Детали</button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Нет партий</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* СКЛАД ГОТОВЫХ */}
      {activeTab === 'stock' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
            {['Кокошник Красный','Кокошник Белый','Кокошник Черный','Кокошник Цветной'].map(prod => (
              <div key={prod} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: PCOL[prod] }}></span>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{PLBL[prod]}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 600, color: byColor[prod] > 0 ? '#111' : '#aaa' }}>{fmt(byColor[prod] || 0)}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>кокошников</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#888', background: '#f9fafb', borderRadius: 10, padding: '10px 14px' }}>
            Здесь отображаются изделия принятые от швей которые ещё не попали в партию.
          </div>
        </div>
      )}

      {/* НОВАЯ ПАРТИЯ */}
      {activeTab === 'new' && (
        <div style={{ maxWidth: 500 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Сформировать новую партию</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16, padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
              Система возьмёт изделия со склада готовых по FIFO — в порядке поступления по цвету из общей кучи.
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Размер партии (штук)</div>
              <input type="number" value={nbSize} onChange={e => setNbSize(parseInt(e.target.value))} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
            </div>
            <button onClick={createBatch} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              Сформировать по FIFO
            </button>
            {nbFeedback && <div style={{ fontSize: 12, color: '#085041', marginTop: 8 }}>{nbFeedback}</div>}
          </div>
        </div>
      )}

      {/* ПРИНЯТЬ ИЗДЕЛИЯ */}
      {activeTab === 'add' && (
        <div style={{ maxWidth: 500 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Принять изделия на склад готовых</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16, padding: '8px 10px', background: '#f9fafb', borderRadius: 8 }}>
              Забрала у швеи — добавь сюда. Изделия появятся на складе готовых и будут доступны для формирования партий.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Изделие</div>
                <select value={apProd} onChange={e => setApProd(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {Object.keys(PCOL).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Количество</div>
                <input type="number" value={apQty} onChange={e => setApQty(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Швея</div>
              <select value={apWho} onChange={e => setApWho(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                {sewers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={addToStock} style={{ background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              Добавить на склад
            </button>
            {apFeedback && <div style={{ fontSize: 12, color: '#085041', marginTop: 8 }}>{apFeedback}</div>}
          </div>
        </div>
      )}

      {/* ПОПАП ДЕТАЛЕЙ */}
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', width: 420, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Партия №{popup.batch.batch_num}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{popup.batch.filled} шт из {popup.batch.size}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, fontSize: 11, color: '#888', paddingBottom: 6, borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
              <span>Изделие</span><span style={{ textAlign: 'right' }}>Шт</span><span style={{ textAlign: 'right' }}>Работа</span>
            </div>
            {popup.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, padding: '5px 0', borderBottom: '1px solid #f9f9f9', fontSize: 13, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[it.product] }}></span>
                  {PLBL[it.product]}
                </span>
                <span style={{ textAlign: 'right' }}>{fmt(it.quantity)}</span>
                <span style={{ textAlign: 'right', color: '#085041' }}>{fmt(it.quantity * 110)} ₽</span>
              </div>
            ))}
            <div style={{ marginTop: 14, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>Материалы</span><span>{fmt(popup.batch.mat_cost)} ₽</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>Работа</span><span>{fmt(popup.batch.labor_cost)} ₽</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                <span>Итого себестоимость</span><span>{fmt(popup.batch.mat_cost + popup.batch.labor_cost)} ₽</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                <span>Стоимость единицы</span>
                <span>{fmt(popup.batch.filled > 0 ? (popup.batch.mat_cost + popup.batch.labor_cost) / popup.batch.filled : 0)} ₽/шт</span>
              </div>
            </div>
            <button onClick={() => setPopup(null)} style={{ marginTop: 16, width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#666' }}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  )
}