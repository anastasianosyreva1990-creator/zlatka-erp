import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60'}
const PLBL = {'Кокошник Красный':'Красный','Кокошник Белый':'Белый','Кокошник Черный':'Чёрный','Кокошник Цветной':'Цветной'}
const fmt = x => Math.round(x).toLocaleString('ru-RU')

export default function Batches() {
  const [batches,setBatches] = useState([])
  const [batchItems,setBatchItems] = useState([])
  const [sewers,setSewers] = useState([])
  const [stock,setStock] = useState([])
  const [loading,setLoading] = useState(true)
  const [activeTab,setActiveTab] = useState('batches')
  const [filter,setFilter] = useState('all')
  const [popup,setPopup] = useState(null)
  const [nbSize,setNbSize] = useState(108)
  const [nbFb,setNbFb] = useState('')
  const [apProd,setApProd] = useState('Кокошник Красный')
  const [apQty,setApQty] = useState('')
  const [apWho,setApWho] = useState('')
  const [apFb,setApFb] = useState('')

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    const [{data:b},{data:bi},{data:sw},{data:st}] = await Promise.all([
      supabase.from('batches').select('*').order('batch_num'),
      supabase.from('batch_items').select('*, sewers(name)'),
      supabase.from('sewers').select('*').eq('active',true),
      supabase.from('material_stock').select('*, materials(name)').eq('location','ready'),
    ])
    setBatches(b||[]);setBatchItems(bi||[]);setSewers(sw||[]);setStock(st||[])
    if(sw?.length>0) setApWho(sw[0].id)
    setLoading(false)
  }

  function getItems(batchId){return batchItems.filter(i=>i.batch_id===batchId)}
  function byColor(){
    const out={}
    stock.forEach(s=>{const n=s.materials?.name;if(n)out[n]=(out[n]||0)+s.quantity})
    return out
  }

  async function addToStock(){
    if(!apQty) return
    const qty=parseInt(apQty)
    const existing=stock.find(s=>s.materials?.name===apProd&&s.location==='ready')
    if(existing){
      await supabase.from('material_stock').update({quantity:existing.quantity+qty}).eq('id',existing.id)
    } else {
      const {data:mat}=await supabase.from('materials').select('id').eq('name',apProd).single()
      if(mat) await supabase.from('material_stock').insert({material_id:mat.id,location:'ready',quantity:qty})
    }
    const sewer=sewers.find(s=>s.id===apWho)
    if(sewer) await supabase.from('productions').insert({sewer_id:apWho,product:apProd,quantity:qty,date:new Date().toISOString().split('T')[0],earned:qty*sewer.tariff})
    setApFb(`✓ Добавлено: ${PLBL[apProd]} ${qty} шт`);setApQty('');loadAll()
  }

  async function setStatus(id,val){
    await supabase.from('batches').update({status:val}).eq('id',id);loadAll()
  }

  const bc=byColor()
  const totalStock=Object.values(bc).reduce((a,b)=>a+b,0)
  const filtered=batches.filter(b=>{
    if(filter==='active') return b.status!=='Отгружено'
    if(filter==='shipped') return b.status==='Отгружено'
    return true
  })

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Партии <span>/ К отгрузке</span></h1>
      </div>

      <div className="metrics">
        <div className="metric-card dark">
          <div className="metric-label">Всего партий</div>
          <div className="metric-value">{batches.length}</div>
          <div className="metric-sub">с начала работы</div>
        </div>
        <div className="metric-card wine">
          <div className="metric-label">К отгрузке</div>
          <div className="metric-value" style={{color:'#6A1030'}}>{batches.filter(b=>b.filled>=b.size&&b.status!=='Отгружено').length}</div>
          <div className="metric-sub">готовы к отправке</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Отгружено</div>
          <div className="metric-value" style={{color:'#1A6B28'}}>{batches.filter(b=>b.status==='Отгружено').length}</div>
          <div className="metric-sub">партий всего</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Склад готовых</div>
          <div className="metric-value">{fmt(totalStock)}</div>
          <div className="metric-sub">штук</div>
        </div>
      </div>

      <div className="tabs">
        {[{id:'batches',l:'Партии'},{id:'stock',l:'Склад готовых'},{id:'new',l:'Новая партия'},{id:'add',l:'Принять изделия'}].map(t=>(
          <button key={t.id} className={`tab-btn${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {activeTab==='batches'&&(
        <div>
          <div style={{display:'flex',gap:6,marginBottom:12}}>
            {[['all','Все'],['active','Активные'],['shipped','Отгружённые']].map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{fontSize:11,padding:'4px 12px',borderRadius:16,border:`1px solid ${filter===k?'#1C2E26':'rgba(74,111,82,0.2)'}`,background:filter===k?'#1C2E26':'transparent',color:filter===k?'#C4A882':'#4A3A2A',cursor:'pointer',fontWeight:700}}>{l}</button>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№ · Состав</th>
                  <th style={{textAlign:'right'}}>Размер</th>
                  <th style={{textAlign:'right'}}>Собрано</th>
                  <th style={{textAlign:'right'}}>Мат-лы</th>
                  <th style={{textAlign:'right'}}>Работа</th>
                  <th style={{textAlign:'right'}}>₽/шт</th>
                  <th style={{textAlign:'center'}}>Сигнал</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].reverse().map(b=>{
                  const items=getItems(b.id)
                  const isShipped=b.status==='Отгружено'
                  const unit=b.filled>0?Math.round((b.mat_cost+b.labor_cost)/b.filled):0
                  const readyToShip=b.filled>=b.size&&!isShipped
                  return (
                    <tr key={b.id} style={{background:isShipped?'#F5F5F0':'#fff',opacity:isShipped?0.75:1}}>
                      <td>
                        <div style={{fontWeight:800,fontSize:12,color:'#1C2E26',marginBottom:3}}>Партия №{b.batch_num}</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                          {items.map((it,i)=>(
                            <span key={i} style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:11,color:'#3A2A1A',fontWeight:600}}>
                              <span style={{width:7,height:7,borderRadius:'50%',background:PCOL[it.product]||'#888'}}></span>
                              {PLBL[it.product]} {fmt(it.quantity)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{textAlign:'right',fontWeight:700}}>{fmt(b.size)}</td>
                      <td style={{textAlign:'right',fontWeight:800,color:b.filled>=b.size?'#1A6B28':'#6A4A10'}}>{fmt(b.filled)}</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{fmt(b.mat_cost)} ₽</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{fmt(b.labor_cost)} ₽</td>
                      <td style={{textAlign:'right',fontWeight:800}}>{fmt(unit)} ₽</td>
                      <td style={{textAlign:'center'}}>
                        <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:700,
                          background:readyToShip?'#D8EED8':isShipped?'#E8E4DC':'#EEE4C8',
                          color:readyToShip?'#1A4A28':isShipped?'#3A3028':'#6A4A10'}}>
                          {readyToShip?'Отгрузите':isShipped?'Отгружено':'Собирается'}
                        </span>
                      </td>
                      <td>
                        <select value={b.status} onChange={e=>setStatus(b.id,e.target.value)}
                          style={{fontSize:11,padding:'4px 8px',borderRadius:6,border:'1px solid rgba(74,111,82,0.25)',background:'#fff',cursor:'pointer',fontWeight:600,color:'#1C2E26',minWidth:130}}>
                          <option value="">—</option>
                          <option value="Собирается">Собирается</option>
                          <option value="Готово к отгрузке">Готово к отгрузке</option>
                          <option value="Отгружено">Отгружено</option>
                        </select>
                      </td>
                      <td>
                        <button onClick={()=>setPopup({batch:b,items:getItems(b.id)})}
                          style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid rgba(74,111,82,0.2)',background:'transparent',cursor:'pointer',fontWeight:700,color:'#1C2E26'}}>
                          Детали
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:32,color:'#7A6A5A'}}>Нет партий</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==='stock'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
          {['Кокошник Красный','Кокошник Белый','Кокошник Черный','Кокошник Цветной'].map(prod=>(
            <div key={prod} style={{background:'#fff',border:'0.5px solid rgba(74,111,82,0.15)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{width:12,height:12,borderRadius:'50%',background:PCOL[prod]}}></span>
                <span style={{fontWeight:700,fontSize:14,color:'#1C2E26'}}>{PLBL[prod]}</span>
              </div>
              <div style={{fontSize:32,fontWeight:800,color:bc[prod]>0?'#1C2E26':'#C8BFB0'}}>{fmt(bc[prod]||0)}</div>
              <div style={{fontSize:11,color:'#7A6A5A',fontWeight:600,marginTop:3}}>кокошников</div>
            </div>
          ))}
        </div>
      )}

      {activeTab==='new'&&(
        <div style={{maxWidth:480}}>
          <div className="card">
            <div className="card-title">Сформировать партию по FIFO</div>
            <div className="info-box mb-12">Система возьмёт изделия со склада готовых в порядке поступления.</div>
            <div className="form-group" style={{marginBottom:12}}>
              <label className="form-label">Размер партии (штук)</label>
              <input type="number" value={nbSize} onChange={e=>setNbSize(parseInt(e.target.value))}/>
            </div>
            <button onClick={async()=>{
              const bc2=byColor()
              const total=Object.values(bc2).reduce((a,b)=>a+b,0)
              if(total===0){setNbFb('Склад готовых пуст');return}
              const toTake=Math.min(nbSize,total)
              const details=[]
              let filled=0
              for(const prod of ['Кокошник Красный','Кокошник Белый','Кокошник Черный','Кокошник Цветной']){
                if(filled>=toTake) break
                const have=bc2[prod]||0
                if(have===0) continue
                const take=Math.min(toTake-filled,have)
                details.push({product:prod,quantity:take})
                filled+=take
              }
              const {data:nb}=await supabase.from('batches').insert({batch_num:batches.length+1,size:nbSize,filled,status:'',mat_cost:filled*58,labor_cost:filled*110}).select().single()
              if(nb){
                for(const d of details){
                  await supabase.from('batch_items').insert({batch_id:nb.id,product:d.product,quantity:d.quantity})
                  const si=stock.find(s=>s.materials?.name===d.product&&s.location==='ready')
                  if(si) await supabase.from('material_stock').update({quantity:Math.max(0,si.quantity-d.quantity)}).eq('id',si.id)
                }
              }
              setNbFb(`✓ Партия №${batches.length+1} создана: ${filled} шт`);loadAll()
            }} className="btn btn-primary">Сформировать по FIFO</button>
            {nbFb&&<div className="mt-8 text-green text-sm" style={{fontWeight:700}}>{nbFb}</div>}
          </div>
        </div>
      )}

      {activeTab==='add'&&(
        <div style={{maxWidth:480}}>
          <div className="card">
            <div className="card-title">Принять изделия на склад готовых</div>
            <div className="form-grid fg3" style={{marginBottom:12}}>
              <div className="form-group">
                <label className="form-label">Изделие</label>
                <select value={apProd} onChange={e=>setApProd(e.target.value)}>
                  {['Кокошник Красный','Кокошник Белый','Кокошник Черный','Кокошник Цветной'].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Количество</label>
                <input type="number" value={apQty} onChange={e=>setApQty(e.target.value)} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Швея</label>
                <select value={apWho} onChange={e=>setApWho(e.target.value)}>
                  {sewers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addToStock} className="btn btn-primary">Добавить на склад</button>
            {apFb&&<div className="mt-8 text-green text-sm" style={{fontWeight:700}}>{apFb}</div>}
          </div>
        </div>
      )}

      {popup&&(
        <div className="popup-overlay" onClick={()=>setPopup(null)}>
          <div className="popup" onClick={e=>e.stopPropagation()}>
            <div className="popup-header">
              <span className="popup-title">Партия №{popup.batch.batch_num}</span>
              <button className="popup-close" onClick={()=>setPopup(null)}>×</button>
            </div>
            <div className="popup-body">
              <div style={{fontSize:12,color:'#7A6A5A',fontWeight:600,marginBottom:12}}>{popup.batch.filled} шт из {popup.batch.size}</div>
              {popup.items.map((it,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)',fontSize:13}}>
                  <span style={{display:'flex',alignItems:'center',gap:6,fontWeight:700}}>
                    <span style={{width:9,height:9,borderRadius:'50%',background:PCOL[it.product]}}></span>
                    {PLBL[it.product]}
                  </span>
                  <span style={{fontWeight:700}}>{fmt(it.quantity)} шт</span>
                  <span style={{color:'#1A6B28',fontWeight:800}}>{fmt(it.quantity*110)} ₽</span>
                </div>
              ))}
              <div style={{marginTop:12,paddingTop:8,borderTop:'1px solid rgba(196,168,130,0.2)'}}>
                {[
                  {l:'Материалы',v:fmt(popup.batch.mat_cost)+' ₽'},
                  {l:'Работа',v:fmt(popup.batch.labor_cost)+' ₽'},
                ].map((r,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0',color:'#3A2A1A',fontWeight:600}}>
                    <span style={{color:'#7A6A5A'}}>{r.l}</span><span>{r.v}</span>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:800,borderTop:'1px solid rgba(196,168,130,0.2)',paddingTop:8,marginTop:4,color:'#1C2E26'}}>
                  <span>Итого себестоимость</span>
                  <span>{fmt(popup.batch.mat_cost+popup.batch.labor_cost)} ₽</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#7A6A5A',fontWeight:600,marginTop:4}}>
                  <span>Стоимость единицы</span>
                  <span>{fmt(popup.batch.filled>0?(popup.batch.mat_cost+popup.batch.labor_cost)/popup.batch.filled:0)} ₽/шт</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}