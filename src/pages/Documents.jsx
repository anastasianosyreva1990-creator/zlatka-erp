import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const CUSTOMER = {
  name:'ИП Носырев Александр Николаевич',inn:'720319880111',
  ogrn:'323723200012519',address:'г. Тюмень, ул. Юбилейная д.20',
  bank:'АО «Тинькофф Банк»',account:'40802810500004306960',
  bik:'044525974',phone:'8-909-186-29-49',email:'naastia@yandex.ru',
}
const PCOL={'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60','Кокошник Ягоды':'#7D3C98','Кокошник Петушки':'#E67E22'}
const MN_NOM=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MN_GEN=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
function daysInM(y,m){return new Date(y,m,0).getDate()}
function buildDocMonths(sy,sm){
  const months=[],date={},short={},prefix={}
  let y=sy,m=sm
  const now=new Date(),cy=now.getFullYear(),cm=now.getMonth()+1
  while(y<cy||(y===cy&&m<=cm)){
    const lbl=`${MN_NOM[m-1]} ${y}`,gen=MN_GEN[m-1],mm=String(m).padStart(2,'0')
    months.push(lbl);date[lbl]=`${daysInM(y,m)} ${gen} ${y}`;short[lbl]=gen;prefix[lbl]=`${y}-${mm}`
    if(++m>12){m=1;y++}
  }
  return{months,date,short,prefix}
}
const {months:MONTHS,date:MONTH_DATE,short:MONTH_SHORT,prefix:MONTH_PREFIX}=buildDocMonths(2026,1)
const DOC_CURRENT_MONTH=MONTHS[MONTHS.length-1]

