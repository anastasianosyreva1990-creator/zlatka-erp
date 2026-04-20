import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PCOL = {
  'Кокошник Красный': '#E24B4A',
  'Кокошник Белый': '#888780',
  'Кокошник Черный': '#2C2C2A',
  'Кокошник Цветной': '#1D9E75'
}

const NORM = {
  'Кожа Белая': { products: ['Кокошник Белый'], norm: 0.0476 },
  'Кожа Красная': { products: ['Кокошник Красный'], norm: 0.0476 },
  'Кожа Черная': { products: ['Кокошник Черный'], norm: 0.0476 },
  'Габардин Цветной': { products: ['Кокошник Цветной'], norm: 0.0555 },
  'Резинка Белая': { products: ['Кокошник Белый'], norm: 0.2 },
  'Резинка Черная': { products: ['Кокошник Красный', 'Кокошник Черный', 'Кокошник Цветной'], norm: 0.2 },
  'Регулятор Белый': { products: ['Кокошник Белый'], norm: 2 },
  'Регулятор Черный': { products: ['Кокошник Красный', 'Кокошник Черный', 'Кокошник Цветной'], norm: 2 },
  'Основа пластиковая': { products: ['Кокошник Красный', 'Кокошник Белый', 'Кокошник Черный', 'Кокошник Цветной'], norm: 1 },
}

const fmt = x => Math.round(x).toLocaleString('ru-RU')

