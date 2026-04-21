import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')

const MAT_COST = {
  'Кокошник Красный': 0.0476*288.16 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Белый':   0.0476*286.50 + 0.2*17.03 + 2*0.92 + 30 + 1.19 + 10.90,
  'Кокошник Черный':  0.0476*289.77 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
  'Кокошник Цветной': 0.0555*365.83 + 0.2*20.09 + 2*0.83 + 30 + 1.19 + 10.90,
}

const WB_FACT = {
  revenue: 100787, log_sale: 15046, log_cancel: 7708,
  vv: 5064, shtraf: 50, reklama: 21607, units_sold: 204
}

const WB_STOCKS = {
  'Кокошник Красный': 53+48+58+48+92,
  'Кокошник Белый': 50+55+48+55+2,
  'Кокошник Черный': 5+5+2+5+2,
  'Кокошник Цветной': 0,
}

const BY_SKU = {
  'Кокошник Красный': { sold: 156, to_seller_avg: 506, log_avg: 76, price: 850, labor: 140 },
  'Кокошник Белый':   { sold: 6,   to_seller_avg: 545, log_avg: 77, price: 850, labor: 140 },
  'Кокошник Черный':  { sold: 41,  to_seller_avg: 443, log_avg: 71, price: 850, labor: 140 },
  'Кокошник Цветной': { sold: 1,   to_seller_avg: 481, log_avg: 47, price: 900, labor: 105 },
}

const PCOL = {
  'Кокошник Красный': '#E24B4A',
  'Кокошник Белый': '#888780',
  'Кокошник Черный': '#2C2C2A',
  'Кокошник Цветной': '#1D9E75'
}

