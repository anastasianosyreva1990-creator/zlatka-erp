import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')

const MONTHS = ['2026-01','2026-02','2026-03','2026-04']
const MONTH_NAMES = {'2026-01':'Январь 2026','2026-02':'Февраль 2026','2026-03':'Март 2026','2026-04':'Апрель 2026'}
const COLOR_DOT = {'Красный':'#C0392B','Белый':'#95A5A6','Черный':'#2C3E50','Цветной':'#27AE60'}
const COLOR_PROD = {'Красный':'Кокошник Красный','Белый':'Кокошник Белый','Черный':'Кокошник Черный','Цветной':'Кокошник Цветной'}
const COLOR_KEY = {'Красный':'red','Белый':'white','Черный':'black','Цветной':'color'}

const MAT = {
  'Кокошник Красный': 0.0476*288.16 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Белый':   0.0476*286.50 + 0.2*17.03 + 2*0.92 + 30 + 1.19 + 10.90,
  'Кокошник Черный':  0.0476*289.77 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Цветной': 0.0555*365.83 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
}
const BOX_COST = 77.25
const SDEK_RATES = {
  'Владимир':1354,'Котовск':1565,'Воронеж':1460,'Рязань':1355,
  'Невинномысск':2690,'Волгоград':1670,'Екатеринбург':934,
  'Новосемейкино':1249,'Сарапул':1459
}
const BUYOUT = 0.47