export default function Production() {
  const [sewers, setSewers] = useState([])
  const [stocks, setStocks] = useState([])
  const [productions, setProductions] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('main')
  const [editMode, setEditMode] = useState({})
  const [popup, setPopup] = useState(null)

  // Форма операций
  const [opSewer, setOpSewer] = useState('')
  const [opProduct, setOpProduct] = useState('Кокошник Красный')
  const [opQty, setOpQty] = useState('')
  const [opFeedback, setOpFeedback] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: sw }, { data: st }, { data: pr }, { data: mt }] = await Promise.all([
      supabase.from('sewers').select('*').eq('active', true).order('name'),
      supabase.from('material_stock').select('*, materials(name, unit)'),
      supabase.from('productions').select('*, sewers(name)').order('created_at', { ascending: false }),
      supabase.from('materials').select('*'),
    ])
    setSewers(sw || [])
    setStocks(st || [])
    setProductions(pr || [])
    setMaterials(mt || [])
    if (sw?.length > 0) setOpSewer(sw[0].id)
    setLoading(false)
  }

  function getSewerStock(sewerId) {
    return stocks.filter(s => s.location === sewerId)
  }

  function getSewerProductions(sewerId) {
    const month = new Date().toISOString().slice(0, 7)
    return productions.filter(p => p.sewer_id === sewerId &&
      p.created_at?.slice(0, 7) === month)
  }

  function calcDays(qty, norm, weeklyCapacity) {
    if (!norm || !weeklyCapacity) return null
    return Math.floor(qty / (norm * weeklyCapacity / 7))
  }

  function getStockVal(sewerId, matName) {
    const s = stocks.find(s => s.location === sewerId && s.materials?.name === matName)
    return s?.quantity || 0
  }

  async function acceptProduction() {
    if (!opQty || !opSewer) return
    const qty = parseInt(opQty)
    const sewer = sewers.find(s => s.id === opSewer)
    if (!sewer) return
    const earned = qty * sewer.tariff

    await supabase.from('productions').insert({
      sewer_id: opSewer,
      product: opProduct,
      quantity: qty,
      date: new Date().toISOString().split('T')[0],
      earned
    })

    // Списываем материалы
    for (const [matName, info] of Object.entries(NORM)) {
      if (!info.products.includes(opProduct)) continue
      const used = info.norm * qty
      const stock = stocks.find(s => s.location === opSewer && s.materials?.name === matName)
      if (stock) {
        await supabase.from('material_stock').update({
          quantity: Math.max(0, stock.quantity - used)
        }).eq('id', stock.id)
      }
    }

    setOpFeedback(`✓ Принято ${qty} шт · начислено ${fmt(earned)} ₽`)
    setOpQty('')
    loadAll()
  }

  function showDelivery(sewer) {
    const items = []
    for (const [matName, info] of Object.entries(NORM)) {
      const have = getStockVal(sewer.id, matName)
      const need = Math.max(0, Math.ceil(sewer.weekly_capacity * info.norm - have))
      if (need > 0) items.push({ matName, need, have })
    }
    setPopup({ type: 'delivery', sewer, items })
  }

  function showHistory(sewer) {
    const rows = getSewerProductions(sewer.id)
    setPopup({ type: 'history', sewer, rows })
  }

  const tabs = [
    { id: 'main', label: 'Главная' },
    { id: 'summary', label: 'Сводный склад' },
    { id: 'ops', label: 'Операции' },
    { id: 'log', label: 'История' },
  ]

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Загрузка...</div>

  const totalMade = productions.filter(p => {
    const month = new Date().toISOString().slice(0, 7)
    return p.created_at?.slice(0, 7) === month
  }).reduce((a, p) => a + p.quantity, 0)

  const totalPay = sewers.reduce((a, s) => {
    const made = getSewerProductions(s.id).reduce((x, p) => x + p.quantity, 0)
    return a + made * s.tariff
  }, 0)

  const leader = sewers.reduce((best, s) => {
    const made = getSewerProductions(s.id).reduce((x, p) => x + p.quantity, 0)
    return made > (best?.made || 0) ? { ...s, made } : best
  }, null)

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>
          Златка <span style={{ color: '#5DCAA5' }}>/ Производство</span>
        </div>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '6px 16px', borderRadius: 20,
            border: activeTab === t.id ? '1px solid #5DCAA5' : '1px solid #e5e7eb',
            background: activeTab === t.id ? '#f0fdf8' : 'transparent',
            color: activeTab === t.id ? '#085041' : '#666',
            cursor: 'pointer', fontSize: 13
          }}>{t.label}</button>
        ))}
      </div>

      {/* ГЛАВНАЯ */}
      {activeTab === 'main' && (
        <div>
          {/* Метрики */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Произведено в месяце', value: fmt(totalMade), sub: 'кокошников' },
              { label: 'Выплатить швеям', value: fmt(totalPay) + ' ₽', sub: 'за месяц' },
              { label: 'Лидер месяца', value: leader?.name || '—', sub: leader ? fmt(leader.made) + ' шт' : '' },
              { label: 'Швей активных', value: sewers.length, sub: 'человек' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#111' }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Карточки швей */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {sewers.map(sw => {
              const swProds = getSewerProductions(sw.id)
              const made = swProds.reduce((a, p) => a + p.quantity, 0)
              const earned = made * sw.tariff
              const swStocks = getSewerStock(sw.id)

              return (
                <div key={sw.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                  {/* Шапка */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#B5D4F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {sw.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: '#111' }}>{sw.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{sw.tariff} ₽/шт · {sw.weekly_capacity} шт/нед</div>
                    </div>
                    <button onClick={() => showDelivery(sw)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, border: '1px solid #5DCAA5', background: 'transparent', color: '#085041', cursor: 'pointer' }}>↗ Везти</button>
                    <button onClick={() => showHistory(sw)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#666', cursor: 'pointer' }}>◷ История</button>
                  </div>

                  {/* Материалы */}
                  {swStocks.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#aaa', padding: '8px 0' }}>Нет данных по материалам</div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 4, fontSize: 10, color: '#aaa', padding: '2px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
                        <span>Материал</span><span style={{ textAlign: 'right' }}>Кол-во</span><span style={{ textAlign: 'right' }}>Выход</span><span style={{ textAlign: 'right' }}>Довезти</span>
                      </div>
                      {swStocks.map(st => {
                        const matName = st.materials?.name
                        const normInfo = NORM[matName]
                        const have = st.quantity
                        const norm = normInfo?.norm || 0
                        const output = norm ? Math.floor(have / norm) : 0
                        const need = norm ? Math.max(0, Math.ceil(sw.weekly_capacity * norm - have)) : 0
                        return (
                          <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 4, fontSize: 12, padding: '3px 0', borderBottom: '1px solid #f9f9f9', alignItems: 'center' }}>
                            <span style={{ color: '#666' }}>{matName}</span>
                            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(have)}</span>
                            <span style={{ textAlign: 'right', color: '#888', fontSize: 11 }}>{fmt(output)} шт</span>
                            {need > 0
                              ? <span style={{ textAlign: 'right', fontSize: 11, padding: '1px 5px', background: '#FCEBEB', color: '#A32D2D', borderRadius: 5 }}>+{fmt(need)}</span>
                              : <span style={{ textAlign: 'right', fontSize: 11, color: '#3B6D11' }}>ок</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Итоги */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '6px 10px' }}>
                      <div style={{ fontSize: 11, color: '#888' }}>Сдала</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{fmt(made)} шт</div>
                    </div>
                    <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '6px 10px' }}>
                      <div style={{ fontSize: 11, color: '#888' }}>Заработала</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{fmt(earned)} ₽</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* СВОДНЫЙ СКЛАД */}
      {activeTab === 'summary' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb' }}>Материал</th>
                  {sewers.map(s => <th key={s.id} style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{s.name.split(' ')[0]}</th>)}
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb' }}>Итого</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb' }}>Довезти</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(mat => {
                  let total = 0
                  const cells = sewers.map(s => {
                    const v = getStockVal(s.id, mat.name)
                    total += v
                    return <td key={s.id} style={{ textAlign: 'right', padding: '6px 12px', borderBottom: '1px solid #f5f5f5', fontVariantNumeric: 'tabular-nums' }}>{v > 0 ? fmt(v) : '—'}</td>
                  })
                  const normInfo = NORM[mat.name]
                  let totalNeed = 0
                  if (normInfo) {
                    sewers.forEach(s => {
                      const have = getStockVal(s.id, mat.name)
                      totalNeed += Math.max(0, Math.ceil(s.weekly_capacity * normInfo.norm - have))
                    })
                  }
                  return (
                    <tr key={mat.id}>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid #f5f5f5', color: '#444' }}>{mat.name}</td>
                      {cells}
                      <td style={{ textAlign: 'right', padding: '6px 12px', borderBottom: '1px solid #f5f5f5', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 12px', borderBottom: '1px solid #f5f5f5' }}>
                        {totalNeed > 0
                          ? <span style={{ fontSize: 11, padding: '1px 6px', background: '#FCEBEB', color: '#A32D2D', borderRadius: 5 }}>+{fmt(totalNeed)}</span>
                          : <span style={{ fontSize: 11, color: '#3B6D11' }}>ок</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ОПЕРАЦИИ */}
      {activeTab === 'ops' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Принять готовые изделия</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Швея</div>
                <select value={opSewer} onChange={e => setOpSewer(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {sewers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Изделие</div>
                <select value={opProduct} onChange={e => setOpProduct(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}>
                  {Object.keys(PCOL).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Количество</div>
                <input type="number" value={opQty} onChange={e => setOpQty(e.target.value)} placeholder="0" min="1" style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <button onClick={acceptProduction} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              Принять изделия
            </button>
            {opFeedback && <div style={{ fontSize: 12, color: '#085041', marginTop: 8 }}>{opFeedback}</div>}
          </div>
        </div>
      )}

      {/* ИСТОРИЯ */}
      {activeTab === 'log' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Дата', 'Швея', 'Изделие', 'Кол-во', 'Сумма'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 400, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productions.slice(0, 50).map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', color: '#888' }}>{new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>{p.sewers?.name}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[p.product] || '#888', flexShrink: 0 }}></span>
                      {p.product}
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.quantity)}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', color: '#085041', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.earned)} ₽</td>
                </tr>
              ))}
              {productions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ПОПАП */}
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', width: 380, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
            {popup.type === 'delivery' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Что везти: {popup.sewer.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Запас на 1 неделю · {popup.sewer.weekly_capacity} шт/нед</div>
                {popup.items.length === 0
                  ? <div style={{ color: '#3B6D11', fontSize: 13 }}>Всё в порядке — везти ничего не нужно</div>
                  : popup.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                      <span style={{ color: '#666' }}>{item.matName}</span>
                      <div>
                        <span style={{ fontWeight: 500, color: '#A32D2D' }}>+{fmt(item.need)}</span>
                        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>есть {fmt(item.have)}</span>
                      </div>
                    </div>
                  ))}
              </>
            )}
            {popup.type === 'history' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>История сдач: {popup.sewer.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Текущий месяц</div>
                {popup.rows.length === 0
                  ? <div style={{ color: '#aaa', fontSize: 13 }}>Нет сдач в этом месяце</div>
                  : popup.rows.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                      <span style={{ color: '#888' }}>{new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOL[r.product] || '#888' }}></span>
                        {r.product.replace('Кокошник ', '')}
                      </span>
                      <span>{fmt(r.quantity)} шт</span>
                      <span style={{ color: '#085041' }}>{fmt(r.earned)} ₽</span>
                    </div>
                  ))}
                {popup.rows.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 500, fontSize: 13 }}>
                    <span>Итого</span>
                    <span>{fmt(popup.rows.reduce((a, r) => a + r.quantity, 0))} шт</span>
                    <span style={{ color: '#085041' }}>{fmt(popup.rows.reduce((a, r) => a + r.earned, 0))} ₽</span>
                  </div>
                )}
              </>
            )}
            <button onClick={() => setPopup(null)} style={{ marginTop: 14, width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#666' }}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  )
}