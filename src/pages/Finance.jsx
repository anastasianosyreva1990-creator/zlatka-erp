import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')
const MONTHS = ['2026-01','2026-02','2026-03','2026-04']
const MONTH_NAMES = {'2026-01':'Январь 2026','2026-02':'Февраль 2026','2026-03':'Март 2026','2026-04':'Апрель 2026'}

const TARIFFS = { 'Марина С.': 140, 'Светлана Р.': 100, 'Анна Т.': 120, 'Анжела Т.': 105, 'Екатерина Ж.': 100 }

export default function Finance() {
  const [tab, setTab] = useState('pl')
  const [wbData, setWbData] = useState([])
  const [productions, setProductions] = useState([])
  const [sewers, setSewers] = useState([])
  const [selMonth, setSelMonth] = useState('2026-04')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: wb }, { data: pr }, { data: sw }] = await Promise.all([
      supabase.from('wb_monthly').select('*').order('month'),
      supabase.from('productions').select('*, sewers(name, tariff)'),
      supabase.from('sewers').select('*'),
    ])
    setWbData(wb || [])
    setProductions(pr || [])
    setSewers(sw || [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  const wb = wbData.find(d => d.month === selMonth) || {}
  const monthProds = productions.filter(p => p.date?.startsWith(selMonth))
  const salary = monthProds.reduce((a, p) => a + (p.quantity * (p.sewers?.tariff || 0)), 0)
  const units = monthProds.reduce((a, p) => a + p.quantity, 0)
  const matCost = units * 58
  const sdek = 8000
  const nalog = Math.round((wb.revenue || 0) * 0.06)
  const revenue = wb.revenue || 0
  const logSale = wb.log_sale || 0
  const logCancel = wb.log_cancel || 0
  const vv = wb.vv || 0
  const shtraf = wb.shtraf || 0
  const netWb = revenue - logSale - logCancel - vv - shtraf
  const profit = netWb - salary - matCost - sdek - nalog

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2E26' }}>Финансы / <span style={{ color: '#C4A882' }}>P&L</span></h1>
      </div>

      {/* Выбор месяца */}
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

      {/* Табы */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <TabBtn id="pl" label="P&L"/>
        <TabBtn id="unit" label="Юнит-экономика"/>
        <TabBtn id="salary" label="Зарплаты"/>
        <TabBtn id="forecast" label="Прогноз"/>
      </div>

      {/* P&L */}
      {tab === 'pl' && (
        <div>
          {/* Метрики */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Выручка WB', value: fmt(revenue) + ' ₽', color: '#1A6B28' },
              { label: 'Чистыми с WB', value: fmt(netWb) + ' ₽', color: '#1C2E26' },
              { label: 'Зарплаты', value: fmt(salary) + ' ₽', color: '#6A304A' },
              { label: 'Чистая прибыль', value: fmt(profit) + ' ₽', color: profit > 0 ? '#1A6B28' : '#6A304A' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '0.5px solid rgba(74,111,82,0.15)' }}>
                <div style={{ fontSize: 10, color: '#7A6A5A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Таблица P&L */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', fontWeight: 700, fontSize: 14, color: '#1C2E26' }}>
              P&L — {MONTH_NAMES[selMonth]}
            </div>
            {[
              { label: 'Выручка WB (к перечислению)', value: revenue, type: 'income' },
              { label: 'Логистика при продажах', value: -logSale, type: 'expense' },
              { label: 'Логистика при отменах', value: -logCancel, type: 'expense' },
              { label: 'Комиссия WB (ВВ)', value: -vv, type: 'expense' },
              { label: 'Штрафы WB', value: -shtraf, type: 'expense' },
              { label: 'Зарплаты швей', value: -salary, type: 'expense' },
              { label: 'Себестоимость материалов (~58₽/шт)', value: -matCost, type: 'expense' },
              { label: 'Доставка СДЭК на WB', value: -sdek, type: 'expense' },
              { label: 'Налог 6% УСН', value: -nalog, type: 'expense' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontSize: 13 }}>
                <span style={{ color: '#5A4A3A', fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontWeight: 800, color: row.type === 'income' ? '#1A6B28' : '#6A304A' }}>
                  {row.type === 'income' ? '+' : '−'} {fmt(Math.abs(row.value))} ₽
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', background: '#F5F0E8', fontSize: 15, fontWeight: 800 }}>
              <span style={{ color: '#1C2E26' }}>Чистая прибыль</span>
              <span style={{ color: profit > 0 ? '#1A6B28' : '#6A304A' }}>{profit > 0 ? '+' : '−'} {fmt(Math.abs(profit))} ₽</span>
            </div>
          </div>

          {/* История по месяцам */}
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', fontWeight: 700, fontSize: 14, color: '#1C2E26' }}>
              История по месяцам
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  {['Месяц', 'Выручка WB', 'Логистика', 'Комиссия ВВ', 'Красный', 'Белый', 'Чёрный', 'Цветной'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Месяц' ? 'left' : 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wbData.map(d => (
                  <tr key={d.month} style={{ background: d.month === selMonth ? 'rgba(196,168,130,0.08)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1C2E26', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{MONTH_NAMES[d.month]}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1A6B28', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(d.revenue)} ₽</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt((d.log_sale || 0) + (d.log_cancel || 0))} ₽</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6A304A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{fmt(d.vv || 0)} ₽</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{d.sold_red || 0}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{d.sold_white || 0}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{d.sold_black || 0}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{d.sold_color || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ЗАРПЛАТЫ */}
      {tab === 'salary' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', fontWeight: 700, fontSize: 14, color: '#1C2E26' }}>
              Зарплаты швей — {MONTH_NAMES[selMonth]}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  {['Швея', 'Тариф', 'Сдано', 'Начислено'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Швея' ? 'left' : 'right', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sewers.map(sw => {
                  const swProds = monthProds.filter(p => p.sewer_id === sw.id)
                  const qty = swProds.reduce((a, p) => a + p.quantity, 0)
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
                <tr style={{ background: '#F5F0E8' }}>
                  <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 800 }}>Итого</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1A6B28' }}>{fmt(salary)} ₽</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ЮНИТ-ЭКОНОМИКА */}
      {tab === 'unit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {[
            { color: 'Красный', dot: '#C0392B', sold: wb.sold_red, avg: wb.avg_red },
            { color: 'Белый', dot: '#95A5A6', sold: wb.sold_white, avg: wb.avg_white },
            { color: 'Чёрный', dot: '#2C3E50', sold: wb.sold_black, avg: wb.avg_black },
            { color: 'Цветной', dot: '#27AE60', sold: wb.sold_color, avg: wb.avg_color },
          ].map(sku => {
            const tariff = sku.color === 'Цветной' ? 105 : 130
            const mat = sku.color === 'Белый' ? 49 : sku.color === 'Цветной' ? 53 : 49
            const logAvg = 73
            const profit = (sku.avg || 0) - logAvg - mat - tariff - 12
            return (
              <div key={sku.color} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: sku.dot, display: 'inline-block' }}></span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: '#1C2E26' }}>{sku.color}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7A6A5A' }}>{sku.sold || 0} шт</span>
                </div>
                {[
                  { label: 'Ср. к перечислению WB', value: fmt(sku.avg || 0) + ' ₽', color: '#1A6B28' },
                  { label: 'Логистика (ср.)', value: '−' + fmt(logAvg) + ' ₽', color: '#6A304A' },
                  { label: 'Материалы', value: '−' + fmt(mat) + ' ₽', color: '#6A304A' },
                  { label: 'Зарплата швеи', value: '−' + fmt(tariff) + ' ₽', color: '#6A304A' },
                  { label: 'Упаковка+СДЭК', value: '−12 ₽', color: '#6A304A' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontSize: 12 }}>
                    <span style={{ color: '#5A4A3A' }}>{r.label}</span>
                    <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 14, fontWeight: 800 }}>
                  <span style={{ color: '#1C2E26' }}>Прибыль/шт</span>
                  <span style={{ color: profit > 0 ? '#1A6B28' : '#6A304A' }}>{profit > 0 ? '+' : ''}{fmt(profit)} ₽</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ПРОГНОЗ */}
      {tab === 'forecast' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', padding: '20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2E26', marginBottom: 16 }}>Прогноз на следующий месяц</div>
          <div style={{ fontSize: 13, color: '#7A6A5A' }}>На основе темпа апреля (~54 заказа/день × 30 дней = ~1620 заказов × 47% выкуп = ~761 выкуп)</div>
          <div style={{ marginTop: 16 }}>
            {[
              { label: 'Прогноз выкупов', value: '~761 шт' },
              { label: 'Прогноз выручки WB', value: '~' + fmt(761 * 510) + ' ₽' },
              { label: 'Прогноз логистики', value: '~' + fmt(761 * 73) + ' ₽' },
              { label: 'Прогноз зарплат', value: '~' + fmt(900 * 120) + ' ₽' },
              { label: 'Прогноз прибыли', value: '~' + fmt(761 * 510 - 761 * 73 - 900 * 120 - 900 * 58 - 8000 - Math.round(761 * 510 * 0.06)) + ' ₽' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontSize: 13 }}>
                <span style={{ color: '#5A4A3A', fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontWeight: 800, color: '#1C2E26' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
