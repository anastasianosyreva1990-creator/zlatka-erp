import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PCOL = {'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60','Кокошник Ягоды':'#7D3C98','Кокошник Петушки':'#E67E22'}
const PLBL = {'Кокошник Красный':'Красный','Кокошник Белый':'Белый','Кокошник Черный':'Чёрный','Кокошник Цветной':'Цветной','Кокошник Ягоды':'Ягоды','Кокошник Петушки':'Петушки'}
const PRODUCTS = Object.keys(PCOL)
const fmt = x => Math.round(x).toLocaleString('ru-RU')
const DAILY_FALLBACK = {'Кокошник Красный':515/14,'Кокошник Белый':63/14,'Кокошник Черный':164/14,'Кокошник Цветной':19/14,'Кокошник Ягоды':0,'Кокошник Петушки':0}
const IL=1.40,IRP=0.0207,VOL=0.8,PRICE=850

const WHS = [
  {id:'ekb',name:'Екатеринбург',fo:'Уральский',tariff:190,sdek:934},
  {id:'vlad',name:'Владимир',fo:'Центральный',tariff:130,sdek:1354},
  {id:'voronezh',name:'Воронеж',fo:'Центральный',tariff:130,sdek:1460},
  {id:'kotovsk',name:'Котовск',fo:'Центральный',tariff:120,sdek:1565},
  {id:'novosem',name:'Новосемейкино',fo:'Приволжский',tariff:160,sdek:1249},
  {id:'volgograd',name:'Волгоград',fo:'Южный',tariff:170,sdek:1670},
  {id:'ryazan',name:'Рязань',fo:'Центральный',tariff:130,sdek:1355},
]

const MONTHS = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04']
const MONTH_NAMES = {
  '2025-10':'Октябрь 2025','2025-11':'Ноябрь 2025','2025-12':'Декабрь 2025',
  '2026-01':'Январь 2026','2026-02':'Февраль 2026','2026-03':'Март 2026','2026-04':'Апрель 2026'
}

function logCost(wh){return wh.tariff||0}

