import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60'}
const PLBL = {'Кокошник Красный':'Красный','Кокошник Белый':'Белый','Кокошник Черный':'Чёрный','Кокошник Цветной':'Цветной'}
const PRODUCTS = Object.keys(PCOL)
const fmt = x => Math.round(x).toLocaleString('ru-RU')
const DAILY = {'Кокошник Красный':515/14,'Кокошник Белый':63/14,'Кокошник Черный':164/14,'Кокошник Цветной':19/14}
const IL=1.40,IRP=0.0207,VOL=0.8,PRICE=850

const WHS = [
  {id:'ekb',name:'Екатеринбург',fo:'Уральский',tariff:190,sdek:934},
  {id:'vlad',name:'Владимир',fo:'Центральный',tariff:130,sdek:1354},
  {id:'voronezh',name:'Воронеж',fo:'Центральный',tariff:130,sdek:1460},
  {id:'kotovsk',name:'Котовск',fo:'Центральный',tariff:120,sdek:1565},
  {id:'novosem',name:'Новосемейкино',fo:'Приволжский',tariff:160,sdek:1249},
]

function logCost(wh){return Math.round(VOL*30*(wh.tariff/100)*IL+PRICE*IRP)}

export default function Wildberries(){
  const [wbStocks,setWbStocks]=useState([])
  const [shipments,setShipments]=useState([])
  const [loading,setLoading]=useState(true)
  const [activeTab,setActiveTab]=useState('signals')
  const [shDate,setShDate]=useState(new Date().toISOString().split('T')[0])
  const [shType,setShType]=useState('Кокошник Красный')
  const [shQty,setShQty]=useState('')
  const [shWh,setShWh]=useState('ekb')
  const [shTk,setShTk]=useState('СДЭК')
  const [shNakl,setShNakl]=useState('')
  const [shArrival,setShArrival]=useState('')
  const [shWbNum,setShWbNum]=useState('')
  const [shShk,setShShk]=useState('')
  const [shShkp,setShShkp]=useState('')
  const [shFb,setShFb]=useState('')
  const [upWh,setUpWh]=useState('ekb')
  const [upProd,setUpProd]=useState('Кокошник Красный')
  const [upQty,setUpQty]=useState('')
  const [upFb,setUpFb]=useState('')
  const [goalProfit,setGoalProfit]=useState(400000)
  const [goalBuyout,setGoalBuyout]=useState(47)

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    const [{data:wb},{data:sh}]=await Promise.all([
      supabase.from('wb_stocks').select('*'),
      supabase.from('shipments').select('*').order('ship_date',{ascending:false}),
    ])
    setWbStocks(wb||[]);setShipments(sh||[]);setLoading(false)
  }

  function getStock(whId,prod){return wbStocks.find(s=>s.warehouse===whId&&s.product===prod)?.quantity||0}
  function daysLeft(whId,prod){const qty=getStock(whId,prod);const spd=DAILY[prod]||1;return Math.floor(qty/spd)}

  async function updateStock(){
    if(!upQty) return
    const qty=parseInt(upQty)
    const existing=wbStocks.find(s=>s.warehouse===upWh&&s.product===upProd)
    if(existing) await supabase.from('wb_stocks').update({quantity:qty,updated_at:new Date().toISOString()}).eq('id',existing.id)
    else await supabase.from('wb_stocks').insert({warehouse:upWh,product:upProd,quantity:qty})
    setUpFb(`✓ Обновлено: ${WHS.find(w=>w.id===upWh)?.name} / ${PLBL[upProd]} = ${qty} шт`)
    setUpQty('');loadAll()
  }

  async function addShipment(){
    if(!shQty||!shDate){setShFb('Заполните дату и количество');return}
    const wh=WHS.find(w=>w.id===shWh)
    await supabase.from('shipments').insert({
      ship_date:shDate,product:shType,quantity:parseInt(shQty),
      warehouse:wh?.name||shWh,tk:shTk,invoice_num:shNakl,
      wb_supply_num:shWbNum,shk_box:shShk,shk_supply:shShkp,
      arrival_date:shArrival||null,status:'В пути'
    })
    setShFb(`✓ Отгрузка: ${PLBL[shType]} → ${wh?.name} ${shQty} шт`)
    setShQty('');setShNakl('');setShWbNum('');setShShk('');setShShkp('')
    loadAll()
  }

  async function setShipStatus(id,val){
    await supabase.from('shipments').update({status:val}).eq('id',id);loadAll()
  }

  const foGroups={}
  WHS.forEach(wh=>{if(!foGroups[wh.fo])foGroups[wh.fo]=[];foGroups[wh.fo].push(wh)})

  let defCount=0
  WHS.forEach(wh=>PRODUCTS.forEach(prod=>{if(DAILY[prod]>0.5&&daysLeft(wh.id,prod)<=3)defCount++}))

  const avgProfit=88
  const needSold=Math.ceil(goalProfit/avgProfit)
  const needOrders=Math.ceil(needSold/(goalBuyout/100))
  const needProd=Math.ceil(needSold*1.05)

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  const Row=({label,value,color})=>(
    <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)'}}>
      <span style={{fontSize:12,fontWeight:600,color:'#3A2A1A'}}>{label}</span>
      <span style={{fontSize:13,fontWeight:800,color:color||'#1C2E26',whiteSpace:'nowrap'}}>{value}</span>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Wildberries <span>/ Склады</span></h1>
        <span style={{fontSize:10,padding:'3px 10px',borderRadius:20,background:'#EEE4C8',color:'#6A4A10',fontWeight:700,border:'1px solid rgba(106,74,16,0.2)'}}>API не подключён</span>
      </div>

      <div className="metrics">
        <div className="metric-card dark">
          <div className="metric-label">Заказов в день (апр)</div>
          <div className="metric-value">54</div>
          <div className="metric-sub">средний темп</div>
        </div>
        <div className="metric-card wine">
          <div className="metric-label">Складов с дефицитом</div>
          <div className="metric-value" style={{color:defCount>0?'#6A1030':'#1A6B28'}}>{defCount}</div>
          <div className="metric-sub">нужна отгрузка</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Индекс локализации</div>
          <div className="metric-value" style={{color:'#6A1030'}}>1.40</div>
          <div className="metric-sub">наценка ~40%</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Процент выкупа</div>
          <div className="metric-value">47%</div>
          <div className="metric-sub">из статистики WB</div>
        </div>
      </div>

      <div className="tabs">
        {[{id:'signals',l:'Сигналы'},{id:'shipments',l:'Отгрузки'},{id:'sales',l:'Продажи'},{id:'goal',l:'Цель'},{id:'update',l:'Обновить'}].map(t=>(
          <button key={t.id} className={`tab-btn${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {activeTab==='signals'&&(
        <div>
          {Object.entries(foGroups).map(([fo,whs])=>(
            <div key={fo} style={{marginBottom:20}}>
              <div style={{fontSize:10,color:'#5A4A3A',textTransform:'uppercase',letterSpacing:1,marginBottom:10,fontWeight:800}}>{fo} ФО</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {whs.map(wh=>{
                  let hasCrit=false,hasWarn=false
                  PRODUCTS.forEach(prod=>{
                    const d=daysLeft(wh.id,prod),spd=DAILY[prod]||0
                    if(spd>0.5&&d<=3) hasCrit=true
                    else if(spd>0.5&&d<=7) hasWarn=true
                  })
                  const lc=Math.round(logCost(wh))
                  const borderColor=hasCrit?'#6A1030':hasWarn?'#6A4A10':'rgba(74,111,82,0.2)'
                  const tariffBg=wh.tariff<=130?'#D8EED8':wh.tariff<=160?'#EEE4C8':'#EED4DD'
                  const tariffColor=wh.tariff<=130?'#1A4A28':wh.tariff<=160?'#6A4A10':'#6A1030'
                  return (
                    <div key={wh.id} style={{background:'#fff',border:`1px solid ${borderColor}`,borderRadius:12,overflow:'hidden'}}>
                      <div style={{background:'#1C2E26',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:13,color:'#F2EBE0'}}>{hasCrit?'⚠ ':''}{wh.name}</div>
                          <div style={{fontSize:10,color:'rgba(196,168,130,0.7)',marginTop:1}}>{wh.fo}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:tariffBg,color:tariffColor,fontWeight:700}}>тариф {wh.tariff}%</span>
                          <div style={{fontSize:10,color:'rgba(196,168,130,0.7)',marginTop:2}}>лог. ~{lc} ₽/шт</div>
                        </div>
                      </div>
                      <div style={{padding:'8px 14px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 50px 60px 80px',gap:4,fontSize:10,color:'#7A6A5A',fontWeight:700,paddingBottom:5,borderBottom:'1px solid rgba(196,168,130,0.15)',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>
                          <span>Цвет</span><span style={{textAlign:'right'}}>Остаток</span><span style={{textAlign:'right'}}>шт/день</span><span style={{textAlign:'right'}}>Статус</span>
                        </div>
                        {PRODUCTS.map(prod=>{
                          const spd=DAILY[prod]||0
                          if(spd<0.3) return null
                          const qty=getStock(wh.id,prod)
                          const d=daysLeft(wh.id,prod)
                          const recQty=Math.max(0,Math.ceil(spd*14-qty))
                          let statusEl
                          if(qty===0||d<=3){
                            statusEl=<span style={{fontSize:10,padding:'1px 6px',borderRadius:5,background:'#EED4DD',color:'#6A1030',fontWeight:800,whiteSpace:'nowrap'}}>{qty===0?'нет':`${d}дн +${fmt(recQty)}`}</span>
                          }else if(d<=7){
                            statusEl=<span style={{fontSize:10,padding:'1px 6px',borderRadius:5,background:'#EEE4C8',color:'#6A4A10',fontWeight:800,whiteSpace:'nowrap'}}>{d}дн +{fmt(recQty)}</span>
                          }else{
                            statusEl=<span style={{fontSize:11,color:'#1A6B28',fontWeight:800}}>{d}дн</span>
                          }
                          return (
                            <div key={prod} style={{display:'grid',gridTemplateColumns:'1fr 50px 60px 80px',gap:4,padding:'4px 0',borderBottom:'0.5px solid rgba(74,111,82,0.06)',fontSize:12,alignItems:'center'}}>
                              <span style={{display:'flex',alignItems:'center',gap:5}}>
                                <span style={{width:8,height:8,borderRadius:'50%',background:PCOL[prod],flexShrink:0}}></span>
                                <span style={{fontWeight:700,color:'#1C2E26'}}>{PLBL[prod]}</span>
                              </span>
                              <span style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:800}}>{fmt(qty)}</span>
                              <span style={{textAlign:'right',color:'#7A6A5A',fontWeight:600,fontSize:11}}>{spd.toFixed(1)}</span>
                              <span style={{textAlign:'right'}}>{statusEl}</span>
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

      {activeTab==='shipments'&&(
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">Добавить отгрузку на WB</div>
            <div className="form-grid fg4" style={{marginBottom:10}}>
              <div className="form-group"><label className="form-label">Дата сдачи</label><input type="date" value={shDate} onChange={e=>setShDate(e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Тип (цвет)</label>
                <select value={shType} onChange={e=>setShType(e.target.value)}>
                  {PRODUCTS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Количество</label><input type="number" value={shQty} onChange={e=>setShQty(e.target.value)} placeholder="0"/></div>
              <div className="form-group"><label className="form-label">Склад WB</label>
                <select value={shWh} onChange={e=>setShWh(e.target.value)}>
                  {WHS.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid fg3" style={{marginBottom:10}}>
              <div className="form-group"><label className="form-label">ТК</label><input type="text" value={shTk} onChange={e=>setShTk(e.target.value)}/></div>
              <div className="form-group"><label className="form-label">№ Накладной</label><input type="text" value={shNakl} onChange={e=>setShNakl(e.target.value)} placeholder="10..."/></div>
              <div className="form-group"><label className="form-label">Дата прихода на WB</label><input type="date" value={shArrival} onChange={e=>setShArrival(e.target.value)}/></div>
            </div>
            <div className="form-grid fg3" style={{marginBottom:12}}>
              <div className="form-group"><label className="form-label">№ Поставки WB</label><input type="text" value={shWbNum} onChange={e=>setShWbNum(e.target.value)} placeholder="WB_1..."/></div>
              <div className="form-group"><label className="form-label">ШК Короба</label><input type="text" value={shShk} onChange={e=>setShShk(e.target.value)} placeholder="WB_14..."/></div>
              <div className="form-group"><label className="form-label">ШК Поставки</label><input type="text" value={shShkp} onChange={e=>setShShkp(e.target.value)} placeholder="WB-GI-..."/></div>
            </div>
            <button onClick={addShipment} className="btn btn-primary">Добавить отгрузку</button>
            {shFb&&<div className="mt-8 text-green text-sm" style={{fontWeight:700}}>{shFb}</div>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th><th>Тип</th><th style={{textAlign:'right'}}>Кол-во</th>
                  <th>Направление</th><th>ТК</th><th>№ Накладной</th>
                  <th>№ Поставки WB</th><th>ШК Короба</th><th>Приход WB</th><th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(s=>{
                  const isPlan=s.arrival_date&&new Date(s.arrival_date)<new Date()&&s.status==='В пути'
                  return (
                    <tr key={s.id}>
                      <td className="text-muted">{s.ship_date?new Date(s.ship_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'}</td>
                      <td><span style={{display:'inline-flex',alignItems:'center',gap:5,fontWeight:700}}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:PCOL[s.product]||'#888'}}></span>
                        {PLBL[s.product]||s.product}
                      </span></td>
                      <td style={{textAlign:'right',fontWeight:800}}>{fmt(s.quantity)}</td>
                      <td style={{fontWeight:600}}>{s.warehouse}</td>
                      <td className="text-muted">{s.tk}</td>
                      <td className="text-muted" style={{fontSize:11}}>{s.invoice_num||'—'}</td>
                      <td className="text-muted" style={{fontSize:11}}>{s.wb_supply_num||'—'}</td>
                      <td className="text-muted" style={{fontSize:11}}>{s.shk_box||'—'}</td>
                      <td style={{color:isPlan?'#6A1030':'#3A2A1A',fontWeight:isPlan?700:500,fontSize:11}}>
                        {s.arrival_date?new Date(s.arrival_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'}
                        {isPlan&&' ⚠'}
                      </td>
                      <td>
                        <select value={s.status} onChange={e=>setShipStatus(s.id,e.target.value)}
                          style={{fontSize:11,padding:'3px 6px',borderRadius:6,border:'1px solid rgba(74,111,82,0.25)',background:'#fff',cursor:'pointer',fontWeight:700,color:'#1C2E26'}}>
                          <option value="В пути">В пути</option>
                          <option value="Доставлено">Доставлено</option>
                          <option value="Принято WB">Принято WB</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {shipments.length===0&&<tr><td colSpan={10} style={{textAlign:'center',padding:32,color:'#7A6A5A'}}>Нет отгрузок</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==='sales'&&(
        <div>
          <div className="metrics">
            {[
              {l:'Март 2026 (заказы)',v:'1 893',sub:'лучший месяц'},
              {l:'Апрель (14 дн)',v:'761',sub:'темп ~1 628/мес'},
              {l:'Лидер',v:'Красный',sub:'78% всех заказов'},
              {l:'В день (апрель)',v:'54',sub:'заказов среднее'},
            ].map((m,i)=>(
              <div key={i} className="metric-card dark">
                <div className="metric-label">{m.l}</div>
                <div className="metric-value" style={{fontSize:20}}>{m.v}</div>
                <div className="metric-sub">{m.sub}</div>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th style={{textAlign:'right'}}>Красный</th><th style={{textAlign:'right'}}>Чёрный</th>
                  <th style={{textAlign:'right'}}>Белый</th><th style={{textAlign:'right'}}>Цветной</th>
                  <th style={{textAlign:'right'}}>Итого (заказы)</th><th style={{textAlign:'right'}}>В день</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {m:'Апрель 2026*',r:515,b:164,w:63,c:19,days:14},
                  {m:'Март 2026',r:1477,b:336,w:6,c:74,days:31},
                  {m:'Февраль 2026',r:462,b:20,w:0,c:34,days:28},
                  {m:'Январь 2026',r:255,b:4,w:0,c:93,days:31},
                ].map(row=>{
                  const tot=row.r+row.b+row.w+row.c
                  return (
                    <tr key={row.m}>
                      <td style={{fontWeight:700}}>{row.m}</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{fmt(row.r)}</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{fmt(row.b)}</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{fmt(row.w)}</td>
                      <td style={{textAlign:'right',fontWeight:600}}>{fmt(row.c)}</td>
                      <td style={{textAlign:'right',fontWeight:800}}>{fmt(tot)}</td>
                      <td style={{textAlign:'right',color:'#7A6A5A',fontWeight:600}}>{(tot/row.days).toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="info-box mt-8">* Все цифры — заказы (не выкупы). Выкупы ≈ заказы × 47%</div>
        </div>
      )}

      {activeTab==='goal'&&(
        <div style={{maxWidth:500}}>
          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">Хочу заработать чистыми</div>
            <div className="form-grid fg2" style={{marginBottom:14}}>
              <div className="form-group"><label className="form-label">Желаемая прибыль, ₽</label><input type="number" value={goalProfit} onChange={e=>setGoalProfit(parseInt(e.target.value))} step="10000"/></div>
              <div className="form-group"><label className="form-label">Процент выкупа, %</label><input type="number" value={goalBuyout} onChange={e=>setGoalBuyout(parseInt(e.target.value))} min="1" max="100"/></div>
            </div>
          </div>
          <div className="card">
            {[
              {l:'Нужно заказов на WB',v:fmt(needOrders)+' шт',c:'#1A6B28'},
              {l:'▸ Красных (~78%)',v:fmt(Math.ceil(needOrders*0.78))+' шт'},
              {l:'▸ Чёрных (~9%)',v:fmt(Math.ceil(needOrders*0.09))+' шт'},
              {l:'▸ Белых (~8%)',v:fmt(Math.ceil(needOrders*0.08))+' шт'},
              {l:'▸ Цветных (~5%)',v:fmt(Math.ceil(needOrders*0.05))+' шт'},
              {l:`Нужно выкупов (${goalBuyout}%)`,v:fmt(needSold)+' шт',c:'#1A6B28'},
              {l:'Нужно произвести',v:fmt(needProd)+' шт'},
              {l:'Зарплата швеям (≈)',v:fmt(needProd*110)+' ₽'},
              {l:'Себест. материалов (≈)',v:fmt(needProd*58)+' ₽'},
              {l:'Средняя ЧП/шт',v:fmt(avgProfit)+' ₽'},
            ].map((r,i)=><Row key={i} label={r.l} value={r.v} color={r.c}/>)}
          </div>
        </div>
      )}

      {activeTab==='update'&&(
        <div style={{maxWidth:480}}>
          <div className="card">
            <div className="card-title">Обновить остатки на складах WB</div>
            <div className="info-box mb-12">Пока API не подключён — вводите вручную. После подключения обновляется автоматически.</div>
            <div className="form-grid fg3" style={{marginBottom:12}}>
              <div className="form-group"><label className="form-label">Склад WB</label>
                <select value={upWh} onChange={e=>setUpWh(e.target.value)}>
                  {WHS.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Артикул (цвет)</label>
                <select value={upProd} onChange={e=>setUpProd(e.target.value)}>
                  {PRODUCTS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Остаток (шт)</label><input type="number" value={upQty} onChange={e=>setUpQty(e.target.value)} placeholder="0"/></div>
            </div>
            <button onClick={updateStock} className="btn btn-primary">Обновить остаток</button>
            {upFb&&<div className="mt-8 text-green text-sm" style={{fontWeight:700}}>{upFb}</div>}
          </div>
        </div>
      )}
    </div>
  )
}