import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60'}
const PLBL = {'Кокошник Красный':'Красный','Кокошник Белый':'Белый','Кокошник Черный':'Чёрный','Кокошник Цветной':'Цветной'}
const PRODUCTS = Object.keys(PCOL)

const SEWER_MATS = ['Кожа Белая','Кожа Красная','Кожа Черная','Габардин Цветной','Резинка Черная','Резинка Белая','Регулятор Белый','Регулятор Черный','Основа пластиковая']

const NORM = {
  'Кожа Белая':{products:['Кокошник Белый'],norm:0.0476},
  'Кожа Красная':{products:['Кокошник Красный'],norm:0.0476},
  'Кожа Черная':{products:['Кокошник Черный'],norm:0.0476},
  'Габардин Цветной':{products:['Кокошник Цветной'],norm:0.0555},
  'Резинка Белая':{products:['Кокошник Белый'],norm:0.2},
  'Резинка Черная':{products:['Кокошник Красный','Кокошник Черный','Кокошник Цветной'],norm:0.2},
  'Регулятор Белый':{products:['Кокошник Белый'],norm:2},
  'Регулятор Черный':{products:['Кокошник Красный','Кокошник Черный','Кокошник Цветной'],norm:2},
  'Основа пластиковая':{products:['Кокошник Красный','Кокошник Белый','Кокошник Черный','Кокошник Цветной'],norm:1},
}