export default function Finance() {
  const [tab, setTab] = useState('unit')
  const [wbData, setWbData] = useState([])
  const [productions, setProductions] = useState([])
  const [sewers, setSewers] = useState([])
  const [shipments, setShipments] = useState([])
  const [wbStocks, setWbStocks] = useState([])
  const [dbPayouts, setDbPayouts] = useState([])
  const [selMonth, setSelMonth] = useState('2026-04')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: wb }, { data: pr }, { data: sw }, { data: sh }, { data: st }, { data: py }] = await Promise.all([
      supabase.from('wb_monthly').select('*').order('month'),
      supabase.from('productions').select('*, sewers(name, tariff)'),
      supabase.from('sewers').select('*'),
      supabase.from('shipments').select('*').order('ship_date'),
      supabase.from('wb_stocks').select('*'),
      supabase.from('wb_payouts').select('*').order('payout_date'),
    ])
    setWbData(wb || [])
    setProductions(pr || [])
    setSewers(sw || [])
    setShipments(sh || [])
    setWbStocks(st || [])
    setDbPayouts(py || [])
    setLoading(false)
  }

  function calcSdekPerUnit(month) {
    const ms = shipments.filter(s => s.ship_date?.startsWith(month))
    if (!ms.length) return 0
    const inv = {}
    ms.forEach(s => {
      const k = s.invoice_num || s.wb_supply_num || s.id
      if (!inv[k]) inv[k] = { warehouse: s.warehouse, qty: 0 }
      inv[k].qty += s.quantity
    })
    let totalCost = 0, totalQty = 0
    Object.values(inv).forEach(i => {
      totalCost += (SDEK_RATES[i.warehouse] || 1400) + BOX_COST * Math.ceil(i.qty / 96)
      totalQty += i.qty
    })
    return totalQty > 0 ? totalCost / totalQty : 0
  }

  function calcTariffPerUnit(month, product) {
    const prods = productions.filter(p => p.date?.startsWith(month) && p.product === product)
    const totalQty = prods.reduce((a, p) => a + p.quantity, 0)
    if (totalQty === 0) return 120
    return prods.reduce((a, p) => a + p.quantity * (p.sewers?.tariff || 120), 0) / totalQty
  }

  function calcUnit(month, color) {
    const wb = wbData.find(d => d.month === month) || {}
    const prod = COLOR_PROD[color]
    const key = COLOR_KEY[color]
    const sold = wb[`sold_${key}`] || 0
    const totalSold = (wb.sold_red||0)+(wb.sold_white||0)+(wb.sold_black||0)+(wb.sold_color||0)
    const avgRevenue = wb[`avg_${key}`] || 0
    const logSalePerUnit = totalSold > 0 ? (wb.log_sale||0) / totalSold : 0
    const logCancelPerUnit = totalSold > 0 ? (wb.log_cancel||0) / totalSold : 0
    const mat = MAT[prod] || 63
    const sdek = calcSdekPerUnit(month)
    const tariff = calcTariffPerUnit(month, prod)
    const nalog = avgRevenue * 0.06
    const profitPerUnit = avgRevenue - logSalePerUnit - logCancelPerUnit - mat - sdek - tariff - nalog
    return { sold, avgRevenue, logSalePerUnit, logCancelPerUnit, mat, sdek, tariff, nalog, profitPerUnit, totalProfit: profitPerUnit * sold }
  }

  function buildPayouts() {
    const today = new Date()
    const result = []

    // ФАКТ — группируем по дате выплаты и суммируем
    const grouped = {}
    dbPayouts.forEach(p => {
      const d = p.payout_date
      if (!grouped[d]) grouped[d] = { amount: 0, periods: [] }
      grouped[d].amount += p.net_amount
      grouped[d].periods.push(`${p.period_start}—${p.period_end}`)
    })
    Object.entries(grouped).forEach(([date, data]) => {
      if (data.amount <= 0) return
      result.push({
        date: new Date(date),
        amount: Math.round(data.amount),
        type: 'fact',
        period: data.periods.join(', ')
      })
    })

    // РАСЧЁТ — прогноз на 2 месяца вперёд по неделям
    const lastWb = wbData[wbData.length - 1] || {}
    const lastSold = (lastWb.sold_red||0)+(lastWb.sold_white||0)+(lastWb.sold_black||0)+(lastWb.sold_color||0)
    const lastNet = (lastWb.revenue||0) - (lastWb.log_sale||0) - (lastWb.log_cancel||0)
    const avgNetPerUnit = lastSold > 0 ? lastNet / lastSold : 400
    const avgDailySales = 25
    const weeklyNet = Math.round(avgDailySales * 7 * avgNetPerUnit)

    // Ближайший понедельник + 35 дней
    let d = new Date(today)
    const dow = d.getDay()
    d.setDate(d.getDate() + (dow === 1 ? 7 : (8 - dow) % 7))
    d.setDate(d.getDate() + 35)

    for (let i = 0; i < 8; i++) {
      const date = new Date(d)
      date.setDate(date.getDate() + i * 7)
      if (date > new Date(today.getTime() + 65 * 24 * 60 * 60 * 1000)) break
      result.push({
        date,
        amount: weeklyNet,
        type: 'calc',
        period: `~${avgDailySales * 7} выкупов × ${fmt(Math.round(avgNetPerUnit))} ₽/шт`
      })
    }

    return result.sort((a, b) => a.date - b.date)
  }

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  const wb = wbData.find(d => d.month === selMonth) || {}
  const totalSold = (wb.sold_red||0)+(wb.sold_white||0)+(wb.sold_black||0)+(wb.sold_color||0)
  const monthProfit = ['Красный','Белый','Черный','Цветной'].map(c => calcUnit(selMonth, c)).reduce((a, u) => a + u.totalProfit, 0)
  const wbStockProfit = wbStocks.reduce((a, s) => {
    const color = s.product?.replace('Кокошник ', '')
    if (!color || !COLOR_DOT[color]) return a
    const u = calcUnit(selMonth, color)
    return a + s.quantity * BUYOUT * u.profitPerUnit
  }, 0)
  const payouts = buildPayouts()

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${tab === id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
      background: tab === id ? '#1C2E26' : 'transparent',
      color: tab === id ? '#C4A882' : '#4A3A2A'
    }}>{label}</button>
  )

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2E26', marginBottom: 20 }}>
        Финансы / <span style={{ color: '#C4A882' }}>Юнит-экономика</span>
      </h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {MONTHS.map(m => (
          <button key={m} onClick={() => setSelMonth(m)} style={{
            padding: '5px 14px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${selMonth === m ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
            background: selMonth === m ? '#1C2E26' : 'transparent',
            color: selMonth === m ? '#C4A882' : '#4A3A2A'
          }}>{MONTH_NAMES[m]}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <TabBtn id="unit" label="Юнит-экономика"/>
        <TabBtn id="payout" label="Выплаты WB"/>
        <TabBtn id="salary" label="Зарплаты"/>
        <TabBtn id="history" label="История"/>
      </div>

      {tab === 'unit' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Выкупов за месяц', value: fmt(totalSold) + ' шт', color: '#1C2E26' },
              { label: 'Выручка с WB', value: fmt(wb.revenue || 0) + ' ₽', color: '#1A6B28' },
              { label: 'Прибыль за месяц', value: (monthProfit >= 0 ? '+' : '') + fmt(monthProfit) + ' ₽', color: monthProfit >= 0 ? '#1A6B28' : '#6A304A' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid rgba(74,111,82,0.15)' }}>
                <div style={{ fontSize: 10, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
            {['Красный','Белый','Черный','Цветной'].map(color => {
              const u = calcUnit(selMonth, color)
              if (u.sold === 0 && u.avgRevenue === 0) return null
              return (
                <div key={color} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_DOT[color], display: 'inline-block' }}></span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#1C2E26' }}>{color}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#7A6A5A' }}>{u.sold} шт</span>
                  </div>
                  {[
                    { label: 'Выручка с WB/шт', value: fmt(u.avgRevenue), color: '#1A6B28', bold: true },
                    { label: 'Логистика к покупателю', value: '−' + fmt(u.logSalePerUnit), color: '#6A304A' },
                    { label: 'Логистика при отменах', value: '−' + fmt(u.logCancelPerUnit), color: '#6A304A' },
                    { label: 'Материалы + упаковка', value: '−' + fmt(u.mat), color: '#6A304A' },
                    { label: 'СДЭК до WB', value: '−' + fmt(u.sdek), color: '#6A304A' },
                    { label: 'Зарплата швеи', value: '−' + fmt(u.tariff), color: '#6A304A' },
                    { label: 'Налог 6%', value: '−' + fmt(u.nalog), color: '#6A304A' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(74,111,82,0.06)', fontSize: 12 }}>
                      <span style={{ color: '#5A4A3A', fontWeight: 600 }}>{r.label}</span>
                      <span style={{ fontWeight: r.bold ? 800 : 700, color: r.color }}>{r.value} ₽</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: u.profitPerUnit >= 0 ? '#D8EED8' : '#EED4DD' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
                      <span style={{ color: '#1C2E26' }}>Прибыль/шт</span>
                      <span style={{ color: u.profitPerUnit >= 0 ? '#1A6B28' : '#6A304A' }}>
                        {u.profitPerUnit >= 0 ? '+' : ''}{fmt(u.profitPerUnit)} ₽
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: '#5A4A3A', fontWeight: 600 }}>За месяц ({u.sold} шт)</span>
                      <span style={{ fontWeight: 800, color: u.totalProfit >= 0 ? '#1A6B28' : '#6A304A' }}>
                        {u.totalProfit >= 0 ? '+' : ''}{fmt(u.totalProfit)} ₽
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', padding: '16px 18px' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1C2E26', marginBottom: 12 }}>
              Прогноз прибыли с текущих остатков на WB
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
              {['Красный','Белый','Черный','Цветной'].map(color => {
                const prod = 'Кокошник ' + color
                const totalStock = wbStocks.filter(s => s.product === prod).reduce((a, s) => a + s.quantity, 0)
                const u = calcUnit(selMonth, color)
                const expected = Math.round(totalStock * BUYOUT * u.profitPerUnit)
                return (
                  <div key={color} style={{ background: '#F5F0E8', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_DOT[color] }}></span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1C2E26' }}>{color}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7A6A5A' }}>{totalStock} шт × {Math.round(BUYOUT*100)}%</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: expected >= 0 ? '#1A6B28' : '#6A304A', marginTop: 2 }}>
                      {expected >= 0 ? '+' : ''}{fmt(expected)} ₽
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#1C2E26', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F2EBE0' }}>Итого ожидаемая прибыль</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#C4A882' }}>{wbStockProfit >= 0 ? '+' : ''}{fmt(wbStockProfit)} ₽</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'payout' && (
        <div>
          <div style={{ background: '#EEE4C8', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6A4A10', fontWeight: 600 }}>
            💡 Факт — из еженедельных отчётов WB (выручка − логистика). Расчёт — прогноз на 2 месяца по среднему темпу продаж. Деньги приходят каждый понедельник.
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', fontWeight: 700, fontSize: 14, color: '#1C2E26' }}>
              График выплат WB
            </div>
            <div style={{ padding: '8px 0' }}>
              {payouts.map((p, i) => {
                const dateStr = p.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                const isFact = p.type === 'fact'
                const isPast = p.date < new Date()
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', opacity: isPast ? 0.6 : 1 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isFact ? '#1A6B28' : '#C4A882', flexShrink: 0 }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2E26' }}>{dateStr}</div>
                      <div style={{ fontSize: 11, color: '#7A6A5A', marginTop: 1 }}>{p.period}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1A6B28' }}>+{fmt(p.amount)} ₽</div>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, fontWeight: 700,
                        background: isFact ? '#D8EED8' : '#EEE4C8',
                        color: isFact ? '#1A4A28' : '#6A4A10' }}>
                        {isFact ? 'факт' : 'расчёт'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'salary' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', fontWeight: 700, fontSize: 14, color: '#1C2E26' }}>
            Зарплаты швей — {MONTH_NAMES[selMonth]}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F5F0E8' }}>
                {['Швея','Тариф','Сдано','Начислено'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Швея' ? 'left' : 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sewers.map(sw => {
                const prods = productions.filter(p => p.date?.startsWith(selMonth) && p.sewer_id === sw.id)
                const qty = prods.reduce((a, p) => a + p.quantity, 0)
                const earned = qty * sw.tariff
                return (
                  <tr key={sw.id}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{sw.name}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{sw.tariff} ₽/шт</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(qty)} шт</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1A6B28', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(earned)} ₽</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'auto' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', fontWeight: 700, fontSize: 14, color: '#1C2E26' }}>
            История по месяцам
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#F5F0E8' }}>
                {['Месяц','Выкупов','Выручка WB','Логистика','Зарплаты','Материалы','СДЭК','Налог','Прибыль'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Месяц' ? 'left' : 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wbData.map(d => {
                const mProds = productions.filter(p => p.date?.startsWith(d.month))
                const mSalary = mProds.reduce((a, p) => a + p.quantity * (p.sewers?.tariff || 0), 0)
                const mMat = mProds.reduce((a, p) => a + (MAT[p.product] || 63) * p.quantity, 0)
                const ms = shipments.filter(s => s.ship_date?.startsWith(d.month))
                const inv = {}
                ms.forEach(s => { const k = s.invoice_num||s.id; if(!inv[k]) inv[k]={warehouse:s.warehouse,qty:0}; inv[k].qty+=s.quantity })
                const mSdek = Object.values(inv).reduce((a, i) => a + (SDEK_RATES[i.warehouse]||1400) + BOX_COST*Math.ceil(i.qty/96), 0)
                const mRev = d.revenue || 0
                const mLog = (d.log_sale||0)+(d.log_cancel||0)
                const mNalog = Math.round(mRev * 0.06)
                const mSold = (d.sold_red||0)+(d.sold_white||0)+(d.sold_black||0)+(d.sold_color||0)
                const mProfit = mRev - mLog - (d.vv||0) - mSalary - mMat - mSdek - mNalog
                return (
                  <tr key={d.month} style={{ background: d.month === selMonth ? 'rgba(196,168,130,0.08)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1C2E26', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{MONTH_NAMES[d.month]}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{mSold}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#1A6B28', fontWeight: 800, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(mRev)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(mLog)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(mSalary)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(mMat)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(mSdek)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(mNalog)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: mProfit >= 0 ? '#1A6B28' : '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                      {mProfit >= 0 ? '+' : ''}{fmt(mProfit)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}