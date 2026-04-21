import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60'}
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

const S = {
  card:{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',overflow:'hidden',display:'flex',flexDirection:'column'},
  head:{background:'#1C2E26',padding:'12px 14px',display:'flex',alignItems:'center',gap:10},
  avatar:{width:36,height:36,borderRadius:'50%',background:'rgba(196,168,130,0.2)',border:'1.5px solid rgba(196,168,130,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#C4A882',flexShrink:0},
  body:{padding:'8px 14px',flex:1},
  matRow:{display:'grid',gridTemplateColumns:'1fr 44px 44px 56px',gap:4,padding:'3px 0',borderBottom:'0.5px solid rgba(74,111,82,0.06)',alignItems:'center',fontSize:11},
  footer:{display:'grid',gridTemplateColumns:'1fr 1fr',borderTop:'0.5px solid rgba(196,168,130,0.15)'},
  stat:{padding:'8px 14px'},
}

export default function Production() {
  const [sewers,setSewers] = useState([])
  const [stocks,setStocks] = useState([])
  const [productions,setProductions] = useState([])
  const [materials,setMaterials] = useState([])
  const [loading,setLoading] = useState(true)
  const [activeTab,setActiveTab] = useState('main')
  const [popup,setPopup] = useState(null)
  const [opSewer,setOpSewer] = useState('')
  const [opProduct,setOpProduct] = useState('Кокошник Красный')
  const [opQty,setOpQty] = useState('')
  const [opFb,setOpFb] = useState('')

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    const [{data:sw},{data:st},{data:pr},{data:mt}] = await Promise.all([
      supabase.from('sewers').select('*').eq('active',true).order('name'),
      supabase.from('material_stock').select('*, materials(name, unit)'),
      supabase.from('productions').select('*, sewers(name)').order('created_at',{ascending:false}),
      supabase.from('materials').select('*'),
    ])
    setSewers(sw||[]);setStocks(st||[]);setProductions(pr||[]);setMaterials(mt||[])
    if(sw?.length>0) setOpSewer(sw[0].id)
    setLoading(false)
  }

  function getSewerStock(id){return stocks.filter(s=>s.location===id)}
  function getMonthProds(id){
    const m=new Date().toISOString().slice(0,7)
    return productions.filter(p=>p.sewer_id===id&&p.created_at?.slice(0,7)===m)
  }
  function getStockVal(id,name){return stocks.find(s=>s.location===id&&s.materials?.name===name)?.quantity||0}

  async function acceptProduction(){
    if(!opQty||!opSewer) return
    const qty=parseInt(opQty)
    const sewer=sewers.find(s=>s.id===opSewer)
    if(!sewer) return
    await supabase.from('productions').insert({sewer_id:opSewer,product:opProduct,quantity:qty,date:new Date().toISOString().split('T')[0],earned:qty*sewer.tariff})
    for(const[matName,info] of Object.entries(NORM)){
      if(!info.products.includes(opProduct)) continue
      const stock=stocks.find(s=>s.location===opSewer&&s.materials?.name===matName)
      if(stock) await supabase.from('material_stock').update({quantity:Math.max(0,stock.quantity-info.norm*qty)}).eq('id',stock.id)
    }
    setOpFb(`✓ Принято ${qty} шт · начислено ${fmt(qty*sewer.tariff)} ₽`)
    setOpQty('');loadAll()
  }

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  const monthProds=productions.filter(p=>p.created_at?.slice(0,7)===new Date().toISOString().slice(0,7))
  const totalMade=monthProds.reduce((a,p)=>a+p.quantity,0)
  const totalPay=sewers.reduce((a,s)=>a+getMonthProds(s.id).reduce((x,p)=>x+p.quantity,0)*s.tariff,0)
  const leader=sewers.reduce((best,s)=>{const m=getMonthProds(s.id).reduce((x,p)=>x+p.quantity,0);return m>(best?.made||0)?{...s,made:m}:best},null)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Производство <span>/ Швеи</span></h1>
      </div>

      <div className="metrics">
        <div className="metric-card dark">
          <div className="metric-label">Произведено в месяце</div>
          <div className="metric-value">{fmt(totalMade)}</div>
          <div className="metric-sub">кокошников</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Выплатить швеям</div>
          <div className="metric-value" style={{color:'#1A6B28'}}>{fmt(totalPay)} ₽</div>
          <div className="metric-sub">за текущий месяц</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Лидер месяца</div>
          <div className="metric-value" style={{fontSize:18}}>{leader?.name||'—'}</div>
          <div className="metric-sub">{leader?fmt(leader.made)+' шт':''}</div>
        </div>
        <div className="metric-card wine">
          <div className="metric-label">Швей активных</div>
          <div className="metric-value">{sewers.length}</div>
          <div className="metric-sub">человек</div>
        </div>
      </div>

      <div className="tabs">
        {[{id:'main',l:'Главная'},{id:'summary',l:'Сводный склад'},{id:'ops',l:'Операции'},{id:'log',l:'История'}].map(t=>(
          <button key={t.id} className={`tab-btn${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {activeTab==='main' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
          {sewers.map(sw=>{
            const prods=getMonthProds(sw.id)
            const made=prods.reduce((a,p)=>a+p.quantity,0)
            const earned=made*sw.tariff
            const swStocks=getSewerStock(sw.id)
            return (
              <div key={sw.id} style={S.card}>
                <div style={S.head}>
                  <div style={S.avatar}>{sw.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#F2EBE0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sw.name}</div>
                    <div style={{fontSize:10,color:'rgba(196,168,130,0.8)',marginTop:1}}>{sw.tariff} ₽/шт · {sw.weekly_capacity} шт/нед</div>
                  </div>
                  <div style={{display:'flex',gap:5,flexShrink:0}}>
                    <button onClick={()=>setPopup({type:'delivery',sewer:sw})} style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:'1px solid rgba(196,168,130,0.3)',background:'rgba(196,168,130,0.12)',color:'#C4A882',cursor:'pointer',fontWeight:700}}>↗ Везти</button>
                    <button onClick={()=>setPopup({type:'history',sewer:sw,rows:getMonthProds(sw.id)})} style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'rgba(242,235,224,0.6)',cursor:'pointer',fontWeight:600}}>История</button>
                  </div>
                </div>
                <div style={S.body}>
                  {swStocks.length===0?(
                    <div style={{fontSize:11,color:'#9A8878',padding:'6px 0',textAlign:'center'}}>Нет данных по материалам</div>
                  ):(
                    <>
                      <div style={{...S.matRow,borderBottom:'1px solid rgba(196,168,130,0.2)',marginBottom:2,paddingBottom:4}}>
                        <span style={{fontSize:10,color:'#7A6A5A',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5}}>Материал</span>
                        <span style={{textAlign:'right',fontSize:10,color:'#7A6A5A',fontWeight:700}}>Кол-во</span>
                        <span style={{textAlign:'right',fontSize:10,color:'#7A6A5A',fontWeight:700}}>Выход</span>
                        <span style={{textAlign:'right',fontSize:10,color:'#7A6A5A',fontWeight:700}}>Довезти</span>
                      </div>
                      {swStocks.map(st=>{
                        const matName=st.materials?.name
                        const info=NORM[matName]
                        const have=st.quantity
                        const norm=info?.norm||0
                        const output=norm?Math.floor(have/norm):0
                        const need=norm?Math.max(0,Math.ceil(sw.weekly_capacity*norm-have)):0
                        return (
                          <div key={st.id} style={S.matRow}>
                            <span style={{color:'#3A2A1A',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{matName}</span>
                            <span style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:700,color:'#1C2E26'}}>{fmt(have)}</span>
                            <span style={{textAlign:'right',color:'#7A6A5A',fontWeight:500}}>{fmt(output)}</span>
                            {need>0
                              ?<span style={{textAlign:'right'}}><span style={{background:'#EED4DD',color:'#6A1030',borderRadius:5,fontSize:10,padding:'1px 5px',fontWeight:700}}>+{fmt(need)}</span></span>
                              :<span style={{textAlign:'right',color:'#1A6B28',fontWeight:700,fontSize:12}}>✓</span>
                            }
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
                <div style={S.footer}>
                  <div style={S.stat}>
                    <div style={{fontSize:10,color:'#7A6A5A',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>Сдала</div>
                    <div style={{fontSize:20,fontWeight:800,color:'#1C2E26'}}>{fmt(made)} <span style={{fontSize:11,fontWeight:500,color:'#7A6A5A'}}>шт</span></div>
                  </div>
                  <div style={{...S.stat,borderLeft:'0.5px solid rgba(196,168,130,0.2)'}}>
                    <div style={{fontSize:10,color:'#7A6A5A',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>Заработала</div>
                    <div style={{fontSize:20,fontWeight:800,color:'#1A6B28'}}>{fmt(earned)} <span style={{fontSize:11,fontWeight:500,color:'#7A6A5A'}}>₽</span></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab==='summary' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Материал</th>
                {sewers.map(s=><th key={s.id} style={{textAlign:'right'}}>{s.name.split(' ')[0]}</th>)}
                <th style={{textAlign:'right'}}>Итого</th>
                <th style={{textAlign:'right'}}>Довезти</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(mat=>{
                let total=0
                const cells=sewers.map(s=>{
                  const v=getStockVal(s.id,mat.name);total+=v
                  return <td key={s.id} style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600}}>{v>0?fmt(v):<span style={{color:'#C8BFB0'}}>—</span>}</td>
                })
                const info=NORM[mat.name]
                let totalNeed=0
                if(info) sewers.forEach(s=>{totalNeed+=Math.max(0,Math.ceil(s.weekly_capacity*info.norm-getStockVal(s.id,mat.name)))})
                return (
                  <tr key={mat.id}>
                    <td style={{fontWeight:700}}>{mat.name}</td>
                    {cells}
                    <td style={{textAlign:'right',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{fmt(total)}</td>
                    <td style={{textAlign:'right'}}>
                      {totalNeed>0
                        ?<span style={{background:'#EED4DD',color:'#6A1030',borderRadius:6,fontSize:11,padding:'2px 8px',fontWeight:700}}>+{fmt(totalNeed)}</span>
                        :<span style={{color:'#1A6B28',fontWeight:700}}>✓</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab==='ops' && (
        <div style={{maxWidth:500}}>
          <div className="card">
            <div className="card-title">Принять готовые изделия</div>
            <div className="form-grid fg3" style={{marginBottom:12}}>
              <div className="form-group">
                <label className="form-label">Швея</label>
                <select value={opSewer} onChange={e=>setOpSewer(e.target.value)}>
                  {sewers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Изделие</label>
                <select value={opProduct} onChange={e=>setOpProduct(e.target.value)}>
                  {Object.keys(PCOL).map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Количество</label>
                <input type="number" value={opQty} onChange={e=>setOpQty(e.target.value)} placeholder="0" min="1"/>
              </div>
            </div>
            <button onClick={acceptProduction} className="btn btn-primary">Принять изделия</button>
            {opFb&&<div className="mt-8 text-green text-sm" style={{fontWeight:700}}>{opFb}</div>}
          </div>
        </div>
      )}

      {activeTab==='log' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th><th>Швея</th><th>Изделие</th>
                <th style={{textAlign:'right'}}>Кол-во</th>
                <th style={{textAlign:'right'}}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {productions.slice(0,50).map(p=>(
                <tr key={p.id}>
                  <td className="text-muted">{new Date(p.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</td>
                  <td style={{fontWeight:700}}>{p.sewers?.name}</td>
                  <td>
                    <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:PCOL[p.product]||'#888',flexShrink:0}}></span>
                      <span style={{fontWeight:600}}>{p.product}</span>
                    </span>
                  </td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:700}}>{fmt(p.quantity)}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:700,color:'#1A6B28'}}>{fmt(p.earned)} ₽</td>
                </tr>
              ))}
              {productions.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'#7A6A5A'}}>Нет данных</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {popup&&(
        <div className="popup-overlay" onClick={()=>setPopup(null)}>
          <div className="popup" onClick={e=>e.stopPropagation()}>
            <div className="popup-header">
              <span className="popup-title">
                {popup.type==='delivery'?`Что везти: ${popup.sewer.name}`:`История: ${popup.sewer.name}`}
              </span>
              <button className="popup-close" onClick={()=>setPopup(null)}>×</button>
            </div>
            <div className="popup-body">
              {popup.type==='delivery'&&(()=>{
                const items=[]
                for(const[matName,info] of Object.entries(NORM)){
                  const have=getStockVal(popup.sewer.id,matName)
                  const need=Math.max(0,Math.ceil(popup.sewer.weekly_capacity*info.norm-have))
                  if(need>0) items.push({matName,need,have})
                }
                return items.length===0
                  ?<div style={{color:'#1A6B28',fontWeight:700}}>✓ Всё в порядке</div>
                  :items.map((item,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid rgba(74,111,82,0.1)'}}>
                      <span style={{color:'#3A2A1A',fontWeight:600}}>{item.matName}</span>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:11,color:'#7A6A5A',fontWeight:500}}>есть {fmt(item.have)}</span>
                        <span style={{background:'#EED4DD',color:'#6A1030',borderRadius:6,fontSize:11,padding:'2px 8px',fontWeight:700}}>+{fmt(item.need)}</span>
                      </div>
                    </div>
                  ))
              })()}
              {popup.type==='history'&&(
                popup.rows.length===0
                  ?<div style={{color:'#7A6A5A',fontWeight:600}}>Нет сдач в этом месяце</div>
                  :popup.rows.map(r=>(
                    <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)',fontSize:13}}>
                      <span style={{color:'#7A6A5A',fontWeight:500}}>{new Date(r.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</span>
                      <span style={{display:'flex',alignItems:'center',gap:5,fontWeight:600}}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:PCOL[r.product]||'#888'}}></span>
                        {r.product.replace('Кокошник ','')}
                      </span>
                      <span style={{fontWeight:700}}>{fmt(r.quantity)} шт</span>
                      <span style={{color:'#1A6B28',fontWeight:800}}>{fmt(r.earned)} ₽</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}