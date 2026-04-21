import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')

const MAT_COST = {
  'Кокошник Красный': 0.0476*288.16 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Белый':   0.0476*286.50 + 0.2*17.03 + 2*0.92 + 30 + 1.19 + 10.90,
  'Кокошник Черный':  0.0476*289.77 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Цветной': 0.0555*365.83 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
}
const WB = { revenue:100787, log_sale:15046, log_cancel:7708, vv:5064, shtraf:50, reklama:21607, units_sold:204 }
const WB_STOCKS = { 'Кокошник Красный':299, 'Кокошник Белый':210, 'Кокошник Черный':19, 'Кокошник Цветной':0 }
const BY_SKU = {
  'Кокошник Красный':{sold:156,to_seller_avg:506,log_avg:76,price:850,labor:140},
  'Кокошник Белый':  {sold:6,  to_seller_avg:545,log_avg:77,price:850,labor:140},
  'Кокошник Черный': {sold:41, to_seller_avg:443,log_avg:71,price:850,labor:140},
  'Кокошник Цветной':{sold:1,  to_seller_avg:481,log_avg:47,price:900,labor:105},
}
const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60'}
const mult = 1.43

export default function Finance() {
  const [stocks,setStocks] = useState([])
  const [materials,setMaterials] = useState([])
  const [purchases,setPurchases] = useState([])
  const [loading,setLoading] = useState(true)
  const [activeTab,setActiveTab] = useState('overview')
  const [fcOrders,setFcOrders] = useState(1628)
  const [fcBuyout,setFcBuyout] = useState(47)
  const [fcProd,setFcProd] = useState(1200)

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    const [{data:st},{data:mt},{data:pu}] = await Promise.all([
      supabase.from('material_stock').select('*, materials(name, price_per_unit)'),
      supabase.from('materials').select('*'),
      supabase.from('purchases').select('*, materials(name)'),
    ])
    setStocks(st||[]);setMaterials(mt||[]);setPurchases(pu||[])
    setLoading(false)
  }

  const myMatVal = stocks.filter(s=>s.location==='warehouse').reduce((a,s)=>a+s.quantity*(s.materials?.price_per_unit||0),0)
  const swMatVal = stocks.filter(s=>s.location!=='warehouse'&&s.location!=='ready').reduce((a,s)=>a+s.quantity*(s.materials?.price_per_unit||0),0)
  const transitVal = purchases.filter(p=>p.status==='transit').reduce((a,p)=>a+p.total_sum,0)
  const readyVal = stocks.filter(s=>s.location==='ready').reduce((a,s)=>a+s.quantity*65,0)
  const wbVal = Object.entries(WB_STOCKS).reduce((a,[prod,qty])=>a+qty*(MAT_COST[prod]||65),0)
  const totalFreeze = myMatVal+swMatVal+transitVal+readyVal+wbVal

  const aprRevenue = Math.round(WB.revenue*mult)
  const aprLogSale = Math.round(WB.log_sale*mult)
  const aprLogCancel = Math.round(WB.log_cancel*mult)
  const aprNet = aprRevenue-aprLogSale-aprLogCancel
  const salary = 149520
  const matCostMonth = 1172*58
  const sdek = 8000
  const nalog = Math.round(aprRevenue*0.06)
  const profit = aprNet-salary-matCostMonth-sdek-WB.reklama-WB.vv-WB.shtraf-nalog

  const fcSales = Math.round(fcOrders*fcBuyout/100)
  const fcRevNet = fcSales*430
  const fcMat = fcProd*58
  const fcLabor = fcProd*110
  const fcSdek = Math.ceil(fcProd/100)*800
  const fcRek = Math.round(fcOrders*850*0.05)
  const fcNalog = Math.round(fcRevNet*0.06)
  const fcProfit = fcRevNet-fcMat-fcLabor-fcSdek-fcRek-fcNalog

  const wbTotalQty = Object.values(WB_STOCKS).reduce((a,b)=>a+b,0)
  const potProfit = Math.round(wbTotalQty*0.47*88)

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  const Row = ({label,value,color,tag}) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)'}}>
      <span style={{fontSize:12,color:'#3A2A1A',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
        {label}
        {tag&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:tag==='факт'?'#D8EED8':'#E0EAF8',color:tag==='факт'?'#1A4A28':'#1A3A6A',fontWeight:800}}>{tag}</span>}
      </span>
      <span style={{fontSize:13,fontWeight:800,color:color||'#1C2E26',whiteSpace:'nowrap'}}>{value}</span>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Финансы <span>/ Аналитика</span></h1>
      </div>

      <div className="metrics">
        <div className="metric-card green">
          <div className="metric-label">Выручка WB (апрель)</div>
          <div className="metric-value" style={{color:'#1A6B28'}}>{fmt(aprRevenue)} ₽</div>
          <div className="metric-sub">к перечислению</div>
        </div>
        <div className="metric-card wine">
          <div className="metric-label">Логистика WB</div>
          <div className="metric-value" style={{color:'#6A1030',fontSize:18}}>−{fmt(aprLogSale+aprLogCancel)} ₽</div>
          <div className="metric-sub">продажи + отмены</div>
        </div>
        <div className="metric-card gold">
          <div className="metric-label">Чистая прибыль</div>
          <div className="metric-value" style={{color:profit>0?'#1A6B28':'#6A1030',fontSize:18}}>{profit>0?'+':''}{fmt(profit)} ₽</div>
          <div className="metric-sub">апрель 2026</div>
        </div>
        <div className="metric-card dark">
          <div className="metric-label">Заморожено всего</div>
          <div className="metric-value" style={{fontSize:18}}>{fmt(Math.round(totalFreeze))} ₽</div>
          <div className="metric-sub">мат-лы + товар везде</div>
        </div>
      </div>

      <div className="tabs">
        {[{id:'overview',l:'Обзор'},{id:'freeze',l:'Заморозка'},{id:'unit',l:'Юнит-экономика'},{id:'wb',l:'Выплаты WB'},{id:'forecast',l:'Прогноз'}].map(t=>(
          <button key={t.id} className={`tab-btn${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {activeTab==='overview'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div className="card">
            <div className="card-title">P&L — Апрель 2026</div>
            <Row label="Выручка WB" value={'+'+fmt(aprRevenue)+' ₽'} color="#1A6B28" tag="факт"/>
            <Row label="Логистика при продажах" value={'−'+fmt(aprLogSale)+' ₽'} color="#6A1030" tag="факт"/>
            <Row label="Логистика при отменах" value={'−'+fmt(aprLogCancel)+' ₽'} color="#6A1030" tag="факт"/>
            <Row label="Комиссия WB (ВВ)" value={'−'+fmt(WB.vv)+' ₽'} color="#6A1030" tag="факт"/>
            <Row label="Штрафы WB" value={'−'+fmt(WB.shtraf)+' ₽'} color="#6A1030" tag="факт"/>
            <Row label="Зарплата швеям" value={'−'+fmt(salary)+' ₽'} color="#6A1030" tag="факт"/>
            <Row label="Себестоимость материалов" value={'−'+fmt(matCostMonth)+' ₽'} color="#6A1030" tag="расч."/>
            <Row label="Доставка СДЭК на WB" value={'−'+fmt(sdek)+' ₽'} color="#6A1030" tag="расч."/>
            <Row label="Реклама/ДРР" value={'−'+fmt(WB.reklama)+' ₽'} color="#6A1030" tag="факт"/>
            <Row label="Налог 6% УСН" value={'−'+fmt(nalog)+' ₽'} color="#6A1030" tag="расч."/>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:15,fontWeight:800,borderTop:'2px solid rgba(196,168,130,0.3)',marginTop:4,color:profit>0?'#1A6B28':'#6A1030'}}>
              <span style={{color:'#1C2E26'}}>Чистая прибыль</span>
              <span>{profit>0?'+':''}{fmt(profit)} ₽</span>
            </div>
            <div style={{fontSize:10,color:'#7A6A5A',marginTop:6,fontWeight:600}}>⚠ Отчёт WB: 24.03–12.04 (3 недели). Расчёт оценочный.</div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card">
              <div className="card-title">Структура доходов</div>
              {Object.entries(BY_SKU).map(([prod,d])=>{
                const share=Math.round(d.sold/WB.units_sold*100)
                return (
                  <div key={prod} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)'}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:PCOL[prod],flexShrink:0}}></span>
                    <span style={{fontSize:12,fontWeight:700,flex:1,color:'#1C2E26'}}>{prod.replace('Кокошник ','')}</span>
                    <span style={{fontSize:12,fontWeight:600,color:'#7A6A5A'}}>{d.sold} шт</span>
                    <div style={{width:80,height:6,background:'#F0EBE1',borderRadius:3,overflow:'hidden'}}>
                      <div style={{width:share+'%',height:'100%',background:PCOL[prod],borderRadius:3}}></div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:'#3A2A1A',minWidth:30}}>{share}%</span>
                  </div>
                )
              })}
            </div>
            <div className="card">
              <div className="card-title">Ключевые показатели (март 2026)</div>
              <Row label="Продажи (выкупы)" value="551 шт / 314 821 ₽"/>
              <Row label="Процент выкупа" value="54.66%"/>
              <Row label="Логистика" value="66 595 ₽" color="#6A1030"/>
              <Row label="Чистая прибыль" value="55 882 ₽" color="#1A6B28"/>
              <Row label="Прибыль на 1 шт" value="101 ₽" color="#1A6B28"/>
              <Row label="Ср. стоимость логистики/шт" value="121 ₽"/>
            </div>
          </div>
        </div>
      )}

      {activeTab==='freeze'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div className="card">
            <div className="card-title">Где заморожены деньги</div>
            {[
              {l:'Материалы на моём складе',v:fmt(Math.round(myMatVal))+' ₽',sub:'по закупочным ценам'},
              {l:'Материалы у швей',v:fmt(Math.round(swMatVal))+' ₽',sub:'по закупочным ценам'},
              {l:'Материалы в пути',v:fmt(Math.round(transitVal))+' ₽',sub:'заказы в пути'},
              {l:'Готовые изделия (склад)',v:fmt(Math.round(readyVal))+' ₽',sub:'по себестоимости'},
              {l:'Товар на складах WB',v:fmt(Math.round(wbVal))+' ₽',sub:'по себестоимости произв.'},
            ].map((r,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#1C2E26'}}>{r.l}</div>
                  <div style={{fontSize:10,color:'#7A6A5A',fontWeight:600}}>{r.sub}</div>
                </div>
                <span style={{fontSize:14,fontWeight:800,color:'#1C2E26',whiteSpace:'nowrap',marginLeft:12}}>{r.v}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:15,fontWeight:800,borderTop:'2px solid rgba(196,168,130,0.3)',marginTop:4}}>
              <span>ИТОГО заморожено</span>
              <span style={{color:'#1A6B28'}}>{fmt(Math.round(totalFreeze))} ₽</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Потенциальная прибыль с WB</div>
            {Object.entries(WB_STOCKS).filter(([,qty])=>qty>0).map(([prod,qty])=>(
              <div key={prod} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)'}}>
                <span style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700,color:'#1C2E26'}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:PCOL[prod]}}></span>
                  {prod.replace('Кокошник ','')}: {fmt(qty)} шт
                </span>
                <span style={{fontSize:13,fontWeight:800,color:'#1A6B28'}}>~{fmt(Math.round(qty*0.47*88))} ₽</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:14,fontWeight:800,borderTop:'2px solid rgba(196,168,130,0.3)',marginTop:4}}>
              <span style={{color:'#1C2E26'}}>Итого потенциальная ЧП</span>
              <span style={{color:'#1A6B28'}}>~{fmt(potProfit)} ₽</span>
            </div>
            <div style={{fontSize:10,color:'#7A6A5A',marginTop:6,fontWeight:600}}>При выкупе 47% · ср. ЧП 88 ₽/шт · выплата через 4 недели</div>
          </div>
        </div>
      )}

      {activeTab==='unit'&&(
        <div>
          <div className="info-box mb-12">
            <span style={{background:'#D8EED8',color:'#1A4A28',borderRadius:4,fontSize:9,padding:'1px 5px',fontWeight:800,marginRight:6}}>факт</span>
            из отчёта WB (24.03–12.04)&nbsp;&nbsp;
            <span style={{background:'#E0EAF8',color:'#1A3A6A',borderRadius:4,fontSize:9,padding:'1px 5px',fontWeight:800,marginRight:6}}>расч.</span>
            по нормативам
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {Object.entries(BY_SKU).map(([prod,d])=>{
              const matCost=MAT_COST[prod]||60
              const cancelLog=Math.round(WB.log_cancel/WB.units_sold)
              const netWb=d.to_seller_avg-d.log_avg-cancelLog
              const taxPerUnit=Math.round(d.to_seller_avg*0.06)
              const unitProfit=netWb-matCost-d.labor-6-taxPerUnit
              const margin=(unitProfit/d.to_seller_avg*100).toFixed(1)
              return (
                <div key={prod} style={{background:'#fff',border:'0.5px solid rgba(74,111,82,0.15)',borderRadius:12,overflow:'hidden'}}>
                  <div style={{background:'#1C2E26',padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:PCOL[prod]}}></span>
                    <span style={{fontWeight:800,fontSize:14,color:'#F2EBE0'}}>{prod.replace('Кокошник ','')}</span>
                    <span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:unitProfit>0?'#5DCAA5':'#E24B4A'}}>{unitProfit>0?'+':''}{Math.round(unitProfit)} ₽</span>
                  </div>
                  <div style={{padding:'10px 14px'}}>
                    {[
                      {l:'Цена на WB',v:fmt(d.price)+' ₽',tag:null},
                      {l:'WB к перечислению/шт',v:fmt(d.to_seller_avg)+' ₽',tag:'факт',c:'#1A6B28'},
                      {l:'Логистика к покупателю',v:'−'+fmt(d.log_avg)+' ₽',tag:'факт',c:'#6A1030'},
                      {l:'Логистика при отменах',v:'−'+fmt(cancelLog)+' ₽',tag:'расч.',c:'#6A1030'},
                      {l:'Материалы + упаковка',v:'−'+fmt(Math.round(matCost))+' ₽',tag:'расч.',c:'#6A1030'},
                      {l:'СДЭК до WB/шт',v:'−6 ₽',tag:'расч.',c:'#6A1030'},
                      {l:'Зарплата швеи',v:'−'+fmt(d.labor)+' ₽',tag:'расч.',c:'#6A1030'},
                      {l:'Налог 6%',v:'−'+fmt(taxPerUnit)+' ₽',tag:'расч.',c:'#6A1030'},
                    ].map((r,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,padding:'3px 0',borderBottom:'0.5px solid rgba(74,111,82,0.06)'}}>
                        <span style={{color:'#3A2A1A',fontWeight:600,display:'flex',alignItems:'center',gap:4}}>
                          {r.l}
                          {r.tag&&<span style={{fontSize:8,padding:'1px 4px',borderRadius:3,background:r.tag==='факт'?'#D8EED8':'#E0EAF8',color:r.tag==='факт'?'#1A4A28':'#1A3A6A',fontWeight:800}}>{r.tag}</span>}
                        </span>
                        <span style={{fontWeight:800,color:r.c||'#1C2E26',whiteSpace:'nowrap'}}>{r.v}</span>
                      </div>
                    ))}
                    <div style={{marginTop:8,paddingTop:6,borderTop:'1px solid rgba(196,168,130,0.2)',display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:800,color:unitProfit>0?'#1A6B28':'#6A1030'}}>
                      <span>{Math.round(unitProfit)} ₽/шт</span>
                      <span>{margin}% маржа</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab==='wb'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div className="card">
            <div className="card-title">Прогноз поступлений — 3 месяца</div>
            <div style={{fontSize:11,color:'#7A6A5A',fontWeight:600,marginBottom:12}}>Темп апреля: ~54 заказа/день · 47% выкуп</div>
            {[
              {period:'За реализацию март (остаток)',payout:'Апрель–май 2026',amount:Math.round(WB.revenue*0.6)},
              {period:'За реализацию апрель',payout:'Май–июнь 2026',amount:Math.round(761*0.47*430)},
              {period:'За реализацию май (прогноз)',payout:'Июнь–июль 2026',amount:Math.round(1628*0.47*430)},
              {period:'За реализацию июнь (прогноз)',payout:'Июль–август 2026',amount:Math.round(1800*0.47*430)},
            ].map((r,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'0.5px solid rgba(74,111,82,0.08)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#4A9E5C',flexShrink:0}}></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1C2E26'}}>{r.payout}</div>
                  <div style={{fontSize:10,color:'#7A6A5A',fontWeight:600}}>{r.period}</div>
                </div>
                <div style={{fontSize:15,fontWeight:800,color:'#1A6B28',whiteSpace:'nowrap'}}>~{fmt(r.amount)} ₽</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Структура выплаты WB (Красный, факт)</div>
            {[
              {l:'Розничная цена',v:'808 ₽'},
              {l:'WB реализовал (с платф. скидкой)',v:'556 ₽'},
              {l:'К перечислению продавцу',v:'506 ₽',c:'#1A6B28'},
              {l:'Логистика к покупателю',v:'−76 ₽',c:'#6A1030'},
              {l:'Логистика при отменах (проп.)',v:'−49 ₽',c:'#6A1030'},
              {l:'Комиссия ВВ',v:'−28 ₽',c:'#6A1030'},
            ].map((r,i)=>(
              <Row key={i} label={r.l} value={r.v} color={r.c}/>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:14,fontWeight:800,borderTop:'2px solid rgba(196,168,130,0.3)',marginTop:4}}>
              <span style={{color:'#1C2E26'}}>Итого на руки с 1 выкупа</span>
              <span style={{color:'#1A6B28'}}>408 ₽</span>
            </div>
          </div>
        </div>
      )}

      {activeTab==='forecast'&&(
        <div style={{maxWidth:560}}>
          <div className="card">
            <div className="card-title">Прогноз на следующий месяц</div>
            <div className="form-grid fg3" style={{marginBottom:16}}>
              {[{l:'Заказов WB',v:fcOrders,set:setFcOrders},{l:'% выкупа',v:fcBuyout,set:setFcBuyout},{l:'Произвести (шт)',v:fcProd,set:setFcProd}].map((f,i)=>(
                <div key={i} className="form-group">
                  <label className="form-label">{f.l}</label>
                  <input type="number" value={f.v} onChange={e=>f.set(parseInt(e.target.value)||0)}/>
                </div>
              ))}
            </div>
            {[
              {l:'Заказов',v:fmt(fcOrders)+' шт'},
              {l:`Выкупов (~${fcBuyout}%)`,v:fmt(fcSales)+' шт',c:'#1A6B28'},
              {l:'Выручка чистая с WB',v:'+'+fmt(fcRevNet)+' ₽',c:'#1A6B28'},
              {l:'Себестоимость материалов',v:'−'+fmt(fcMat)+' ₽',c:'#6A1030'},
              {l:'Зарплата швеям',v:'−'+fmt(fcLabor)+' ₽',c:'#6A1030'},
              {l:'Доставка СДЭК на WB',v:'−'+fmt(fcSdek)+' ₽',c:'#6A1030'},
              {l:'Реклама (~5% ДРР)',v:'−'+fmt(fcRek)+' ₽',c:'#6A1030'},
              {l:'Налог 6%',v:'−'+fmt(fcNalog)+' ₽',c:'#6A1030'},
            ].map((r,i)=><Row key={i} label={r.l} value={r.v} color={r.c}/>)}
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:15,fontWeight:800,borderTop:'2px solid rgba(196,168,130,0.3)',marginTop:4,color:fcProfit>0?'#1A6B28':'#6A1030'}}>
              <span style={{color:'#1C2E26'}}>Прогноз чистой прибыли</span>
              <span>{fmt(fcProfit)} ₽</span>
            </div>
            <div style={{fontSize:11,color:'#7A6A5A',marginTop:8,fontWeight:600}}>Нужно на материалы и зарплату: <strong style={{color:'#1C2E26'}}>{fmt(fcMat+fcLabor)} ₽</strong></div>
          </div>
        </div>
      )}
    </div>
  )
}