export default function Finance() {
  const [stocks, setStocks] = useState([])
  const [materials, setMaterials] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [fcOrders, setFcOrders] = useState(1628)
  const [fcBuyout, setFcBuyout] = useState(47)
  const [fcProd, setFcProd] = useState(1200)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: st }, { data: mt }, { data: pu }] = await Promise.all([
      supabase.from('material_stock').select('*, materials(name, price_per_unit)'),
      supabase.from('materials').select('*'),
      supabase.from('purchases').select('*, materials(name)'),
    ])
    setStocks(st || [])
    setMaterials(mt || [])
    setPurchases(pu || [])
    setLoading(false)
  }

  // Заморозка
  const myMatVal = stocks
    .filter(s => s.location === 'warehouse')
    .reduce((a, s) => a + s.quantity * (s.materials?.price_per_unit || 0), 0)

  const swMatVal = stocks
    .filter(s => s.location !== 'warehouse' && s.location !== 'ready')
    .reduce((a, s) => a + s.quantity * (s.materials?.price_per_unit || 0), 0)

  const transitVal = purchases
    .filter(p => p.status === 'transit')
    .reduce((a, p) => a + p.total_sum, 0)

  const readyVal = stocks
    .filter(s => s.location === 'ready')
    .reduce((a, s) => a + s.quantity * 65, 0)

  const wbVal = Object.entries(WB_STOCKS)
    .reduce((a, [prod, qty]) => a + qty * (MAT_COST[prod] || 65), 0)

  const wbInTransitVal = 0 // из отгрузок со статусом В пути
  const totalFreeze = myMatVal + swMatVal + transitVal + readyVal + wbVal

  // Потенциальная выручка если всё продадут
  const avgProfit = 88
  const buyoutRate = 0.47
  const wbTotalQty = Object.values(WB_STOCKS).reduce((a, b) => a + b, 0)
  const potentialProfit = Math.round(wbTotalQty * buyoutRate * avgProfit)

  // P&L (экстраполяция на апрель)
  const mult = 1.43
  const aprRevenue = Math.round(WB_FACT.revenue * mult)
  const aprLog = Math.round((WB_FACT.log_sale + WB_FACT.log_cancel) * mult)
  const aprNet = aprRevenue - aprLog
  const salary = 149520
  const matCostMonth = 1172 * 58
  const sdek = 8000
  const reklama = 21607
  const vv = 5064
  const nalog = Math.round(aprRevenue * 0.06)
  const profit = aprNet - salary - matCostMonth - sdek - reklama - vv - WB_FACT.shtraf - nalog

  // Прогноз
  const fcSales = Math.round(fcOrders * fcBuyout / 100)
  const fcRevNet = fcSales * 430
  const fcMat = fcProd * 58
  const fcLabor = fcProd * 110
  const fcSdek = Math.ceil(fcProd / 100) * 800
  const fcRek = Math.round(fcOrders * 850 * 0.05)
  const fcNalog = Math.round(fcRevNet * 0.06)
  const fcProfit = fcRevNet - fcMat - fcLabor - fcSdek - fcRek - fcNalog

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Загрузка...</div>

  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'freeze', label: 'Заморозка' },
    { id: 'unit', label: 'Юнит-экономика' },
    { id: 'wb', label: 'Выплаты WB' },
    { id: 'forecast', label: 'Прогноз' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Златка <span style={{ color: '#5DCAA5' }}>/ Финансы</span></div>
      </div>

      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Выручка WB (апрель, оценка)', value: fmt(aprRevenue) + ' ₽', sub: 'к перечислению' },
          { label: 'Логистика WB', value: '− ' + fmt(aprLog) + ' ₽', color: '#E24B4A', sub: 'продажи + отмены' },
          { label: 'Чистая прибыль (оценка)', value: (profit > 0 ? '+' : '') + fmt(profit) + ' ₽', color: profit > 0 ? '#1D9E75' : '#E24B4A', sub: 'апрель 2026' },
          { label: 'Заморожено всего', value: fmt(Math.round(totalFreeze)) + ' ₽', sub: 'мат-лы + товар везде' },
        ].map((m, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: m.color || '#111' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '6px 16px', borderRadius: 20,
            border: activeTab === t.id ? '1px solid #5DCAA5' : '1px solid #e5e7eb',
            background: activeTab === t.id ? '#f0fdf8' : 'transparent',
            color: activeTab === t.id ? '#085041' : '#666',
            cursor: 'pointer', fontSize: 13
          }}>{t.label}</button>
        ))}
      </div>

      {/* ОБЗОР P&L */}
      {activeTab === 'overview' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
              P&L — Апрель 2026
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11', marginLeft: 8 }}>факт</span>
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#E6F1FB', color: '#185FA5', marginLeft: 4 }}>расчётный</span>
            </div>
            {[
              { label: 'Выручка WB (к перечислению)', value: fmt(aprRevenue) + ' ₽', color: '#1D9E75', tag: 'факт' },
              { label: 'Логистика при продажах', value: '− ' + fmt(Math.round(WB_FACT.log_sale * mult)) + ' ₽', color: '#E24B4A', tag: 'факт' },
              { label: 'Логистика при отменах', value: '− ' + fmt(Math.round(WB_FACT.log_cancel * mult)) + ' ₽', color: '#E24B4A', tag: 'факт' },
              { label: 'Комиссия WB (ВВ)', value: '− ' + fmt(vv) + ' ₽', color: '#E24B4A', tag: 'факт' },
              { label: 'Штрафы WB', value: '− ' + fmt(WB_FACT.shtraf) + ' ₽', color: '#E24B4A', tag: 'факт' },
              { label: 'Зарплата швеям', value: '− ' + fmt(salary) + ' ₽', color: '#E24B4A', tag: 'факт' },
              { label: 'Себестоимость материалов', value: '− ' + fmt(matCostMonth) + ' ₽', color: '#E24B4A', tag: 'расч.' },
              { label: 'Доставка СДЭК на WB', value: '− ' + fmt(sdek) + ' ₽', color: '#E24B4A', tag: 'расч.' },
              { label: 'Реклама/ДРР', value: '− ' + fmt(reklama) + ' ₽', color: '#E24B4A', tag: 'факт' },
              { label: 'Налог 6% УСН', value: '− ' + fmt(nalog) + ' ₽', color: '#E24B4A', tag: 'расч.' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: '#666' }}>
                  {r.label}
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: r.tag === 'факт' ? '#EAF3DE' : '#E6F1FB', color: r.tag === 'факт' ? '#3B6D11' : '#185FA5', marginLeft: 6 }}>{r.tag}</span>
                </span>
                <span style={{ fontWeight: 500, color: r.color }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 15, fontWeight: 600, borderTop: '2px solid #e5e7eb', marginTop: 4 }}>
              <span>Чистая прибыль</span>
              <span style={{ color: profit > 0 ? '#1D9E75' : '#E24B4A' }}>{profit > 0 ? '+' : ''}{fmt(profit)} ₽</span>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8, padding: '6px 10px', background: '#f9fafb', borderRadius: 6 }}>
              ⚠ Период отчёта WB: 24.03–12.04 (3 недели). Апрельские данные частичные — расчёт оценочный.
            </div>
          </div>
        </div>
      )}

      {/* ЗАМОРОЗКА */}
      {activeTab === 'freeze' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Материалы на моём складе', value: fmt(Math.round(myMatVal)) + ' ₽', sub: 'по закупочным ценам' },
              { label: 'Материалы у швей', value: fmt(Math.round(swMatVal)) + ' ₽', sub: 'по закупочным ценам' },
              { label: 'Материалы в пути', value: fmt(Math.round(transitVal)) + ' ₽', sub: 'заказы в пути' },
              { label: 'Готовые изделия (склад)', value: fmt(Math.round(readyVal)) + ' ₽', sub: 'по себестоимости' },
              { label: 'Товар на складах WB', value: fmt(Math.round(wbVal)) + ' ₽', sub: 'по себестоимости произв.' },
              { label: 'ИТОГО заморожено', value: fmt(Math.round(totalFreeze)) + ' ₽', sub: 'полная капитализация', accent: true },
            ].map((m, i) => (
              <div key={i} style={{ background: m.accent ? '#fff' : '#f9fafb', border: m.accent ? '1px solid #5DCAA5' : '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: m.accent ? '#1D9E75' : '#111' }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Потенциальная прибыль с текущих остатков WB</div>
            {Object.entries(WB_STOCKS).map(([prod, qty]) => {
              if (qty === 0) return null
              return (
                <div key={prod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#555' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOL[prod] }}></span>
                    {prod}: {fmt(qty)} шт
                  </span>
                  <span style={{ color: '#1D9E75' }}>~{fmt(Math.round(qty * buyoutRate * avgProfit))} ₽ ЧП</span>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, fontWeight: 600, borderTop: '1px solid #e5e7eb', marginTop: 6 }}>
              <span>Итого потенциальная ЧП</span>
              <span style={{ color: '#1D9E75' }}>~{fmt(potentialProfit)} ₽</span>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>При выкупе 47% · ср. ЧП 88 ₽/шт · выплата через 4 недели после реализации</div>
          </div>
        </div>
      )}

      {/* ЮНИТ-ЭКОНОМИКА */}
      {activeTab === 'unit' && (
        <div>
          <div style={{ fontSize: 12, color: '#888', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11', marginRight: 6 }}>факт</span> из отчёта WB (24.03–12.04) &nbsp;
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#E6F1FB', color: '#185FA5', marginRight: 6 }}>расч.</span> по нормативам
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {Object.entries(BY_SKU).map(([prod, d]) => {
              const matCost = MAT_COST[prod] || 60
              const cancelLogPerSale = Math.round(WB_FACT.log_cancel / WB_FACT.units_sold)
              const netWb = d.to_seller_avg - d.log_avg - cancelLogPerSale
              const prodCost = matCost + d.labor + 6 // 6₽ доля СДЭК
              const taxPerUnit = Math.round(d.to_seller_avg * 0.06)
              const unitProfit = netWb - prodCost - taxPerUnit
              const margin = (unitProfit / d.to_seller_avg * 100).toFixed(1)
              return (
                <div key={prod} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: PCOL[prod] }}></span>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{prod.replace('Кокошник ', '')}</span>
                  </div>
                  {[
                    { label: 'Цена на WB', value: fmt(d.price) + ' ₽', tag: null },
                    { label: 'WB к перечислению/шт', value: fmt(d.to_seller_avg) + ' ₽', tag: 'факт', color: '#1D9E75' },
                    { label: 'Логистика к покупателю', value: '− ' + fmt(d.log_avg) + ' ₽', tag: 'факт', color: '#E24B4A' },
                    { label: 'Логистика при отменах', value: '− ' + fmt(cancelLogPerSale) + ' ₽', tag: 'расч.', color: '#E24B4A' },
                    { label: 'Материалы + упаковка', value: '− ' + fmt(Math.round(matCost)) + ' ₽', tag: 'расч.', color: '#E24B4A' },
                    { label: 'Доставка СДЭК/шт', value: '− 6 ₽', tag: 'расч.', color: '#E24B4A' },
                    { label: 'Зарплата швеи', value: '− ' + fmt(d.labor) + ' ₽', tag: 'расч.', color: '#E24B4A' },
                    { label: 'Налог 6%', value: '− ' + fmt(taxPerUnit) + ' ₽', tag: 'расч.', color: '#E24B4A' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}>
                      <span style={{ color: '#666' }}>
                        {r.label}
                        {r.tag && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: r.tag === 'факт' ? '#EAF3DE' : '#E6F1FB', color: r.tag === 'факт' ? '#3B6D11' : '#185FA5', marginLeft: 4 }}>{r.tag}</span>}
                      </span>
                      <span style={{ color: r.color || '#111', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 16, fontWeight: 600, color: unitProfit > 0 ? '#1D9E75' : '#E24B4A' }}>
                    {unitProfit > 0 ? '+' : ''}{fmt(Math.round(unitProfit))} ₽/шт · {margin}% маржа
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ВЫПЛАТЫ WB */}
      {activeTab === 'wb' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>К перечислению (отчёт 24.03–12.04)</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{fmt(WB_FACT.revenue)} ₽</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>за 204 выкупа</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Чистыми (за вычетом логистики)</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1D9E75' }}>{fmt(WB_FACT.revenue - WB_FACT.log_sale - WB_FACT.log_cancel)} ₽</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>= {fmt(WB_FACT.revenue)} − {fmt(WB_FACT.log_sale)} − {fmt(WB_FACT.log_cancel)} ₽</div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Прогноз поступлений с WB — 3 месяца</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>На основе темпа апреля (~54 заказа/день · 47% выкуп)</div>
            {[
              { period: 'Реализация март (остаток)', payout: 'Апрель–май 2026', amount: Math.round(WB_FACT.revenue * 0.6) },
              { period: 'Реализация апрель (оценка)', payout: 'Май–июнь 2026', amount: Math.round(761 * 0.47 * 430) },
              { period: 'Реализация май (прогноз)', payout: 'Июнь–июль 2026', amount: Math.round(1628 * 0.47 * 430) },
              { period: 'Реализация июнь (прогноз)', payout: 'Июль–август 2026', amount: Math.round(1800 * 0.47 * 430) },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5DCAA5', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#111' }}>{r.payout}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>За: {r.period}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1D9E75' }}>~{fmt(r.amount)} ₽</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Структура выплаты WB на 1 шт (Красный, факт)</div>
            {[
              { label: 'Розничная цена', value: '808 ₽' },
              { label: 'WB реализовал (с платф. скидкой)', value: '556 ₽' },
              { label: 'К перечислению продавцу', value: '506 ₽', color: '#1D9E75' },
              { label: 'Логистика к покупателю', value: '− 76 ₽', color: '#E24B4A' },
              { label: 'Логистика при отменах (проп.)', value: '− 49 ₽', color: '#E24B4A' },
              { label: 'Комиссия ВВ', value: '− 28 ₽', color: '#E24B4A' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{r.label}</span>
                <span style={{ fontWeight: 500, color: r.color || '#111' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, fontWeight: 600, borderTop: '1px solid #e5e7eb', marginTop: 4 }}>
              <span>Итого на руки с 1 выкупа</span>
              <span style={{ color: '#1D9E75' }}>408 ₽</span>
            </div>
          </div>
        </div>
      )}

      {/* ПРОГНОЗ */}
      {activeTab === 'forecast' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Прогноз расходов на следующий месяц</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Заказов WB в месяц', val: fcOrders, set: setFcOrders },
                { label: '% выкупа', val: fcBuyout, set: setFcBuyout },
                { label: 'Произвести (шт)', val: fcProd, set: setFcProd },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{f.label}</div>
                  <input type="number" value={f.val} onChange={e => f.set(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} />
                </div>
              ))}
            </div>
            {[
              { label: 'Заказов', value: fmt(fcOrders) + ' шт' },
              { label: `Выкупов (~${fcBuyout}%)`, value: fmt(fcSales) + ' шт', accent: true },
              { label: 'Выручка чистая с WB', value: '+' + fmt(fcRevNet) + ' ₽', accent: true },
              { label: 'Себестоимость материалов', value: '− ' + fmt(fcMat) + ' ₽', neg: true },
              { label: 'Зарплата швеям', value: '− ' + fmt(fcLabor) + ' ₽', neg: true },
              { label: 'Доставка СДЭК на WB', value: '− ' + fmt(fcSdek) + ' ₽', neg: true },
              { label: 'Реклама (~5% ДРР)', value: '− ' + fmt(fcRek) + ' ₽', neg: true },
              { label: 'Налог 6%', value: '− ' + fmt(fcNalog) + ' ₽', neg: true },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{r.label}</span>
                <span style={{ fontWeight: 500, color: r.accent ? '#1D9E75' : r.neg ? '#E24B4A' : '#111' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 15, fontWeight: 600, borderTop: '2px solid #e5e7eb', marginTop: 4 }}>
              <span>Прогноз чистой прибыли</span>
              <span style={{ color: fcProfit > 0 ? '#1D9E75' : '#E24B4A' }}>{fmt(fcProfit)} ₽</span>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
              Нужно иметь денег на материалы и зарплату: <b>{fmt(fcMat + fcLabor)} ₽</b>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}