export default function Wildberries(){
  const [warehouses,setWarehouses]=useState([])
  const [wbStocks,setWbStocks]=useState([])
  const [wbSales,setWbSales]=useState([])
  const [wbMonthly,setWbMonthly]=useState([])
  const [shipments,setShipments]=useState([])
  const [orders,setOrders]=useState([])
  const [loading,setLoading]=useState(true)
  const [editShip,setEditShip]=useState(null)
  const [editShipFields,setEditShipFields]=useState({})
  const [inlineEdit,setInlineEdit]=useState(null)
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
  const [shFb,setShFb]=useState('')
  const [ordDate,setOrdDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().split('T')[0]})
  const [ordRed,setOrdRed]=useState('')
  const [ordWhite,setOrdWhite]=useState('')
  const [ordBlack,setOrdBlack]=useState('')
  const [ordColor,setOrdColor]=useState('')
  const [ordFb,setOrdFb]=useState('')
  const [selMonth,setSelMonth]=useState('2026-04')
  const [buyoutRate,setBuyoutRate]=useState(null)
  const [buyoutLoading,setBuyoutLoading]=useState(false)
  const [newWhPopup,setNewWhPopup]=useState(false)
  const [newWhName,setNewWhName]=useState('')
  const [newWhFo,setNewWhFo]=useState('')
  const [newWhTariff,setNewWhTariff]=useState('')
  const [newWhSdek,setNewWhSdek]=useState('')
  const [newWhFb,setNewWhFb]=useState('')

  useEffect(()=>{loadAll();fetchBuyoutRate()},[])

  async function fetchBuyoutRate(){
    setBuyoutLoading(true)
    const token=import.meta.env.VITE_WB_TOKEN
    const dateFrom=new Date(Date.now()-30*24*60*60*1000).toISOString().replace(/\.\d{3}Z$/,'')
    try{
      const [salesRes,ordersRes]=await Promise.all([
        fetch(`https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom}`,{headers:{'Authorization':token}}),
        fetch(`https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${dateFrom}`,{headers:{'Authorization':token}}),
      ])
      if(!salesRes.ok||!ordersRes.ok) return
      const [salesData,ordersData]=await Promise.all([salesRes.json(),ordersRes.json()])
      const buyouts=(salesData||[]).filter(s=>s.saleID?.startsWith('S')&&s.brandName==='Златка').length
      const totalOrders=(ordersData||[]).filter(o=>o.brandName==='Златка').length
      if(totalOrders>0) setBuyoutRate(Math.round(buyouts/totalOrders*100))
    }catch(e){
      console.error('WB buyout rate:',e)
    }
    setBuyoutLoading(false)
  }

  async function loadAll(){
    setLoading(true)
    const [{data:wb},{data:ws},{data:sh},{data:ord},{data:wm},{data:whDb}]=await Promise.all([
      supabase.from('wb_stocks').select('*'),
      supabase.from('wb_sales_by_wh').select('*'),
      supabase.from('shipments').select('*').order('ship_date',{ascending:false}),
      supabase.from('wb_orders').select('*').order('date'),
      supabase.from('wb_monthly').select('*').order('month'),
      supabase.from('wb_warehouses').select('*').eq('active',true).order('name'),
    ])
    setWbStocks(wb||[]);setWbSales(ws||[]);setShipments(sh||[]);setOrders(ord||[]);setWbMonthly(wm||[])
    if(whDb?.length) setWarehouses(whDb.map(w=>({id:w.id,name:w.name,fo:w.fo||'',tariff:w.wb_tariff||0,sdek:w.sdek_tariff||0})))
    setLoading(false)
  }

  function getStock(whId,prod){
    const whName=warehouses.find(w=>w.id===whId)?.name
    return wbStocks.find(s=>(s.warehouse===whId||s.warehouse===whName)&&s.product===prod)?.quantity||0
  }
  function getDailyRate(whId,prod){
    const whName=warehouses.find(w=>w.id===whId)?.name
    const found=wbSales.find(s=>(s.warehouse===whId||s.warehouse===whName)&&s.product===prod)
    return found?.daily_rate??DAILY_FALLBACK[prod]??0
  }
  function daysLeft(whId,prod){const qty=getStock(whId,prod);const spd=getDailyRate(whId,prod)||1;return Math.floor(qty/spd)}
  function getTotalStock(prod){return warehouses.reduce((a,wh)=>a+getStock(wh.id,prod),0)}

  async function addShipment(){
    if(!shQty||!shDate){setShFb('Заполните дату и количество');return}
    const wh=warehouses.find(w=>w.id===shWh)
    await supabase.from('shipments').insert({
      ship_date:shDate,product:shType,quantity:parseInt(shQty),
      warehouse:wh?.name||shWh,tk:shTk,invoice_num:shNakl,
      wb_supply_num:shWbNum,shk_box:shShk,
      arrival_date:shArrival||null,status:'В пути'
    })
    setShFb(`✓ Отгрузка: ${PLBL[shType]} → ${wh?.name} ${shQty} шт`)
    setShQty('');setShNakl('');setShWbNum('');setShShk('')
    loadAll()
  }

  async function saveOrders(){
    if(!ordDate){setOrdFb('Укажите дату');return}
    await supabase.from('wb_orders').upsert({
      date:ordDate,
      red:parseInt(ordRed)||0,
      white:parseInt(ordWhite)||0,
      black:parseInt(ordBlack)||0,
      color:parseInt(ordColor)||0,
    },{onConflict:'date'})
    setOrdFb(`✓ Сохранено за ${new Date(ordDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}`)
    setOrdRed('');setOrdWhite('');setOrdBlack('');setOrdColor('')
    loadAll()
  }

  async function setShipStatus(id,val){
    await supabase.from('shipments').update({status:val}).eq('id',id);loadAll()
  }

  async function deleteShipment(id){
    if(!window.confirm('Удалить строку отгрузки?')) return
    await supabase.from('shipments').delete().eq('id',id);loadAll()
  }

  async function addWarehouse(){
    if(!newWhName.trim()){setNewWhFb('Введите название');return}
    const id=newWhName.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
    const {error}=await supabase.from('wb_warehouses').insert({
      id,
      name:newWhName.trim(),
      fo:newWhFo.trim()||null,
      wb_tariff:parseInt(newWhTariff)||0,
      sdek_tariff:parseInt(newWhSdek)||0,
      active:true,
    })
    if(error){setNewWhFb('Ошибка: '+error.message);return}
    setNewWhFb('✓ Склад добавлен')
    setTimeout(()=>{setNewWhPopup(false);setNewWhFb('');setNewWhName('');setNewWhFo('');setNewWhTariff('');setNewWhSdek('');loadAll()},1500)
  }

  async function saveShipEdit(){
    if(!editShip) return
    await supabase.from('shipments').update({
      ship_date:editShipFields.ship_date||null,
      product:editShipFields.product,
      quantity:parseInt(editShipFields.quantity)||0,
      warehouse:editShipFields.warehouse,
      tk:editShipFields.tk||null,
      invoice_num:editShipFields.invoice_num||null,
      wb_supply_num:editShipFields.wb_supply_num||null,
      shk_box:editShipFields.shk_box||null,
      arrival_date:editShipFields.arrival_date||null,
      status:editShipFields.status,
    }).eq('id',editShip.id)
    setEditShip(null);loadAll()
  }

  async function saveInlineEdit(id,field,value){
    const update={}
    if(field==='ship_date') update.ship_date=value||null
    if(field==='quantity') update.quantity=parseInt(value)||0
    if(field==='warehouse') update.warehouse=value
    await supabase.from('shipments').update(update).eq('id',id)
    setInlineEdit(null);loadAll()
  }

  const foGroups={}
  warehouses.forEach(wh=>{if(!foGroups[wh.fo])foGroups[wh.fo]=[];foGroups[wh.fo].push(wh)})

  const defCount = warehouses.filter(wh => {
    const whName = wh.name
    return PRODUCTS.some(prod => {
      const found = wbSales.find(s => (s.warehouse === wh.id || s.warehouse === whName) && s.product === prod)
      return found && found.daily_rate > 0.3 && daysLeft(wh.id, prod) <= 3
    })
  }).length
  const coveredCount = warehouses.filter(wh => PRODUCTS.some(prod => getStock(wh.id,prod) > 0)).length

  const monthOrders=orders.filter(o=>o.date?.startsWith(selMonth))
  const daysInMonth=new Date(parseInt(selMonth.split('-')[0]),parseInt(selMonth.split('-')[1]),0).getDate()
  const days=Array.from({length:daysInMonth},(_,i)=>i+1)
  const monthTotals={
    red:monthOrders.reduce((a,o)=>a+o.red,0),
    white:monthOrders.reduce((a,o)=>a+o.white,0),
    black:monthOrders.reduce((a,o)=>a+o.black,0),
    color:monthOrders.reduce((a,o)=>a+o.color,0),
  }
  monthTotals.total=monthTotals.red+monthTotals.white+monthTotals.black+monthTotals.color
  const avgPerDay=monthOrders.filter(o=>o.red+o.white+o.black+o.color>0).length>0
    ?Math.round(monthTotals.total/monthOrders.filter(o=>o.red+o.white+o.black+o.color>0).length):0

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  const TabBtn=({id,label})=>(
    <button onClick={()=>setActiveTab(id)} style={{
      padding:'6px 16px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',
      border:`1px solid ${activeTab===id?'#1C2E26':'rgba(74,111,82,0.2)'}`,
      background:activeTab===id?'#1C2E26':'transparent',
      color:activeTab===id?'#C4A882':'#4A3A2A'
    }}>{label}</button>
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:800,color:'#1C2E26'}}>Wildberries / <span style={{color:'#C4A882'}}>Склады</span></h1>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>{setNewWhPopup(true);setNewWhFb('')}}
            style={{fontSize:12,fontWeight:700,color:'#C4A882',textDecoration:'none',padding:'5px 12px',border:'1px solid #C4A882',borderRadius:8,background:'#1C2E26',cursor:'pointer'}}>
            + Склад WB
          </button>
          <Link to="/settings" style={{fontSize:12,fontWeight:700,color:'#7A6A5A',textDecoration:'none',padding:'5px 12px',border:'1px solid rgba(74,111,82,0.2)',borderRadius:8,background:'transparent'}}>
            ⚙ Управление складами
          </Link>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Заказов в день (апр)',value:fmt(avgPerDay||54),sub:'средний темп'},
          {label:'Складов с дефицитом',value:defCount,color:defCount>0?'#6A1030':'#1A6B28',sub:`из ${warehouses.length} складов`},
          {label:'Индекс локализации',value:'1.40',color:coveredCount>=warehouses.length?'#1A6B28':'#6A1030',sub:warehouses.length===0?'загрузка...':coveredCount>=warehouses.length?`все ${warehouses.length} складов покрыты ✓`:`нужно ещё ${warehouses.length-coveredCount} ${warehouses.length-coveredCount===1?'склад':warehouses.length-coveredCount<5?'склада':'складов'} для IL=1.0`},
          {label:'Процент выкупа',value:buyoutLoading?'…':buyoutRate!==null?buyoutRate+'%':'—',sub:buyoutRate!==null?'выкупы / заказы · 30 дней WB API':'загружается из WB API'},
        ].map((m,i)=>(
          <div key={i} style={{background:'#fff',borderRadius:12,padding:'14px 16px',border:'0.5px solid rgba(74,111,82,0.15)'}}>
            <div style={{fontSize:10,color:'#7A6A5A',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:4}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:m.color||'#1C2E26'}}>{m.value}</div>
            <div style={{fontSize:11,color:'#9A8878',marginTop:2}}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        <TabBtn id="signals" label="Сигналы"/>
        <TabBtn id="orders" label="Заказы"/>
        <TabBtn id="shipments" label="Отгрузки"/>
      </div>
      <div style={{fontSize:11,color:'#9A8878',marginBottom:12}}>Данные обновляются автоматически каждый день в 7:00 МСК</div>

      {activeTab==='signals'&&(
        <div>
          {warehouses.length > 0 && (() => {
            const emptyWhs = warehouses.filter(wh => !PRODUCTS.some(prod => getStock(wh.id, prod) > 0))
            const allCovered = emptyWhs.length === 0
            return (
              <div style={{background: allCovered ? '#D8EED8' : '#EEE4C8', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color: allCovered ? '#1A4A28' : '#6A4A10', fontWeight:600}}>
                {allCovered
                  ? <>✓ Все {warehouses.length} складов покрыты — индекс локализации IL≥1.0 достигнут.</>
                  : <>
                      💡 Для IL=1.0 нужно покрыть все {warehouses.length} складов. Сейчас покрыто: {coveredCount} из {warehouses.length}.{' '}
                      Нужно отгрузить на: <strong>{emptyWhs.map(w => w.name).join(', ')}</strong>.
                    </>
                }
              </div>
            )
          })()}
          <div style={{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',padding:'14px 18px',marginBottom:16}}>
            <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,textTransform:'uppercase',letterSpacing:0.5,marginBottom:10}}>Итого на всех складах WB</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {PRODUCTS.map(prod=>{
                const total=getTotalStock(prod)
                const avgRate=warehouses.reduce((a,wh)=>a+getDailyRate(wh.id,prod),0)
                const d=avgRate>0?Math.floor(total/avgRate):0
                return (
                  <div key={prod} style={{background:'#F5F0E8',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:PCOL[prod]}}></span>
                      <span style={{fontSize:12,fontWeight:700,color:'#1C2E26'}}>{PLBL[prod]}</span>
                    </div>
                    <div style={{fontSize:20,fontWeight:800,color:'#1C2E26'}}>{fmt(total)} шт</div>
                    <div style={{fontSize:11,color:'#7A6A5A',marginTop:2}}>~{d} дней</div>
                  </div>
                )
              })}
            </div>
          </div>

          {Object.entries(foGroups).map(([fo,whs])=>(
            <div key={fo} style={{marginBottom:20}}>
              <div style={{fontSize:10,color:'#5A4A3A',textTransform:'uppercase',letterSpacing:1,marginBottom:10,fontWeight:800}}>{fo} ФО</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {whs.map(wh=>{
                  let hasCrit=false,hasWarn=false
                  PRODUCTS.forEach(prod=>{
                    const d=daysLeft(wh.id,prod),spd=getDailyRate(wh.id,prod)||0
                    if(spd>0.3&&d<=3) hasCrit=true
                    else if(spd>0.3&&d<=7) hasWarn=true
                  })
                  const lc=Math.round(logCost(wh))
                  const borderColor=hasCrit?'#6A1030':hasWarn?'#6A4A10':'rgba(74,111,82,0.2)'
                  return (
                    <div key={wh.id} style={{background:'#fff',border:`1px solid ${borderColor}`,borderRadius:12,overflowX:'auto'}}>
                      <div style={{background:'#1C2E26',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:13,color:'#F2EBE0'}}>{hasCrit?'⚠ ':''}{wh.name}</div>
                          <div style={{fontSize:10,color:'rgba(196,168,130,0.7)',marginTop:1}}>{wh.fo}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:14,color:'#C4A882',fontWeight:800}}>~{lc} ₽/шт</div>
                          <div style={{fontSize:11,color:'rgba(196,168,130,0.8)',fontWeight:600}}>логистика WB</div>
                        </div>
                      </div>
                      <div style={{padding:'8px 14px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 50px 60px 80px',gap:4,fontSize:10,color:'#7A6A5A',fontWeight:700,paddingBottom:5,borderBottom:'1px solid rgba(196,168,130,0.15)',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>
                          <span>Цвет</span><span style={{textAlign:'right'}}>Остаток</span><span style={{textAlign:'right'}}>шт/день</span><span style={{textAlign:'right'}}>Статус</span>
                        </div>
                        {PRODUCTS.map(prod=>{
                          const spd=getDailyRate(wh.id,prod)||0
                          if(spd<0.3&&DAILY_FALLBACK[prod]<0.3) return null
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
                              <span style={{textAlign:'right',fontWeight:800}}>{fmt(qty)}</span>
                              <span style={{textAlign:'right',color:'#7A6A5A',fontSize:11}}>{spd.toFixed(1)}</span>
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

      {activeTab==='orders'&&(
        <div>
          <div style={{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',padding:'16px 18px',marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:800,color:'#1C2E26',marginBottom:12}}>Внести заказы за день</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Дата</div>
                <input type="date" value={ordDate} onChange={e=>setOrdDate(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
              {[
                {label:'Красный',val:ordRed,set:setOrdRed,color:'#C0392B'},
                {label:'Белый',val:ordWhite,set:setOrdWhite,color:'#95A5A6'},
                {label:'Черный',val:ordBlack,set:setOrdBlack,color:'#2C3E50'},
                {label:'Цветной',val:ordColor,set:setOrdColor,color:'#27AE60'},
              ].map(f=>(
                <div key={f.label}>
                  <div style={{fontSize:11,fontWeight:700,marginBottom:4,display:'flex',alignItems:'center',gap:5}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:f.color,display:'inline-block'}}></span>
                    {f.label}
                  </div>
                  <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder="0" min="0"
                    style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
                </div>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button onClick={saveOrders} style={{padding:'8px 20px',background:'#1C2E26',color:'#C4A882',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Сохранить
              </button>
              {ordFb&&<div style={{fontSize:12,color:'#1A6B28',fontWeight:700}}>{ordFb}</div>}
            </div>
          </div>

          <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>setSelMonth(m)} style={{
                padding:'5px 12px',borderRadius:16,fontSize:11,fontWeight:700,cursor:'pointer',
                border:`1px solid ${selMonth===m?'#1C2E26':'rgba(74,111,82,0.2)'}`,
                background:selMonth===m?'#1C2E26':'transparent',
                color:selMonth===m?'#C4A882':'#4A3A2A'
              }}>{MONTH_NAMES[m]}</button>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:14}}>
            {[
              {label:'Красный',value:monthTotals.red,color:'#C0392B'},
              {label:'Белый',value:monthTotals.white,color:'#95A5A6'},
              {label:'Черный',value:monthTotals.black,color:'#2C3E50'},
              {label:'Цветной',value:monthTotals.color,color:'#27AE60'},
              {label:'Итого',value:monthTotals.total,color:'#1C2E26'},
            ].map((m,i)=>(
              <div key={i} style={{background:'#fff',borderRadius:10,padding:'10px 12px',border:'0.5px solid rgba(74,111,82,0.15)'}}>
                <div style={{fontSize:10,color:'#7A6A5A',fontWeight:700,marginBottom:2,display:'flex',alignItems:'center',gap:4}}>
                  {i<4&&<span style={{width:7,height:7,borderRadius:'50%',background:m.color,display:'inline-block'}}></span>}
                  {m.label}
                </div>
                <div style={{fontSize:18,fontWeight:800,color:m.color}}>{fmt(m.value)}</div>
              </div>
            ))}
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',overflowX:'auto'}}>
            <table style={{ borderCollapse:'collapse',fontSize:11, whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{background:'#1C2E26'}}>
                  <th style={{padding:'8px 10px',textAlign:'left',color:'#C4A882',fontWeight:700,fontSize:11,position:'sticky',left:0,background:'#1C2E26',minWidth:80}}>Цвет</th>
                  {days.map(d=>(
                    <th key={d} style={{padding:'6px 4px',textAlign:'center',color:'rgba(196,168,130,0.8)',fontWeight:700,minWidth:28}}>{d}</th>
                  ))}
                  <th style={{padding:'6px 8px',textAlign:'right',color:'#C4A882',fontWeight:800,minWidth:60}}>Итого</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {label:'Красный',key:'red',color:'#C0392B'},
                  {label:'Белый',key:'white',color:'#95A5A6'},
                  {label:'Черный',key:'black',color:'#2C3E50'},
                  {label:'Цветной',key:'color',color:'#27AE60'},
                ].map((row,ri)=>{
                  const rowTotal=monthOrders.reduce((a,o)=>a+o[row.key],0)
                  return (
                    <tr key={row.key} style={{background:ri%2===0?'#FAFAF8':'#fff'}}>
                      <td style={{padding:'7px 10px',fontWeight:700,color:row.color,position:'sticky',left:0,background:ri%2===0?'#FAFAF8':'#fff',borderRight:'1px solid rgba(74,111,82,0.1)'}}>
                        <span style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{width:7,height:7,borderRadius:'50%',background:row.color,flexShrink:0}}></span>
                          {row.label}
                        </span>
                      </td>
                      {days.map(d=>{
                        const dateStr=`${selMonth}-${String(d).padStart(2,'0')}`
                        const ord=monthOrders.find(o=>o.date===dateStr)
                        const val=ord?ord[row.key]:null
                        return (
                          <td key={d} style={{padding:'6px 4px',textAlign:'center',borderBottom:'0.5px solid rgba(74,111,82,0.05)',color:val>0?'#1C2E26':'#D5CEC5',fontWeight:val>0?700:400}}>
                            {val!==null?val:'·'}
                          </td>
                        )
                      })}
                      <td style={{padding:'7px 8px',textAlign:'right',fontWeight:800,color:row.color,borderLeft:'1px solid rgba(74,111,82,0.1)'}}>{fmt(rowTotal)}</td>
                    </tr>
                  )
                })}
                <tr style={{background:'#F5F0E8',fontWeight:800}}>
                  <td style={{padding:'7px 10px',fontWeight:800,color:'#1C2E26',position:'sticky',left:0,background:'#F5F0E8',borderRight:'1px solid rgba(74,111,82,0.1)',borderTop:'1px solid rgba(196,168,130,0.2)'}}>Итого</td>
                  {days.map(d=>{
                    const dateStr=`${selMonth}-${String(d).padStart(2,'0')}`
                    const ord=monthOrders.find(o=>o.date===dateStr)
                    const total=ord?(ord.red+ord.white+ord.black+ord.color):null
                    return (
                      <td key={d} style={{padding:'6px 4px',textAlign:'center',borderTop:'1px solid rgba(196,168,130,0.2)',color:total>0?'#1C2E26':'#D5CEC5',fontWeight:total>0?800:400}}>
                        {total!==null?total:'·'}
                      </td>
                    )
                  })}
                  <td style={{padding:'7px 8px',textAlign:'right',fontWeight:800,color:'#1C2E26',borderLeft:'1px solid rgba(74,111,82,0.1)',borderTop:'1px solid rgba(196,168,130,0.2)'}}>{fmt(monthTotals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==='shipments'&&(
        <div>
          <div style={{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',padding:'16px 18px',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:800,color:'#1C2E26',marginBottom:12}}>Добавить отгрузку на WB</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Дата сдачи</div>
                <input type="date" value={shDate} onChange={e=>setShDate(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Тип (цвет)</div>
                <select value={shType} onChange={e=>setShType(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}>
                  {PRODUCTS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Количество</div>
                <input type="number" value={shQty} onChange={e=>setShQty(e.target.value)} placeholder="0"
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Склад WB</div>
                <select value={shWh} onChange={e=>setShWh(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}>
                  {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>ТК</div>
                <input type="text" value={shTk} onChange={e=>setShTk(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>№ Накладной</div>
                <input type="text" value={shNakl} onChange={e=>setShNakl(e.target.value)} placeholder="10..."
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Дата прихода на WB</div>
                <input type="date" value={shArrival} onChange={e=>setShArrival(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>№ Поставки WB</div>
                <input type="text" value={shWbNum} onChange={e=>setShWbNum(e.target.value)} placeholder="WB_1..."
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>ШК Короба</div>
                <input type="text" value={shShk} onChange={e=>setShShk(e.target.value)} placeholder="WB_14..."
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button onClick={addShipment} style={{padding:'8px 20px',background:'#1C2E26',color:'#C4A882',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Добавить отгрузку
              </button>
              {shFb&&<div style={{fontSize:12,color:'#1A6B28',fontWeight:700}}>{shFb}</div>}
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',overflowX:'auto'}}>
            <table style={{ borderCollapse:'collapse',fontSize:12, whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{background:'#F5F0E8'}}>
                  {['Дата','Тип','Кол-во','Направление','ТК','№ Накладной','№ Поставки WB','Приход WB','Статус',''].map(h=>(
                    <th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#4A3A2A',fontWeight:700,fontSize:11,borderBottom:'1px solid rgba(196,168,130,0.2)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shipments.map(s=>(
                  <tr key={s.id}>
                    <td onClick={()=>setInlineEdit({id:s.id,field:'ship_date',value:s.ship_date||''})} style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',color:'#7A6A5A',whiteSpace:'nowrap',cursor:'text'}}>
                      {inlineEdit?.id===s.id&&inlineEdit.field==='ship_date'
                        ?<input autoFocus type="date" value={inlineEdit.value} onChange={e=>setInlineEdit({...inlineEdit,value:e.target.value})} onBlur={e=>saveInlineEdit(s.id,'ship_date',e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveInlineEdit(s.id,'ship_date',inlineEdit.value);if(e.key==='Escape')setInlineEdit(null)}} style={{fontSize:11,padding:'2px 4px',border:'1px solid rgba(74,111,82,0.4)',borderRadius:4}}/>
                        :s.ship_date?new Date(s.ship_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'
                      }
                    </td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:5,fontWeight:700}}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:PCOL[s.product]||'#888',flexShrink:0}}></span>
                        {PLBL[s.product]||s.product}
                      </span>
                    </td>
                    <td onClick={()=>setInlineEdit({id:s.id,field:'quantity',value:String(s.quantity)})} style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',fontWeight:800,whiteSpace:'nowrap',cursor:'text'}}>
                      {inlineEdit?.id===s.id&&inlineEdit.field==='quantity'
                        ?<input autoFocus type="number" value={inlineEdit.value} onChange={e=>setInlineEdit({...inlineEdit,value:e.target.value})} onBlur={e=>saveInlineEdit(s.id,'quantity',e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveInlineEdit(s.id,'quantity',inlineEdit.value);if(e.key==='Escape')setInlineEdit(null)}} style={{fontSize:11,padding:'2px 4px',border:'1px solid rgba(74,111,82,0.4)',borderRadius:4,width:60}}/>
                        :fmt(s.quantity)
                      }
                    </td>
                    <td onClick={()=>setInlineEdit({id:s.id,field:'warehouse',value:s.warehouse||''})} style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',fontWeight:600,whiteSpace:'nowrap',cursor:'pointer'}}>
                      {inlineEdit?.id===s.id&&inlineEdit.field==='warehouse'
                        ?<select autoFocus value={inlineEdit.value} onChange={e=>{const v=e.target.value;saveInlineEdit(s.id,'warehouse',v)}} onKeyDown={e=>e.key==='Escape'&&setInlineEdit(null)} style={{fontSize:11,padding:'2px 4px',border:'1px solid rgba(74,111,82,0.4)',borderRadius:4}}>
                          {warehouses.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
                        </select>
                        :s.warehouse
                      }
                    </td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',color:'#7A6A5A',whiteSpace:'nowrap'}}>{s.tk||'—'}</td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',color:'#7A6A5A',whiteSpace:'nowrap'}}>{s.invoice_num||'—'}</td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',color:'#7A6A5A',whiteSpace:'nowrap'}}>{s.wb_supply_num||'—'}</td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',color:'#7A6A5A',whiteSpace:'nowrap'}}>
                      {s.arrival_date?new Date(s.arrival_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'}
                    </td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap'}}>
                      <select value={s.status} onChange={e=>setShipStatus(s.id,e.target.value)}
                        style={{fontSize:11,padding:'3px 6px',borderRadius:6,border:'1px solid rgba(74,111,82,0.25)',background:'#fff',cursor:'pointer',fontWeight:700}}>
                        <option value="В пути">В пути</option>
                        <option value="Доставлено">Доставлено</option>
                        <option value="Принято WB">Принято WB</option>
                      </select>
                    </td>
                    <td style={{padding:'7px 10px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap'}}>
                      <button onClick={()=>{setEditShip(s);setEditShipFields({...s})}}
                        style={{fontSize:11,padding:'3px 7px',borderRadius:6,border:'1px solid rgba(196,168,130,0.4)',background:'rgba(196,168,130,0.1)',color:'#4A3A2A',cursor:'pointer',fontWeight:700,marginRight:4}}>
                        ✎
                      </button>
                      <button onClick={()=>deleteShipment(s.id)}
                        style={{fontSize:11,padding:'3px 7px',borderRadius:6,border:'1px solid #EED4DD',background:'#EED4DD',color:'#6A1030',cursor:'pointer',fontWeight:700}}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {shipments.length===0&&<tr><td colSpan={10} style={{textAlign:'center',padding:32,color:'#7A6A5A'}}>Нет отгрузок</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ПОПАП — НОВЫЙ СКЛАД WB */}
      {newWhPopup&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setNewWhPopup(false)}>
          <div style={{background:'#fff',borderRadius:16,padding:'24px',width:380}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:800,fontSize:16,color:'#1C2E26'}}>Новый склад WB</span>
              <button onClick={()=>setNewWhPopup(false)} style={{fontSize:20,background:'none',border:'none',cursor:'pointer',color:'#7A6A5A'}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Название склада</div>
                <input type="text" value={newWhName} onChange={e=>setNewWhName(e.target.value)} placeholder="Краснодар"
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Федеральный округ</div>
                <input type="text" value={newWhFo} onChange={e=>setNewWhFo(e.target.value)} placeholder="Южный"
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Тариф WB, ₽/шт</div>
                  <input type="number" value={newWhTariff} onChange={e=>setNewWhTariff(e.target.value)} placeholder="150"
                    style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>СДЭК, ₽/ящик</div>
                  <input type="number" value={newWhSdek} onChange={e=>setNewWhSdek(e.target.value)} placeholder="1400"
                    style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}/>
                </div>
              </div>
              <div style={{fontSize:11,color:'#9A8878',padding:'6px 10px',background:'#F5F0E8',borderRadius:6}}>
                ID склада генерируется автоматически из названия
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button onClick={addWarehouse}
                style={{padding:'8px 20px',background:'#1C2E26',color:'#C4A882',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Добавить
              </button>
              {newWhFb&&<div style={{fontSize:12,color:newWhFb.startsWith('✓')?'#1A6B28':'#6A1030',fontWeight:700}}>{newWhFb}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ПОПАП — РЕДАКТИРОВАТЬ ОТГРУЗКУ */}
      {editShip&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setEditShip(null)}>
          <div style={{background:'#fff',borderRadius:16, padding:'24px',maxHeight:'90vh',overflowX:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:800,fontSize:16,color:'#1C2E26'}}>Редактировать отгрузку</span>
              <button onClick={()=>setEditShip(null)} style={{fontSize:20,background:'none',border:'none',cursor:'pointer',color:'#7A6A5A'}}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[
                {label:'Дата сдачи',key:'ship_date',type:'date'},
                {label:'Дата прихода на WB',key:'arrival_date',type:'date'},
                {label:'Количество',key:'quantity',type:'number'},
                {label:'ТК',key:'tk',type:'text'},
                {label:'№ Накладной',key:'invoice_num',type:'text'},
                {label:'№ Поставки WB',key:'wb_supply_num',type:'text'},
                {label:'ШК Короба',key:'shk_box',type:'text'},
              ].map(f=>(
                <div key={f.key}>
                  <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>{f.label}</div>
                  <input type={f.type} value={editShipFields[f.key]||''} onChange={e=>setEditShipFields({...editShipFields,[f.key]:e.target.value})}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13,boxSizing:'border-box'}}/>
                </div>
              ))}
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Тип (цвет)</div>
                <select value={editShipFields.product||''} onChange={e=>setEditShipFields({...editShipFields,product:e.target.value})}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}>
                  {PRODUCTS.map(p=><option key={p} value={p}>{PLBL[p]||p}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Склад WB</div>
                <select value={editShipFields.warehouse||''} onChange={e=>setEditShipFields({...editShipFields,warehouse:e.target.value})}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}>
                  {warehouses.map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:'#7A6A5A',fontWeight:700,marginBottom:4}}>Статус</div>
                <select value={editShipFields.status||'В пути'} onChange={e=>setEditShipFields({...editShipFields,status:e.target.value})}
                  style={{width:'100%',padding:'7px 10px',border:'1px solid rgba(74,111,82,0.25)',borderRadius:8,fontSize:13}}>
                  <option value="В пути">В пути</option>
                  <option value="Доставлено">Доставлено</option>
                  <option value="Принято WB">Принято WB</option>
                </select>
              </div>
            </div>
            <button onClick={saveShipEdit}
              style={{width:'100%',padding:'10px',background:'#1C2E26',color:'#C4A882',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}