export default function Documents(){
  const [sewers,setSewers]=useState([])
  const [productions,setProductions]=useState([])
  const [invoices,setInvoices]=useState([])
  const [loading,setLoading]=useState(true)
  const [selMonth,setSelMonth]=useState(DOC_CURRENT_MONTH)
  const [activeTab,setActiveTab]=useState('acts')
  const [actPopup,setActPopup]=useState(null)

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    const [{data:sw},{data:pr},{data:inv}]=await Promise.all([
      supabase.from('sewers').select('*').eq('active',true).order('name'),
      supabase.from('productions').select('*, sewers(name)').order('date'),
      supabase.from('invoices').select('*, sewers(name)').order('created_at',{ascending:false}),
    ])
    setSewers(sw||[]);setProductions(pr||[]);setInvoices(inv||[])
    setLoading(false)
  }

  function getActData(sewerId,month){
    const prefix=MONTH_PREFIX[month]
    if(!prefix) return {}
    const byColor={}
    productions.filter(p=>p.sewer_id===sewerId&&p.date?.startsWith(prefix))
      .forEach(p=>{byColor[p.product]=(byColor[p.product]||0)+p.quantity})
    return byColor
  }

  function getActTotal(sewerId,month){
    const sewer=sewers.find(s=>s.id===sewerId)
    if(!sewer) return {qty:0,sum:0}
    const byColor=getActData(sewerId,month)
    const qty=Object.values(byColor).reduce((a,b)=>a+b,0)
    return {qty,sum:qty*sewer.tariff}
  }

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:800,color:'#1C2E26',marginBottom:20}}>
        Документы / <span style={{color:'#C4A882'}}>Акты</span>
      </h1>

      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
        <button onClick={()=>setActiveTab('acts')} style={{padding:'6px 16px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',border:`1px solid ${activeTab==='acts'?'#1C2E26':'rgba(74,111,82,0.2)'}`,background:activeTab==='acts'?'#1C2E26':'transparent',color:activeTab==='acts'?'#C4A882':'#4A3A2A'}}>Акты</button>
        <button onClick={()=>setActiveTab('invoices')} style={{padding:'6px 16px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',border:`1px solid ${activeTab==='invoices'?'#1C2E26':'rgba(74,111,82,0.2)'}`,background:activeTab==='invoices'?'#1C2E26':'transparent',color:activeTab==='invoices'?'#C4A882':'#4A3A2A'}}>Счета</button>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {MONTHS.map(m=>(
          <button key={m} onClick={()=>setSelMonth(m)} style={{
            padding:'5px 14px',borderRadius:16,fontSize:12,fontWeight:700,cursor:'pointer',
            border:`1px solid ${selMonth===m?'#1C2E26':'rgba(74,111,82,0.2)'}`,
            background:selMonth===m?'#1C2E26':'transparent',
            color:selMonth===m?'#C4A882':'#4A3A2A'
          }}>{m}</button>
        ))}
      </div>

      {activeTab==='acts'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {sewers.map(sw=>{
          const byColor=getActData(sw.id,selMonth)
          const {qty,sum}=getActTotal(sw.id,selMonth)
          const inv=invoices.find(i=>i.sewer_id===sw.id&&i.month===selMonth)
          return (
            <div key={sw.id} onClick={()=>qty>0&&setActPopup({sewer:sw,month:selMonth,byColor,total:{qty,sum},inv})} style={{background:'#fff',border:'0.5px solid rgba(74,111,82,0.15)',borderRadius:12,overflow:'hidden',cursor:qty>0?'pointer':'default'}}>
              <div style={{background:'#1C2E26',padding:'10px 14px'}}>
                <span style={{fontWeight:800,fontSize:13,color:'#F2EBE0'}}>{sw.name}</span>
              </div>
              <div style={{padding:'10px 14px'}}>
                {Object.keys(byColor).length===0?(
                  <div style={{fontSize:12,color:'#9A8878',fontWeight:600,padding:'8px 0',textAlign:'center'}}>Нет сдач за {selMonth}</div>
                ):(
                  Object.entries(byColor).map(([prod,q])=>(
                    <div key={prod} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'0.5px solid rgba(74,111,82,0.06)',fontSize:12}}>
                      <span style={{display:'flex',alignItems:'center',gap:5,fontWeight:700,color:'#1C2E26'}}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:PCOL[prod]||'#888'}}></span>
                        {prod.replace('Кокошник ','')} · {fmt(q)} шт
                      </span>
                      <span style={{fontWeight:800,color:'#1C2E26'}}>{fmt(q*sw.tariff)} ₽</span>
                    </div>
                  ))
                )}
                {qty>0&&(
                  <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontSize:13,fontWeight:800,borderTop:'1px solid rgba(196,168,130,0.2)',marginTop:4}}>
                    <span style={{color:'#5A4A3A'}}>Итого {fmt(qty)} шт</span>
                    <span style={{color:'#1A6B28'}}>{fmt(sum)} ₽</span>
                  </div>
                )}
                {qty>0&&(
                  <div style={{marginTop:6,fontSize:11,color:'#9A8878',fontWeight:600}}>
                    Нажмите для просмотра акта
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>}

      {activeTab==='invoices'&&(
        <div style={{background:'#fff',borderRadius:12,border:'0.5px solid rgba(74,111,82,0.15)',overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',fontSize:12,whiteSpace:'nowrap',width:'100%'}}>
            <thead>
              <tr style={{background:'#F5F0E8'}}>
                <th style={{padding:'9px 12px',textAlign:'left',color:'#4A3A2A',fontWeight:700,fontSize:11,borderBottom:'1px solid rgba(196,168,130,0.2)'}}>№ Счёта</th>
                <th style={{padding:'9px 12px',textAlign:'left',color:'#4A3A2A',fontWeight:700,fontSize:11,borderBottom:'1px solid rgba(196,168,130,0.2)'}}>Швея</th>
                <th style={{padding:'9px 12px',textAlign:'left',color:'#4A3A2A',fontWeight:700,fontSize:11,borderBottom:'1px solid rgba(196,168,130,0.2)'}}>Месяц</th>
                <th style={{padding:'9px 12px',textAlign:'right',color:'#4A3A2A',fontWeight:700,fontSize:11,borderBottom:'1px solid rgba(196,168,130,0.2)',width:'1%'}}>Сумма</th>
                <th style={{padding:'9px 12px',textAlign:'left',color:'#4A3A2A',fontWeight:700,fontSize:11,borderBottom:'1px solid rgba(196,168,130,0.2)',width:'1%'}}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:32,color:'#7A6A5A'}}>Нет счетов</td></tr>}
              {invoices.map(inv=>{
                const sw=sewers.find(s=>s.id===inv.sewer_id)
                const prefix=MONTH_PREFIX[inv.month]
                const qty=prefix?productions.filter(p=>p.sewer_id===inv.sewer_id&&p.date?.startsWith(prefix)).reduce((a,p)=>a+p.quantity,0):0
                const sum=qty*(sw?.tariff||0)
                let stBg='#EEE4C8',stColor='#6A4A10',stText='Ожидает'
                if(inv.status==='paid'){stBg='#D8EED8';stColor='#1A4A28';stText='Оплачено'}
                else if(inv.status==='unpaid'){stBg='#EED4DD';stColor='#6A1030';stText='Не оплачено'}
                return (
                  <tr key={inv.id}>
                    <td style={{padding:'8px 12px',fontWeight:700,borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap'}}>{inv.invoice_num||'—'}</td>
                    <td style={{padding:'8px 12px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap'}}>{inv.sewers?.name||sw?.name||'—'}</td>
                    <td style={{padding:'8px 12px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap',color:'#7A6A5A'}}>{inv.month||'—'}</td>
                    <td style={{padding:'8px 12px',textAlign:'right',fontWeight:800,borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap',width:'1%',color:'#1A6B28'}}>{fmt(sum)} ₽</td>
                    <td style={{padding:'8px 12px',borderBottom:'0.5px solid rgba(74,111,82,0.07)',whiteSpace:'nowrap',width:'1%'}}>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:6,background:stBg,color:stColor,fontWeight:700}}>{stText}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {actPopup&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setActPopup(null)}>
          <div style={{background:'#fff',borderRadius:16,width:580,maxHeight:'90vh',overflow:'auto',padding:'24px'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:800,fontSize:16,color:'#1C2E26'}}>Акт — {actPopup.sewer.name} — {actPopup.month}</span>
              <button onClick={()=>setActPopup(null)} style={{fontSize:20,background:'none',border:'none',cursor:'pointer',color:'#7A6A5A'}}>×</button>
            </div>
            <div style={{fontSize:13,lineHeight:1.7}}>
              <div style={{textAlign:'center',fontWeight:800,fontSize:16,marginBottom:4}}>Акт выполненных работ</div>
              <div style={{textAlign:'center',color:'#7A6A5A',fontWeight:600,marginBottom:16}}>
                {actPopup.inv?.invoice_num||'№ ___'} от «{MONTH_DATE[actPopup.month]?.split(' ')[0]||'__'}» {MONTH_SHORT[actPopup.month]||''} 2026 г. г. Тюмень
              </div>
              <p style={{marginBottom:8,fontWeight:600}}>Мы, нижеподписавшиеся:</p>
              <p style={{marginBottom:8}}><strong>{CUSTOMER.name}</strong>, ИНН {CUSTOMER.inn}, адрес: {CUSTOMER.address}</p>
              <p style={{marginBottom:16}}>и <strong>Самозанятое лицо {actPopup.sewer.full_name||actPopup.sewer.name}</strong>{actPopup.sewer.inn?`, ИНН ${actPopup.sewer.inn}`:''}{actPopup.sewer.address?`, адрес: ${actPopup.sewer.address}`:''}</p>
              <p style={{marginBottom:12,fontWeight:600}}>По договору № {actPopup.sewer.contract_num||'—'} от «{actPopup.sewer.contract_date?new Date(actPopup.sewer.contract_date).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'—'}» исполнитель выполнил услугу пошива аксессуара для волос (Кокошника).</p>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:12,fontSize:12}}>
                <thead>
                  <tr style={{background:'#F5F0E8'}}>
                    <th style={{padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700,textAlign:'left'}}>Наименование</th>
                    <th style={{padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700,textAlign:'center'}}>Кол-во, шт</th>
                    <th style={{padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700,textAlign:'right'}}>Цена</th>
                    <th style={{padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700,textAlign:'right'}}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(actPopup.byColor).map(([prod,qty])=>(
                    <tr key={prod}>
                      <td style={{padding:'5px 10px',border:'1px solid rgba(196,168,130,0.2)'}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,fontWeight:600}}>
                          <span style={{width:7,height:7,borderRadius:'50%',background:PCOL[prod]||'#888'}}></span>
                          Пошив кокошника ({prod.replace('Кокошник ','')})
                        </span>
                      </td>
                      <td style={{padding:'5px 10px',border:'1px solid rgba(196,168,130,0.2)',textAlign:'center',fontWeight:700}}>{fmt(qty)}</td>
                      <td style={{padding:'5px 10px',border:'1px solid rgba(196,168,130,0.2)',textAlign:'right',fontWeight:700}}>{fmt(actPopup.sewer.tariff)} ₽</td>
                      <td style={{padding:'5px 10px',border:'1px solid rgba(196,168,130,0.2)',textAlign:'right',fontWeight:800,color:'#1A6B28'}}>{fmt(qty*actPopup.sewer.tariff)} ₽</td>
                    </tr>
                  ))}
                  <tr style={{fontWeight:800,background:'#F5F0E8'}}>
                    <td colSpan={2} style={{padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)'}}>Итого: {fmt(actPopup.total.qty)} шт</td>
                    <td colSpan={2} style={{padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',textAlign:'right',color:'#1A6B28'}}>{fmt(actPopup.total.sum)} руб.</td>
                  </tr>
                </tbody>
              </table>
              <p style={{fontWeight:800,marginBottom:8}}>Стоимость выполненных работ составляет {fmt(actPopup.total.sum)} рублей.</p>
              <p style={{marginBottom:16,fontWeight:600}}>Работы выполнены качественно и в срок, претензий стороны не имеют.</p>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <tbody>
                  <tr>
                    <td style={{width:'50%',padding:'8px',verticalAlign:'top',borderTop:'1px solid rgba(196,168,130,0.3)'}}>
                      <strong>Исполнитель</strong><br/>
                      {actPopup.sewer.full_name||actPopup.sewer.name}<br/>
                      {actPopup.sewer.address||''}<br/>
                      {actPopup.sewer.phone?`Тел: ${actPopup.sewer.phone}`:''}<br/>
                      {actPopup.sewer.bank_account?`Р/с: ${actPopup.sewer.bank_account}`:''}<br/>
                      {actPopup.sewer.bank_name||''}<br/><br/>
                      Подпись: __________
                    </td>
                    <td style={{width:'50%',padding:'8px',verticalAlign:'top',borderTop:'1px solid rgba(196,168,130,0.3)'}}>
                      <strong>Заказчик</strong><br/>
                      {CUSTOMER.name}<br/>
                      ИНН {CUSTOMER.inn}<br/>
                      Р/с {CUSTOMER.account}<br/>
                      {CUSTOMER.bank}, БИК {CUSTOMER.bik}<br/>
                      Тел: {CUSTOMER.phone}<br/><br/>
                      Подпись: __________
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
