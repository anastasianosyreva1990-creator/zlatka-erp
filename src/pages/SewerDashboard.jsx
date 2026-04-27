import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'

const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60','Кокошник Ягоды':'#7D3C98','Кокошник Петушки':'#E67E22'}
const PLBL = {'Кокошник Красный':'Красный','Кокошник Белый':'Белый','Кокошник Черный':'Чёрный','Кокошник Цветной':'Цветной','Кокошник Ягоды':'Ягоды','Кокошник Петушки':'Петушки'}
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
const fmt = x => Math.round(x).toLocaleString('ru-RU')
const MONTHS = ['Январь 2026','Февраль 2026','Март 2026','Апрель 2026']
const MONTH_PREFIX = {'Январь 2026':'2026-01','Февраль 2026':'2026-02','Март 2026':'2026-03','Апрель 2026':'2026-04'}

export default function SewerDashboard({ profile, onLogout }) {
  const sewer = profile?.sewers
  const [stocks, setStocks] = useState([])
  const [productions, setProductions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('main')
  const [selMonth, setSelMonth] = useState('Апрель 2026')
  const [sdProduct, setSdProduct] = useState('Кокошник Красный')
  const [sdQty, setSdQty] = useState('')
  const [sdFb, setSdFb] = useState('')
  const [rcMat, setRcMat] = useState('')
  const [rcQty, setRcQty] = useState('')
  const [rcFb, setRcFb] = useState('')
  const [rcMode, setRcMode] = useState('add')

  useEffect(() => { if (sewer) loadAll() }, [sewer])

  async function loadAll() {
    setLoading(true)
    const [{ data: st }, { data: pr }, { data: inv }, { data: mt }] = await Promise.all([
      supabase.from('material_stock').select('*, materials(name, unit)').eq('location', sewer.id),
      supabase.from('productions').select('*').eq('sewer_id', sewer.id).order('date', { ascending: false }),
      supabase.from('invoices').select('*').eq('sewer_id', sewer.id).order('created_at', { ascending: false }),
      supabase.from('materials').select('*').order('name'),
    ])
    setStocks(st || [])
    setProductions(pr || [])
    setInvoices(inv || [])
    setMaterials(mt || [])
    if (mt?.length > 0) setRcMat(mt[0].id)
    setLoading(false)
  }

  async function submitProduction() {
    if (!sdQty || !sewer) return
    const qty = parseInt(sdQty)
    await supabase.from('productions').insert({
      sewer_id: sewer.id, product: sdProduct, quantity: qty,
      date: new Date().toISOString().split('T')[0], earned: qty * sewer.tariff
    })
    for (const [matName, info] of Object.entries(NORM)) {
      if (!info.products.includes(sdProduct)) continue
      const stock = stocks.find(s => s.materials?.name === matName)
      if (stock) await supabase.from('material_stock').update({ quantity: Math.max(0, stock.quantity - info.norm * qty) }).eq('id', stock.id)
    }
    setSdFb(`✓ Сдача записана: ${PLBL[sdProduct]} ${qty} шт · +${fmt(qty * sewer.tariff)} ₽`)
    setSdQty(''); loadAll()
  }

  async function submitReceive() {
    if (!rcQty || !rcMat) return
    const qty = parseFloat(rcQty)
    const existing = stocks.find(s => s.material_id === rcMat)
    if (existing) {
      await supabase.from('material_stock').update({ quantity: existing.quantity + qty }).eq('id', existing.id)
    } else {
      await supabase.from('material_stock').insert({ material_id: rcMat, location: sewer.id, quantity: qty })
    }
    const mat = materials.find(m => m.id === rcMat)
    setRcFb(`✓ Получено: ${mat?.name} +${qty} ${mat?.unit}`)
    setRcQty(''); loadAll()
  }

  async function submitFix() {
    if (!rcQty || !rcMat) return
    const qty = parseFloat(rcQty)
    const existing = stocks.find(s => s.material_id === rcMat)
    if (existing) {
      await supabase.from('material_stock').update({ quantity: qty }).eq('id', existing.id)
    } else {
      await supabase.from('material_stock').insert({ material_id: rcMat, location: sewer.id, quantity: qty })
    }
    const mat = materials.find(m => m.id === rcMat)
    setRcFb(`✓ Остаток исправлен: ${mat?.name} = ${qty} ${mat?.unit}`)
    setRcQty(''); loadAll()
  }

  async function handleLogout() { await signOut(); onLogout() }

  if (!sewer) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F0EBE1' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:18, fontWeight:700, color:'#1C2E26', marginBottom:8 }}>Профиль не настроен</div>
        <div style={{ fontSize:13, color:'#7A6A5A', marginBottom:16 }}>Обратитесь к администратору</div>
        <button onClick={handleLogout} className="btn btn-primary">Выйти</button>
      </div>
    </div>
  )

  const monthProds = productions.filter(p => p.date?.startsWith(MONTH_PREFIX[selMonth] || ''))
  const monthQty = monthProds.reduce((a, p) => a + p.quantity, 0)
  const monthEarned = monthQty * sewer.tariff
  const totalEarned = productions.reduce((a, p) => a + p.earned, 0)
  const unpaidSum = invoices.filter(i => i.status === 'unpaid').reduce((a, i) => a + i.amount, 0)

  if (loading) return <div style={{ padding:40, color:'#5A4A3A' }}>Загрузка...</div>

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
      border:`1px solid ${activeTab===id?'#1C2E26':'rgba(74,111,82,0.2)'}`,
      background:activeTab===id?'#1C2E26':'transparent',
      color:activeTab===id?'#C4A882':'#4A3A2A'
    }}>{label}</button>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F0EBE1' }}>
      <div style={{ background:'#1C2E26', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#F2EBE0' }}>Злат<span style={{ color:'#C4A882' }}>ка</span></div>
          <div style={{ width:1, height:20, background:'rgba(196,168,130,0.3)' }}></div>
          <div style={{ fontSize:13, color:'#C4A882', fontWeight:700 }}>{sewer.name}</div>
          <div style={{ fontSize:11, color:'rgba(242,235,224,0.5)', fontWeight:500 }}>{sewer.tariff} ₽/шт</div>
        </div>
        <button onClick={handleLogout} style={{ fontSize:12, padding:'5px 14px', borderRadius:8, border:'1px solid rgba(196,168,130,0.3)', background:'rgba(196,168,130,0.1)', color:'#C4A882', cursor:'pointer', fontWeight:700 }}>Выйти</button>
      </div>

      <div style={{ padding:'20px 24px', maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Сдала в этом месяце', value:fmt(monthQty)+' шт', color:'#1C2E26' },
            { label:'Заработала за месяц', value:fmt(monthEarned)+' ₽', color:'#1A6B28' },
            { label:'Всего заработано', value:fmt(totalEarned)+' ₽', color:'#1C2E26' },
            { label:'Ожидает оплаты', value:fmt(unpaidSum)+' ₽', color:unpaidSum>0?'#6A1030':'#1A6B28' },
          ].map((m,i) => (
            <div key={i} style={{ background:'#fff', borderRadius:12, padding:'12px 14px', border:'0.5px solid rgba(74,111,82,0.15)' }}>
              <div style={{ fontSize:10, color:'#7A6A5A', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>{m.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          <TabBtn id="main" label="Мои материалы"/>
          <TabBtn id="submit" label="Сдать изделия"/>
          <TabBtn id="receive" label="Материалы"/>
          <TabBtn id="history" label="История сдач"/>
          <TabBtn id="invoices" label="Мои счета"/>
        </div>

        {activeTab==='main' && (
          <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(74,111,82,0.15)', overflow:'hidden' }}>
            {stocks.length===0 ? (
              <div style={{ padding:24, textAlign:'center', color:'#7A6A5A', fontWeight:600 }}>Нет данных. Обратитесь к администратору.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#F5F0E8' }}>
                    {['Материал','Остаток','Выход (шт)','Статус'].map(h=>(
                      <th key={h} style={{ textAlign:h==='Остаток'||h==='Выход (шт)'?'right':'left', padding:'10px 14px', color:'#4A3A2A', fontWeight:700, fontSize:11, textTransform:'uppercase', letterSpacing:0.5, borderBottom:'1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(st => {
                    const info = NORM[st.materials?.name]
                    const have = st.quantity
                    const norm = info?.norm || 0
                    const output = norm ? Math.floor(have/norm) : 0
                    const need = norm ? Math.max(0, Math.ceil(sewer.weekly_capacity*norm-have)) : 0
                    return (
                      <tr key={st.id}>
                        <td style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', fontWeight:700 }}>{st.materials?.name}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', textAlign:'right', fontWeight:800 }}>{fmt(have)} {st.materials?.unit}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', textAlign:'right', color:'#5A4A3A', fontWeight:600 }}>{fmt(output)}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', textAlign:'right' }}>
                          {need>0
                            ? <span style={{ background:'#EED4DD', color:'#6A1030', borderRadius:6, fontSize:11, padding:'2px 8px', fontWeight:700 }}>Нужно +{fmt(need)}</span>
                            : <span style={{ color:'#1A6B28', fontWeight:800 }}>✓ Достаточно</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab==='submit' && (
          <div style={{ maxWidth:440 }}>
            <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(74,111,82,0.15)', padding:'20px 22px' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#1C2E26', marginBottom:16 }}>Записать сдачу изделий</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                <div className="form-group">
                  <label className="form-label">Изделие</label>
                  <select value={sdProduct} onChange={e=>setSdProduct(e.target.value)}>
                    {Object.keys(PCOL).map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Количество (шт)</label>
                  <input type="number" value={sdQty} onChange={e=>setSdQty(e.target.value)} placeholder="0" min="1"/>
                </div>
              </div>
              {sdQty && (
                <div style={{ background:'#F5F0E8', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:'#5A4A3A', fontWeight:600 }}>К начислению:</span>
                    <span style={{ fontSize:16, fontWeight:800, color:'#1A6B28' }}>{fmt(parseInt(sdQty||0)*sewer.tariff)} ₽</span>
                  </div>
                </div>
              )}
              <button onClick={submitProduction} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>Записать сдачу</button>
              {sdFb && <div style={{ marginTop:10, fontSize:12, color:'#1A6B28', fontWeight:700, background:'#D8EED8', padding:'8px 12px', borderRadius:8 }}>{sdFb}</div>}
            </div>
          </div>
        )}

        {activeTab==='receive' && (
          <div style={{ maxWidth:440 }}>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[{id:'add',l:'Получить материалы'},{id:'fix',l:'Исправить остаток'}].map(t=>(
                <button key={t.id} onClick={()=>setRcMode(t.id)} style={{
                  padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                  border:`1px solid ${rcMode===t.id?'#1C2E26':'rgba(74,111,82,0.2)'}`,
                  background:rcMode===t.id?'#1C2E26':'transparent',
                  color:rcMode===t.id?'#C4A882':'#4A3A2A'
                }}>{t.l}</button>
              ))}
            </div>
            <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(74,111,82,0.15)', padding:'20px 22px' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#1C2E26', marginBottom:16 }}>
                {rcMode==='add' ? 'Отметить получение материалов' : 'Исправить остаток материала'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                <div className="form-group">
                  <label className="form-label">Материал</label>
                  <select value={rcMat} onChange={e=>setRcMat(e.target.value)}>
                    {materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{rcMode==='add' ? 'Добавить количество' : 'Новый остаток'}</label>
                  <input type="number" value={rcQty} onChange={e=>setRcQty(e.target.value)}
                    placeholder={rcMode==='add' ? '+10' : 'Точное кол-во'} min="0" step="0.1"/>
                </div>
              </div>
              {rcMode==='fix' && (
                <div style={{ background:'#EEE4C8', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#6A4A10', fontWeight:600 }}>
                  ⚠ Введите точное количество которое есть сейчас. Текущий остаток будет заменён.
                </div>
              )}
              <button onClick={rcMode==='add' ? submitReceive : submitFix}
                className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>
                {rcMode==='add' ? 'Отметить получение' : 'Сохранить остаток'}
              </button>
              {rcFb && <div style={{ marginTop:10, fontSize:12, color:'#1A6B28', fontWeight:700, background:'#D8EED8', padding:'8px 12px', borderRadius:8 }}>{rcFb}</div>}
            </div>
          </div>
        )}

        {activeTab==='history' && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
              {MONTHS.map(m=>(
                <button key={m} onClick={()=>setSelMonth(m)} style={{
                  padding:'5px 12px', borderRadius:16, fontSize:11, fontWeight:700, cursor:'pointer',
                  border:`1px solid ${selMonth===m?'#1C2E26':'rgba(74,111,82,0.2)'}`,
                  background:selMonth===m?'#1C2E26':'transparent',
                  color:selMonth===m?'#C4A882':'#4A3A2A'
                }}>{m}</button>
              ))}
            </div>
            <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(74,111,82,0.15)', overflow:'hidden', marginBottom:12 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#F5F0E8' }}>
                    {['Дата','Изделие','Кол-во','Сумма'].map(h=>(
                      <th key={h} style={{ textAlign:h==='Кол-во'||h==='Сумма'?'right':'left', padding:'10px 14px', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthProds.map(p=>(
                    <tr key={p.id}>
                      <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', color:'#7A6A5A', fontWeight:600 }}>
                        {new Date(p.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
                      </td>
                      <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontWeight:700 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:PCOL[p.product]||'#888' }}></span>
                          {p.product}
                        </span>
                      </td>
                      <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', textAlign:'right', fontWeight:800 }}>{fmt(p.quantity)} шт</td>
                      <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', textAlign:'right', fontWeight:800, color:'#1A6B28' }}>{fmt(p.earned)} ₽</td>
                    </tr>
                  ))}
                  {monthProds.length===0 && (
                    <tr><td colSpan={4} style={{ textAlign:'center', padding:24, color:'#7A6A5A', fontWeight:600 }}>Нет сдач за {selMonth}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {monthProds.length>0 && (
              <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(74,111,82,0.15)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#1C2E26' }}>Итого за {selMonth}</span>
                <div style={{ display:'flex', gap:20 }}>
                  <span style={{ fontSize:14, fontWeight:700 }}>{fmt(monthQty)} шт</span>
                  <span style={{ fontSize:16, fontWeight:800, color:'#1A6B28' }}>{fmt(monthEarned)} ₽</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab==='invoices' && (
          <div>
            {invoices.length===0 ? (
              <div style={{ background:'#fff', borderRadius:12, padding:24, textAlign:'center', color:'#7A6A5A', fontWeight:600 }}>Счетов пока нет</div>
            ) : (
              <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(74,111,82,0.15)', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#F5F0E8' }}>
                      {['Месяц','Сумма','№ счёта','Дата','Статус'].map(h=>(
                        <th key={h} style={{ textAlign:h==='Сумма'?'right':'left', padding:'10px 14px', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv=>(
                      <tr key={inv.id}>
                        <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', fontWeight:700 }}>{inv.month}</td>
                        <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', textAlign:'right', fontWeight:800, color:'#1A6B28' }}>{fmt(inv.amount)} ₽</td>
                        <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', color:'#7A6A5A' }}>{inv.invoice_num||'—'}</td>
                        <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', color:'#7A6A5A' }}>
                          {inv.invoice_date?new Date(inv.invoice_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'}
                        </td>
                        <td style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:700, background:inv.status==='paid'?'#D8EED8':'#EED4DD', color:inv.status==='paid'?'#1A4A28':'#6A1030' }}>
                            {inv.status==='paid'?'Оплачено':'Ожидает оплаты'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}