import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const CUSTOMER = {
  name:'ИП Носырев Александр Николаевич',inn:'720319880111',
  ogrn:'323723200012519',address:'г. Тюмень, ул. Юбилейная д.20',
  bank:'АО «Тинькофф Банк»',account:'40802810500004306960',
  bik:'044525974',phone:'8-909-186-29-49',email:'naastia@yandex.ru',
}
const PCOL={'Кокошник Красный':'#C0392B','Кокошник Белый':'#7F8C8D','Кокошник Черный':'#2C3E50','Кокошник Цветной':'#27AE60'}
const MONTHS=['Январь 2026','Февраль 2026','Март 2026','Апрель 2026']
const MONTH_DATE={'Март 2026':'31 марта 2026','Апрель 2026':'30 апреля 2026','Февраль 2026':'28 февраля 2026','Январь 2026':'31 января 2026'}
const MONTH_SHORT={'Март 2026':'марта','Апрель 2026':'апреля','Февраль 2026':'февраля','Январь 2026':'января'}
const MONTH_PREFIX={'Январь 2026':'2026-01','Февраль 2026':'2026-02','Март 2026':'2026-03','Апрель 2026':'2026-04'}

export default function Documents(){
  const [sewers,setSewers]=useState([])
  const [productions,setProductions]=useState([])
  const [invoices,setInvoices]=useState([])
  const [loading,setLoading]=useState(true)
  const [activeTab,setActiveTab]=useState('acts')
  const [selMonth,setSelMonth]=useState('Апрель 2026')
  const [actPopup,setActPopup]=useState(null)
  const [invWho,setInvWho]=useState('')
  const [invMonth,setInvMonth]=useState('Апрель 2026')
  const [invNum,setInvNum]=useState('')
  const [invSum,setInvSum]=useState('')
  const [invDate,setInvDate]=useState(new Date().toISOString().split('T')[0])
  const [invType,setInvType]=useState('invoice')
  const [invFb,setInvFb]=useState('')

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    const [{data:sw},{data:pr},{data:inv}]=await Promise.all([
      supabase.from('sewers').select('*').eq('active',true).order('name'),
      supabase.from('productions').select('*, sewers(name)').order('date'),
      supabase.from('invoices').select('*, sewers(name)').order('created_at',{ascending:false}),
    ])
    setSewers(sw||[]);setProductions(pr||[]);setInvoices(inv||[])
    if(sw?.length>0) setInvWho(sw[0].id)
    setLoading(false)
  }

  function getMonthProds(sewerId,month){
    const prefix=MONTH_PREFIX[month]
    if(!prefix) return []
    return productions.filter(p=>p.sewer_id===sewerId&&p.date?.startsWith(prefix))
  }

  function getActData(sewerId,month){
    const byColor={}
    getMonthProds(sewerId,month).forEach(p=>{byColor[p.product]=(byColor[p.product]||0)+p.quantity})
    return byColor
  }

  function getActTotal(sewerId,month){
    const sewer=sewers.find(s=>s.id===sewerId)
    if(!sewer) return {qty:0,sum:0}
    const byColor=getActData(sewerId,month)
    const qty=Object.values(byColor).reduce((a,b)=>a+b,0)
    return {qty,sum:qty*sewer.tariff}
  }

  async function addInvoice(){
    if(!invSum){setInvFb('Введите сумму');return}
    const existing=invoices.find(i=>i.sewer_id===invWho&&i.month===invMonth&&i.type===invType)
    if(existing){
      await supabase.from('invoices').update({invoice_num:invNum||existing.invoice_num,amount:parseFloat(invSum),invoice_date:invDate,has_receipt:invType==='receipt'?true:existing.has_receipt}).eq('id',existing.id)
      setInvFb('✓ Обновлено')
    } else {
      await supabase.from('invoices').insert({sewer_id:invWho,month:invMonth,invoice_num:invNum,amount:parseFloat(invSum),invoice_date:invDate,has_receipt:invType==='receipt',status:'unpaid',type:invType})
      setInvFb('✓ Добавлено в реестр')
    }
    setInvNum('');setInvSum('');loadAll()
  }

  async function setInvStatus(id,val){
    await supabase.from('invoices').update({status:val,paid_date:val==='paid'?new Date().toISOString().split('T')[0]:null}).eq('id',id);loadAll()
  }

  if(loading) return <div style={{padding:40,color:'#5A4A3A'}}>Загрузка...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Документы <span>/ Акты и счета</span></h1>
      </div>

      <div className="tabs">
        {[{id:'acts',l:'Акты'},{id:'invoices',l:'Реестр счетов'},{id:'add',l:'Добавить счёт / чек'}].map(t=>(
          <button key={t.id} className={`tab-btn${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>{t.l}</button>
        ))}
      </div>

      {activeTab==='acts'&&(
        <div>
          <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>setSelMonth(m)} style={{padding:'5px 14px',borderRadius:16,fontSize:12,border:`1px solid ${selMonth===m?'#1C2E26':'rgba(74,111,82,0.2)'}`,background:selMonth===m?'#1C2E26':'transparent',color:selMonth===m?'#C4A882':'#4A3A2A',cursor:'pointer',fontWeight:700}}>{m}</button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
            {sewers.map(sw=>{
              const byColor=getActData(sw.id,selMonth)
              const {qty,sum}=getActTotal(sw.id,selMonth)
              const inv=invoices.find(i=>i.sewer_id===sw.id&&i.month===selMonth)
              let stBg='#EEE4C8',stColor='#6A4A10',stText='Счёт не получен'
              if(inv?.status==='paid'){stBg='#D8EED8';stColor='#1A4A28';stText='Оплачено'}
              else if(inv?.status==='unpaid'){stBg='#EED4DD';stColor='#6A1030';stText='Ожидает оплаты'}
              return (
                <div key={sw.id} style={{background:'#fff',border:'0.5px solid rgba(74,111,82,0.15)',borderRadius:12,overflow:'hidden'}}>
                  <div style={{background:'#1C2E26',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontWeight:800,fontSize:13,color:'#F2EBE0'}}>{sw.name}</span>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:stBg,color:stColor,fontWeight:800}}>{stText}</span>
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
                    <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                      {qty>0&&(
                        <button onClick={()=>setActPopup({sewer:sw,month:selMonth,byColor,total:{qty,sum},inv})}
                          style={{fontSize:11,padding:'4px 10px',borderRadius:8,border:'1px solid rgba(196,168,130,0.4)',background:'rgba(196,168,130,0.1)',color:'#4A3A2A',cursor:'pointer',fontWeight:700}}>
                          Просмотр акта
                        </button>
                      )}
                      {inv?.status==='unpaid'&&(
                        <button onClick={()=>setInvStatus(inv.id,'paid')}
                          style={{fontSize:11,padding:'4px 10px',borderRadius:8,border:'1px solid rgba(74,111,82,0.3)',background:'rgba(74,111,82,0.08)',color:'#1A4A28',cursor:'pointer',fontWeight:700}}>
                          Отметить оплаченным
                        </button>
                      )}
                      {!inv&&(
                        <button onClick={()=>{setActiveTab('add');setInvWho(sw.id);setInvMonth(selMonth);setInvSum(sum.toString())}}
                          style={{fontSize:11,padding:'4px 10px',borderRadius:8,border:'1px solid rgba(74,111,82,0.2)',background:'transparent',color:'#3A2A1A',cursor:'pointer',fontWeight:700}}>
                          + Счёт
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab==='invoices'&&(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Месяц</th><th>Швея</th><th style={{textAlign:'right'}}>Сумма</th>
                <th>№ счёта</th><th>Дата</th><th>Чек</th><th>Статус</th><th>Оплачен</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv=>(
                <tr key={inv.id}>
                  <td style={{fontWeight:600}}>{inv.month}</td>
                  <td style={{fontWeight:700}}>{inv.sewers?.name}</td>
                  <td style={{textAlign:'right',fontWeight:800,color:'#1C2E26'}}>{fmt(inv.amount)} ₽</td>
                  <td className="text-muted">{inv.invoice_num||'—'}</td>
                  <td className="text-muted">{inv.invoice_date?new Date(inv.invoice_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'}</td>
                  <td>
                    <span style={{fontSize:10,padding:'2px 7px',borderRadius:6,fontWeight:700,background:inv.has_receipt?'#D8EED8':'#EEE4C8',color:inv.has_receipt?'#1A4A28':'#6A4A10'}}>
                      {inv.has_receipt?'Есть':'Нет'}
                    </span>
                  </td>
                  <td>
                    <select value={inv.status} onChange={e=>setInvStatus(inv.id,e.target.value)}
                      style={{fontSize:11,padding:'3px 6px',borderRadius:6,border:'1px solid rgba(74,111,82,0.25)',background:'#fff',cursor:'pointer',fontWeight:700,color:'#1C2E26'}}>
                      <option value="unpaid">Не оплачено</option>
                      <option value="paid">Оплачено</option>
                    </select>
                  </td>
                  <td className="text-muted">{inv.paid_date?new Date(inv.paid_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'—'}</td>
                </tr>
              ))}
              {invoices.length===0&&<tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'#7A6A5A'}}>Нет счетов</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab==='add'&&(
        <div style={{maxWidth:500}}>
          <div className="card">
            <div className="card-title">Добавить счёт или чек</div>
            <div className="form-grid fg2" style={{marginBottom:10}}>
              <div className="form-group"><label className="form-label">Швея</label>
                <select value={invWho} onChange={e=>setInvWho(e.target.value)}>
                  {sewers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Месяц</label>
                <select value={invMonth} onChange={e=>setInvMonth(e.target.value)}>
                  {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Тип</label>
                <select value={invType} onChange={e=>setInvType(e.target.value)}>
                  <option value="invoice">Счёт</option>
                  <option value="receipt">Чек</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">№ документа</label>
                <input type="text" value={invNum} onChange={e=>setInvNum(e.target.value)} placeholder="№ 42"/>
              </div>
              <div className="form-group"><label className="form-label">Сумма, ₽</label>
                <input type="number" value={invSum} onChange={e=>setInvSum(e.target.value)} placeholder="0"/>
              </div>
              <div className="form-group"><label className="form-label">Дата</label>
                <input type="date" value={invDate} onChange={e=>setInvDate(e.target.value)}/>
              </div>
            </div>
            <button onClick={addInvoice} className="btn btn-primary">Добавить в реестр</button>
            {invFb&&<div className="mt-8 text-green text-sm" style={{fontWeight:700}}>{invFb}</div>}
          </div>
        </div>
      )}

      {actPopup&&(
        <div className="popup-overlay" onClick={()=>setActPopup(null)}>
          <div className="popup" style={{width:580}} onClick={e=>e.stopPropagation()}>
            <div className="popup-header">
              <span className="popup-title">Акт — {actPopup.sewer.name} — {actPopup.month}</span>
              <button className="popup-close" onClick={()=>setActPopup(null)}>×</button>
            </div>
            <div className="popup-body" style={{fontSize:13,lineHeight:1.7}}>
              <div style={{textAlign:'center',fontWeight:800,fontSize:16,marginBottom:4}}>Акт выполненных работ</div>
              <div style={{textAlign:'center',color:'#7A6A5A',fontWeight:600,marginBottom:16}}>
                {actPopup.inv?.invoice_num||'№ ___'} от «{MONTH_DATE[actPopup.month]?.split(' ')[0]||'__'}» {MONTH_SHORT[actPopup.month]||''} 2026 г. &nbsp; г. Тюмень
              </div>
              <p style={{marginBottom:8,fontWeight:600}}>Мы, нижеподписавшиеся:</p>
              <p style={{marginBottom:8}}><strong>{CUSTOMER.name}</strong>, ИНН {CUSTOMER.inn}, адрес: {CUSTOMER.address}</p>
              <p style={{marginBottom:16}}>
                и <strong>Самозанятое лицо {actPopup.sewer.full_name||actPopup.sewer.name}</strong>
                {actPopup.sewer.inn?`, ИНН ${actPopup.sewer.inn}`:''}
                {actPopup.sewer.address?`, адрес: ${actPopup.sewer.address}`:''}
              </p>
              <p style={{marginBottom:12,fontWeight:600}}>
                По договору № {actPopup.sewer.contract_num||'—'} от «{actPopup.sewer.contract_date?new Date(actPopup.sewer.contract_date).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'—'}» исполнитель выполнил услугу пошива аксессуара для волос (Кокошника).
              </p>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:12,fontSize:12}}>
                <thead>
                  <tr style={{background:'#F5F0E8'}}>
                    <th style={{textAlign:'left',padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700}}>Наименование</th>
                    <th style={{textAlign:'center',padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700}}>Кол-во, шт</th>
                    <th style={{textAlign:'right',padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700}}>Цена</th>
                    <th style={{textAlign:'right',padding:'6px 10px',border:'1px solid rgba(196,168,130,0.3)',fontWeight:700}}>Сумма</th>
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