export default function Production() {
  const [sewers, setSewers] = useState([])
  const [stocks, setStocks] = useState([])
  const [productions, setProductions] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('main')
  const [popup, setPopup] = useState(null)
  const [opType, setOpType] = useState('receive')
  const [opMat, setOpMat] = useState('')
  const [opQty, setOpQty] = useState('')
  const [opProd, setOpProd] = useState('Кокошник Красный')
  const [opQtyP, setOpQtyP] = useState('')
  const [opFb, setOpFb] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: sw }, { data: st }, { data: pr }, { data: mt }] = await Promise.all([
      supabase.from('sewers').select('*').eq('active', true).order('name'),
      supabase.from('material_stock').select('*, materials(name, unit)'),
      supabase.from('productions').select('*, sewers(name)').order('date', { ascending: false }),
      supabase.from('materials').select('*').order('name'),
    ])
    setSewers(sw || [])
    setStocks(st || [])
    setProductions(pr || [])
    setMaterials(mt || [])
    if (mt?.length > 0) setOpMat(mt.find(m => SEWER_MATS.includes(m.name))?.id || mt[0].id)
    setLoading(false)
  }

  function getSewerStocks(sewerId) {
    return stocks.filter(s => s.location === sewerId && SEWER_MATS.includes(s.materials?.name))
  }

  async function submitOp() {
    if (!popup?.sewer) return
    const sewer = popup.sewer

    if (opType === 'receive' && opMat && opQty) {
      const qty = parseFloat(opQty)
      const existing = stocks.find(s => s.material_id === opMat && s.location === sewer.id)
      if (existing) {
        await supabase.from('material_stock').update({ quantity: existing.quantity + qty }).eq('id', existing.id)
      } else {
        await supabase.from('material_stock').insert({ material_id: opMat, location: sewer.id, quantity: qty })
      }
      setOpFb(`✓ Выдано`)
      setOpQty('')
    }

    if (opType === 'submit' && opProd && opQtyP) {
      const qty = parseInt(opQtyP)
      await supabase.from('productions').insert({
        sewer_id: sewer.id, product: opProd, quantity: qty,
        date: new Date().toISOString().split('T')[0],
        earned: qty * sewer.tariff
      })
      for (const [matName, info] of Object.entries(NORM)) {
        if (!info.products.includes(opProd)) continue
        const stock = stocks.find(s => s.location === sewer.id && s.materials?.name === matName)
        if (stock) {
          await supabase.from('material_stock').update({
            quantity: Math.max(0, stock.quantity - info.norm * qty)
          }).eq('id', stock.id)
        }
      }
      setOpFb(`✓ Принято ${qty} шт`)
      setOpQtyP('')
    }
    loadAll()
  }

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${activeTab === id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
      background: activeTab === id ? '#1C2E26' : 'transparent',
      color: activeTab === id ? '#C4A882' : '#4A3A2A'
    }}>{label}</button>
  )

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  const monthPfx = '2026-04'
  const totalProduced = productions.filter(p => p.date?.startsWith(monthPfx)).reduce((a, p) => a + p.quantity, 0)
  const totalSalary = productions.filter(p => p.date?.startsWith(monthPfx)).reduce((a, p) => {
    const sw = sewers.find(s => s.id === p.sewer_id)
    return a + p.quantity * (sw?.tariff || 0)
  }, 0)
  const leader = sewers.map(sw => ({
    name: sw.name,
    qty: productions.filter(p => p.sewer_id === sw.id && p.date?.startsWith(monthPfx)).reduce((a, p) => a + p.quantity, 0)
  })).sort((a, b) => b.qty - a.qty)[0]

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2E26', marginBottom: 20 }}>
        Производство / <span style={{ color: '#C4A882' }}>Швеи</span>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Произведено в месяце', value: fmt(totalProduced) + ' кокошников' },
          { label: 'Начислено швеям', value: fmt(totalSalary) + ' ₽' },
          { label: 'Лидер месяца', value: leader?.name || '—', sub: fmt(leader?.qty || 0) + ' шт' },
          { label: 'Швей активных', value: sewers.length + ' человек' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid rgba(74,111,82,0.15)' }}>
            <div style={{ fontSize: 10, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1C2E26' }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 11, color: '#7A6A5A', marginTop: 2 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <TabBtn id="main" label="Главная"/>
        <TabBtn id="stock" label="Сводный склад"/>
        <TabBtn id="history" label="История"/>
      </div>

      {activeTab === 'main' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {sewers.map(sw => {
            const sewerStocks = getSewerStocks(sw.id)
            const monthQty = productions.filter(p => p.sewer_id === sw.id && p.date?.startsWith(monthPfx)).reduce((a, p) => a + p.quantity, 0)
            const monthEarned = monthQty * sw.tariff

            return (
              <div key={sw.id} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid rgba(74,111,82,0.2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(28,46,38,0.06)' }}>
                {/* Шапка */}
                <div style={{ background: '#1C2E26', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#C4A882', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#1C2E26', flexShrink: 0 }}>
                      {sw.name.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#F2EBE0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sw.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(196,168,130,0.7)', whiteSpace: 'nowrap' }}>{sw.tariff} ₽/шт · {sw.weekly_capacity} шт/нед</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPopup({ type: 'vezti', sewer: sw })}
                      style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(196,168,130,0.5)', background: 'rgba(196,168,130,0.15)', color: '#C4A882', cursor: 'pointer', fontWeight: 700 }}>
                      ↗ Везти
                    </button>
                    <button onClick={() => { setPopup({ type: 'op', sewer: sw }); setOpFb('') }}
                      style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(196,168,130,0.3)', background: 'transparent', color: 'rgba(196,168,130,0.8)', cursor: 'pointer', fontWeight: 700 }}>
                      Операция
                    </button>
                    <button onClick={() => setPopup({ type: 'history', sewer: sw })}
                      style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(196,168,130,0.2)', background: 'transparent', color: 'rgba(196,168,130,0.6)', cursor: 'pointer', fontWeight: 700 }}>
                      История
                    </button>
                  </div>
                </div>

                {/* Материалы */}
                <div style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 45px 60px', gap: 4, padding: '5px 0', fontSize: 9, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(74,111,82,0.1)', marginBottom: 4 }}>
                    <span>Материал</span>
                    <span style={{ textAlign: 'right' }}>Кол-во</span>
                    <span style={{ textAlign: 'right' }}>Выход</span>
                    <span style={{ textAlign: 'right' }}>Довезти</span>
                  </div>
                  {sewerStocks.length === 0 ? (
                    <div style={{ padding: '8px 0', fontSize: 11, color: '#9A8878', textAlign: 'center' }}>Нет данных</div>
                  ) : sewerStocks.map(st => {
                    const matName = st.materials?.name
                    const info = NORM[matName]
                    const have = st.quantity
                    const output = info ? Math.floor(have / info.norm) : 0
                    const need = info ? Math.max(0, Math.ceil(sw.weekly_capacity * info.norm - have)) : 0
                    return (
                      <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 45px 60px', gap: 4, padding: '4px 0', borderBottom: '0.5px solid rgba(74,111,82,0.06)', fontSize: 11, alignItems: 'center' }}>
                        <span style={{ color: '#1C2E26', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{matName}</span>
                        <span style={{ textAlign: 'right', color: '#3A2A1A', fontWeight: 700 }}>{fmt(have)} {st.materials?.unit}</span>
                        <span style={{ textAlign: 'right', color: '#7A6A5A', fontSize: 10 }}>{fmt(output)}</span>
                        <span style={{ textAlign: 'right' }}>
                          {need > 0
                            ? <span style={{ background: '#EED4DD', color: '#6A1030', borderRadius: 5, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>+{fmt(need)}</span>
                            : <span style={{ color: '#1A6B28', fontWeight: 800 }}>✓</span>
                          }
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Итог */}
                <div style={{ padding: '8px 14px 12px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(74,111,82,0.1)', marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase' }}>Сдала</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1C2E26' }}>{fmt(monthQty)} шт</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase' }}>Заработала</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1A6B28' }}>{fmt(monthEarned)} ₽</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'stock' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr style={{ background: '#F5F0E8' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>Материал</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>На складе</th>
                {sewers.map(sw => (
                  <th key={sw.id} style={{ padding: '10px 14px', textAlign: 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{sw.name}</th>
                ))}
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>Итого</th>
              </tr>
            </thead>
            <tbody>
              {materials.filter(m => SEWER_MATS.includes(m.name)).map(mat => {
                const whStock = stocks.find(s => s.material_id === mat.id && s.location === 'warehouse')
                const whQty = whStock?.quantity || 0
                const sewerQtys = sewers.map(sw => stocks.find(s => s.material_id === mat.id && s.location === sw.id)?.quantity || 0)
                const total = whQty + sewerQtys.reduce((a, b) => a + b, 0)
                return (
                  <tr key={mat.id}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{mat.name}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(whQty)} {mat.unit}</td>
                    {sewerQtys.map((qty, i) => (
                      <td key={i} style={{ padding: '10px 14px', textAlign: 'right', color: '#5A4A3A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(qty)} {mat.unit}</td>
                    ))}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1A6B28', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(total)} {mat.unit}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F5F0E8' }}>
                {['Дата','Швея','Изделие','Кол-во','Начислено'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h==='Кол-во'||h==='Начислено'?'right':'left', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productions.slice(0, 100).map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '9px 14px', color: '#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                    {new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '9px 14px', fontWeight: 700, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{p.sewers?.name}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[p.product] || '#888' }}></span>
                      {p.product}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(p.quantity)} шт</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, color: '#1A6B28', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(p.earned)} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ПОПАП ВЕЗТИ */}
      {popup?.type === 'vezti' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPopup(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 500, padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>Везти — {popup.sewer.name}</span>
              <button onClick={() => setPopup(null)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#6A4A10', background: '#EEE4C8', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
              ⓘ Расчёт на 1 неделю исходя из нормы выработки швеи ({popup.sewer.weekly_capacity} шт/нед). Колонка "Довезти" показывает сколько нужно добавить чтобы швея могла работать всю неделю без остановки.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  {['Материал','Есть','Нужно на нед.','Довезти'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h==='Материал'?'left':'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getSewerStocks(popup.sewer.id).map(st => {
                  const matName = st.materials?.name
                  const info = NORM[matName]
                  const have = st.quantity
                  const need = info ? Math.ceil(popup.sewer.weekly_capacity * info.norm) : 0
                  const bring = Math.max(0, need - have)
                  return (
                    <tr key={st.id}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{matName}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(have)} {st.materials?.unit}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(need)} {st.materials?.unit}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)', color: bring > 0 ? '#6A1030' : '#1A6B28' }}>
                        {bring > 0 ? '+' + fmt(bring) + ' ' + st.materials?.unit : '✓ Достаточно'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ПОПАП ОПЕРАЦИЯ */}
      {popup?.type === 'op' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPopup(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 480, padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>Операция — {popup.sewer.name}</span>
              <button onClick={() => setPopup(null)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ id: 'receive', l: 'Выдать материалы' }, { id: 'submit', l: 'Принять изделия' }].map(t => (
                <button key={t.id} onClick={() => setOpType(t.id)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${opType === t.id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
                  background: opType === t.id ? '#1C2E26' : 'transparent',
                  color: opType === t.id ? '#C4A882' : '#4A3A2A'
                }}>{t.l}</button>
              ))}
            </div>
            {opType === 'receive' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Материал</div>
                  <select value={opMat} onChange={e => setOpMat(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}>
                    {materials.filter(m => SEWER_MATS.includes(m.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Количество</div>
                  <input type="number" value={opQty} onChange={e => setOpQty(e.target.value)} placeholder="0" min="0" step="0.1"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }} />
                </div>
              </div>
            )}
            {opType === 'submit' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Изделие</div>
                  <select value={opProd} onChange={e => setOpProd(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }}>
                    {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 4 }}>Количество (шт)</div>
                  <input type="number" value={opQtyP} onChange={e => setOpQtyP(e.target.value)} placeholder="0" min="1"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13 }} />
                </div>
                {opQtyP && (
                  <div style={{ gridColumn: '1/-1', background: '#F5F0E8', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    К начислению: <strong style={{ color: '#1A6B28' }}>{fmt(parseInt(opQtyP || 0) * popup.sewer.tariff)} ₽</strong>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={submitOp} style={{ padding: '8px 20px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Сохранить
              </button>
              {opFb && <div style={{ fontSize: 12, color: '#1A6B28', fontWeight: 700 }}>{opFb}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ПОПАП ИСТОРИЯ СДАЧ */}
      {popup?.type === 'history' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPopup(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 560, maxHeight: '80vh', overflow: 'auto', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#1C2E26' }}>История сдач — {popup.sewer.name}</span>
              <button onClick={() => setPopup(null)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#7A6A5A' }}>×</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  {['Дата','Изделие','Кол-во','Начислено'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h==='Кол-во'||h==='Начислено'?'right':'left', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productions.filter(p => p.sewer_id === popup.sewer.id).map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '8px 12px', color: '#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                      {new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[p.product] || '#888' }}></span>
                        {PLBL[p.product] || p.product}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(p.quantity)} шт</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#1A6B28', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(p.earned)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}