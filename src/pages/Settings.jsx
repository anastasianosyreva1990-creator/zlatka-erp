import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = x => Math.round(x).toLocaleString('ru-RU')

const DEFAULT_WHS = [
  {id:'ekb',name:'Екатеринбург',fo:'Уральский',wb_tariff:190,sdek_tariff:934,active:true},
  {id:'vlad',name:'Владимир',fo:'Центральный',wb_tariff:130,sdek_tariff:1354,active:true},
  {id:'voronezh',name:'Воронеж',fo:'Центральный',wb_tariff:130,sdek_tariff:1460,active:true},
  {id:'kotovsk',name:'Котовск',fo:'Центральный',wb_tariff:120,sdek_tariff:1565,active:true},
  {id:'novosem',name:'Новосемейкино',fo:'Приволжский',wb_tariff:160,sdek_tariff:1249,active:true},
  {id:'volgograd',name:'Волгоград',fo:'Южный',wb_tariff:170,sdek_tariff:1670,active:true},
  {id:'ryazan',name:'Рязань',fo:'Центральный',wb_tariff:130,sdek_tariff:1355,active:true},
]

const DEFAULT_PRODUCTS = [
  {name:'Кокошник Красный',label:'Красный',color_hex:'#C0392B'},
  {name:'Кокошник Белый',label:'Белый',color_hex:'#7F8C8D'},
  {name:'Кокошник Черный',label:'Чёрный',color_hex:'#2C3E50'},
  {name:'Кокошник Цветной',label:'Цветной',color_hex:'#27AE60'},
  {name:'Кокошник Ягоды',label:'Ягоды',color_hex:'#7D3C98'},
  {name:'Кокошник Петушки',label:'Петушки',color_hex:'#E67E22'},
]

const SQL_PRODUCTS = `CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT,
  color_hex TEXT DEFAULT '#888888',
  nm_id BIGINT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`

const SQL_PRODUCT_MATERIALS = `CREATE TABLE product_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  norm NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(product_id, material_id)
);`

const SQL_WH = `CREATE TABLE wb_warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fo TEXT,
  wb_tariff INTEGER DEFAULT 0,
  sdek_tariff INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`

export default function Settings() {
  const [tab, setTab] = useState('warehouses')
  const [loading, setLoading] = useState(true)
  const [fb, setFb] = useState('')

  // --- Склады ---
  const [warehouses, setWarehouses] = useState([])
  const [dbWh, setDbWh] = useState(false)
  const [editWh, setEditWh] = useState(null)
  const [editWhFields, setEditWhFields] = useState({})
  const [newWh, setNewWh] = useState(false)
  const [newWhFields, setNewWhFields] = useState({id:'',name:'',fo:'',wb_tariff:'',sdek_tariff:''})
  const [seedingWh, setSeedingWh] = useState(false)
  const [updatingTariffs, setUpdatingTariffs] = useState(false)

  // --- Артикулы ---
  const [products, setProducts] = useState([])
  const [dbProds, setDbProds] = useState(false)
  const [editProd, setEditProd] = useState(null)
  const [editProdFields, setEditProdFields] = useState({})
  const [newProd, setNewProd] = useState(false)
  const [newProdFields, setNewProdFields] = useState({name:'',label:'',color_hex:'#888888',nm_id:''})
  const [seedingProds, setSeedingProds] = useState(false)

  // --- Нормативы ---
  const [materials, setMaterials] = useState([])
  const [norms, setNorms] = useState([])
  const [dbNorms, setDbNorms] = useState(false)
  const [selProduct, setSelProduct] = useState('')
  const [normEdits, setNormEdits] = useState({})
  const [savingNorm, setSavingNorm] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadWarehouses(), loadProducts(), loadMaterials(), loadNorms()])
    setLoading(false)
  }

  async function loadWarehouses() {
    try {
      const { data, error } = await supabase.from('wb_warehouses').select('*').order('name')
      if (error) { setDbWh(false); setWarehouses(DEFAULT_WHS); return }
      setDbWh(true)
      setWarehouses(data?.length ? data : DEFAULT_WHS)
    } catch { setDbWh(false); setWarehouses(DEFAULT_WHS) }
  }

  async function loadProducts() {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name')
      if (error) { setDbProds(false); return }
      setDbProds(true)
      setProducts(data || [])
      if (data?.length > 0) setSelProduct(prev => prev || data[0].id)
    } catch { setDbProds(false) }
  }

  async function loadMaterials() {
    const { data } = await supabase.from('materials').select('*').order('name')
    setMaterials(data || [])
  }

  async function loadNorms() {
    try {
      const { data, error } = await supabase.from('product_materials').select('*, materials(name, unit)')
      if (error) { setDbNorms(false); return }
      setDbNorms(true)
      setNorms(data || [])
    } catch { setDbNorms(false) }
  }

  // --- CRUD: Склады ---
  async function seedWarehouses() {
    setSeedingWh(true); setFb('Создаём справочник складов...')
    let ok = 0
    for (const wh of DEFAULT_WHS) {
      const { error } = await supabase.from('wb_warehouses').upsert(wh, { onConflict: 'id' })
      if (!error) ok++
    }
    if (ok === DEFAULT_WHS.length) {
      setFb('✓ Справочник складов инициализирован')
      setDbWh(true)
      loadWarehouses()
    } else {
      setFb('Ошибка: таблица wb_warehouses не существует. Создайте через SQL выше.')
    }
    setSeedingWh(false)
    setTimeout(() => setFb(''), 3000)
  }

  async function saveWhEdit() {
    const { error } = await supabase.from('wb_warehouses').update({
      name: editWhFields.name, fo: editWhFields.fo,
      wb_tariff: parseInt(editWhFields.wb_tariff) || 0,
      sdek_tariff: parseInt(editWhFields.sdek_tariff) || 0,
      active: editWhFields.active !== false,
    }).eq('id', editWh.id)
    if (error) { setFb('Ошибка: ' + error.message); return }
    setFb('✓ Склад сохранён'); setEditWh(null); loadWarehouses()
    setTimeout(() => setFb(''), 2000)
  }

  async function addWarehouse() {
    if (!newWhFields.name) { setFb('Введите название склада'); return }
    const id = newWhFields.id || newWhFields.name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,'')
    const { error } = await supabase.from('wb_warehouses').insert({
      id, name: newWhFields.name, fo: newWhFields.fo || '',
      wb_tariff: parseInt(newWhFields.wb_tariff) || 0,
      sdek_tariff: parseInt(newWhFields.sdek_tariff) || 0,
      active: true,
    })
    if (error) { setFb('Ошибка: ' + error.message); return }
    setFb('✓ Склад добавлен'); setNewWh(false)
    setNewWhFields({id:'',name:'',fo:'',wb_tariff:'',sdek_tariff:''})
    loadWarehouses(); setTimeout(() => setFb(''), 2000)
  }

  async function updateWbTariffs() {
    setUpdatingTariffs(true)
    setFb('Загружаем тарифы WB...')
    const token = import.meta.env.VITE_WB_TOKEN
    const today = new Date().toISOString().split('T')[0]
    try {
      const r = await fetch(`https://common-api.wildberries.ru/api/v1/tariffs/box?date=${today}`, {
        headers: { 'Authorization': token }
      })
      if (!r.ok) { setFb('Ошибка WB API: ' + r.status); setUpdatingTariffs(false); return }
      const data = await r.json()
      const wbList = data?.response?.data?.warehouseList || []
      let updated = 0
      const skipped = []
      for (const wh of warehouses) {
        const match = wbList.find(w =>
          w.warehouseName.toLowerCase().includes(wh.name.toLowerCase())
        )
        if (!match) { skipped.push(wh.name); continue }
        const base = parseFloat(match.boxDeliveryBase.replace(',', '.')) || 0
        const liter = parseFloat(match.boxDeliveryLiter.replace(',', '.')) || 0
        const tariff = Math.round(base + liter * 0.8)
        const { error } = await supabase.from('wb_warehouses').update({ wb_tariff: tariff }).eq('id', wh.id)
        if (!error) updated++
      }
      if (skipped.length) {
        setFb(`✓ Обновлено ${updated} складов. Не найдены в API: ${skipped.join(', ')}`)
      } else {
        setFb(`✓ Тарифы WB обновлены: ${updated} складов`)
      }
      loadWarehouses()
    } catch(e) {
      setFb('Ошибка: ' + e.message)
    }
    setUpdatingTariffs(false)
    setTimeout(() => setFb(''), 6000)
  }

  async function toggleWhActive(wh) {
    await supabase.from('wb_warehouses').update({ active: !wh.active }).eq('id', wh.id)
    loadWarehouses()
  }

  // --- CRUD: Артикулы ---
  async function seedProducts() {
    setSeedingProds(true); setFb('Инициализируем артикулы...')
    let ok = 0
    for (const p of DEFAULT_PRODUCTS) {
      const { error } = await supabase.from('products').upsert(p, { onConflict: 'name' })
      if (!error) ok++
    }
    if (ok === DEFAULT_PRODUCTS.length) {
      setFb('✓ Артикулы инициализированы')
      setDbProds(true)
      loadProducts()
    } else {
      setFb('Ошибка: не удалось заполнить таблицу products.')
    }
    setSeedingProds(false)
    setTimeout(() => setFb(''), 3000)
  }

  async function saveProdEdit() {
    const { error } = await supabase.from('products').update({
      name: editProdFields.name,
      label: editProdFields.label,
      color_hex: editProdFields.color_hex || '#888888',
      nm_id: editProdFields.nm_id ? parseInt(editProdFields.nm_id) : null,
      active: editProdFields.active !== false,
    }).eq('id', editProd.id)
    if (error) { setFb('Ошибка: ' + error.message); return }
    setFb('✓ Артикул сохранён'); setEditProd(null); loadProducts()
    setTimeout(() => setFb(''), 2000)
  }

  async function addProduct() {
    if (!newProdFields.name) { setFb('Введите название артикула'); return }
    const { error } = await supabase.from('products').insert({
      name: newProdFields.name,
      label: newProdFields.label || newProdFields.name,
      color_hex: newProdFields.color_hex || '#888888',
      nm_id: newProdFields.nm_id ? parseInt(newProdFields.nm_id) : null,
      active: true,
    })
    if (error) { setFb('Ошибка: ' + error.message); return }
    setFb('✓ Артикул добавлен'); setNewProd(false)
    setNewProdFields({name:'',label:'',color_hex:'#888888',nm_id:''})
    loadProducts(); setTimeout(() => setFb(''), 2000)
  }

  async function toggleProdActive(prod) {
    await supabase.from('products').update({ active: !prod.active }).eq('id', prod.id)
    loadProducts()
  }

  // --- Нормативы ---
  async function saveNorm(productId, materialId, value) {
    const key = `${productId}_${materialId}`
    setSavingNorm(key)
    const normVal = parseFloat(value) || 0
    const existing = norms.find(n => n.product_id === productId && n.material_id === materialId)
    if (existing) {
      if (normVal === 0) {
        await supabase.from('product_materials').delete().eq('id', existing.id)
      } else {
        await supabase.from('product_materials').update({ norm: normVal }).eq('id', existing.id)
      }
    } else if (normVal > 0) {
      await supabase.from('product_materials').insert({ product_id: productId, material_id: materialId, norm: normVal })
    }
    await loadNorms()
    setSavingNorm(null)
  }

  const inp = { padding: '7px 10px', border: '1px solid rgba(74,111,82,0.25)', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box' }

  const TabBtn = ({ id, label }) => (
    <button onClick={() => { setTab(id); setFb('') }} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${tab === id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
      background: tab === id ? '#1C2E26' : 'transparent',
      color: tab === id ? '#C4A882' : '#4A3A2A'
    }}>{label}</button>
  )

  if (loading) return <div style={{ padding: 40, color: '#5A4A3A' }}>Загрузка...</div>

  const selectedProduct = products.find(p => p.id === selProduct)
  const productNorms = norms.filter(n => n.product_id === selProduct)

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2E26', marginBottom: 20 }}>
        Настройки / <span style={{ color: '#C4A882' }}>Справочники</span>
      </h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <TabBtn id="warehouses" label="Склады WB / СДЭК"/>
        <TabBtn id="products" label="Артикулы"/>
        <TabBtn id="norms" label="Нормативы материалов"/>
      </div>

      {fb && (
        <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 8,
          background: fb.startsWith('✓') ? '#D8EED8' : '#EED4DD',
          color: fb.startsWith('✓') ? '#1A4A28' : '#6A1030',
          fontSize: 12, fontWeight: 600 }}>
          {fb}
        </div>
      )}

      {/* ======= СКЛАДЫ WB / СДЭК ======= */}
      {tab === 'warehouses' && (
        <div>
          {!dbWh && (
            <div style={{ background: '#EED4DD', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6A1030' }}>
              <strong>Таблица wb_warehouses не найдена.</strong> Данные отображаются из встроенного справочника.
              Создайте таблицу в Supabase:
              <pre style={{ marginTop: 8, background: '#fff', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', color: '#1C2E26' }}>
                {SQL_WH}
              </pre>
              <button onClick={seedWarehouses} disabled={seedingWh} style={{ marginTop: 10, padding: '7px 16px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {seedingWh ? 'Инициализируем...' : 'Попробовать инициализировать'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#7A6A5A', fontWeight: 600 }}>
              {warehouses.length} складов · {warehouses.filter(w => w.active !== false).length} активных
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {dbWh && (
                <button onClick={updateWbTariffs} disabled={updatingTariffs} style={{ padding: '7px 14px', background: 'rgba(196,168,130,0.15)', color: '#6A4A10', border: '1px solid rgba(196,168,130,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: updatingTariffs ? 'not-allowed' : 'pointer' }}>
                  {updatingTariffs ? '⏳ Загружаем...' : '↓ Тарифы из WB'}
                </button>
              )}
              {dbWh && (
                <button onClick={() => setNewWh(true)} style={{ padding: '7px 16px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  + Добавить склад
                </button>
              )}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F5F0E8' }}>
                  {['Склад WB','ФО','Доставка до клиента, ₽/шт','СДЭК, ₽/партию','Статус',''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('₽') ? 'right' : 'left', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warehouses.map(wh => (
                  editWh?.id === wh.id ? (
                    <tr key={wh.id} style={{ background: 'rgba(196,168,130,0.06)' }}>
                      <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                        <input value={editWhFields.name||''} onChange={e=>setEditWhFields({...editWhFields,name:e.target.value})} style={{...inp,width:160}}/>
                      </td>
                      <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                        <input value={editWhFields.fo||''} onChange={e=>setEditWhFields({...editWhFields,fo:e.target.value})} style={{...inp,width:120}}/>
                      </td>
                      <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                        <input type="number" value={editWhFields.wb_tariff??''} onChange={e=>setEditWhFields({...editWhFields,wb_tariff:e.target.value})} style={{...inp,width:80,textAlign:'right'}}/>
                      </td>
                      <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                        <input type="number" value={editWhFields.sdek_tariff??''} onChange={e=>setEditWhFields({...editWhFields,sdek_tariff:e.target.value})} style={{...inp,width:80,textAlign:'right'}}/>
                      </td>
                      <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}></td>
                      <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap' }}>
                        <button onClick={saveWhEdit} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#1C2E26', color:'#C4A882', border:'none', cursor:'pointer', fontWeight:700, marginRight:6 }}>Сохранить</button>
                        <button onClick={()=>setEditWh(null)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'transparent', color:'#7A6A5A', border:'1px solid rgba(74,111,82,0.2)', cursor:'pointer', fontWeight:700 }}>Отмена</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={wh.id} style={{ opacity: wh.active===false ? 0.5 : 1 }}>
                      <td style={{ padding:'10px 14px', fontWeight:700, borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>{wh.name}</td>
                      <td style={{ padding:'10px 14px', color:'#7A6A5A', borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>{wh.fo}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>{fmt(wh.wb_tariff ?? wh.tariff ?? 0)} ₽</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>{fmt(wh.sdek_tariff ?? 0)} ₽</td>
                      <td style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:700,
                          background: wh.active!==false ? '#D8EED8' : '#EEE4C8',
                          color: wh.active!==false ? '#1A4A28' : '#6A4A10' }}>
                          {wh.active!==false ? 'Активен' : 'Отключён'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(74,111,82,0.07)', whiteSpace:'nowrap' }}>
                        {dbWh && (
                          <>
                            <button onClick={()=>{setEditWh(wh);setEditWhFields({name:wh.name,fo:wh.fo,wb_tariff:wh.wb_tariff??wh.tariff,sdek_tariff:wh.sdek_tariff,active:wh.active})}}
                              style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid rgba(196,168,130,0.4)', background:'rgba(196,168,130,0.1)', color:'#4A3A2A', cursor:'pointer', fontWeight:700, marginRight:4 }}>
                              ✎
                            </button>
                            <button onClick={()=>toggleWhActive(wh)}
                              style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid rgba(74,111,82,0.2)', background:'transparent', color:'#7A6A5A', cursor:'pointer', fontWeight:700 }}>
                              {wh.active!==false ? 'Откл.' : 'Вкл.'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10, fontSize:11, color:'#9A8878' }}>
            * Доставка до клиента — тариф WB за доставку покупателю (₽/шт, для 0.8л товара). Кнопка «↓ Тарифы из WB» загружает актуальные тарифы из API. СДЭК — стоимость партии от вас до склада WB.
          </div>
        </div>
      )}

      {/* ======= АРТИКУЛЫ ======= */}
      {tab === 'products' && (
        <div>
          {!dbProds && (
            <div style={{ background: '#EED4DD', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6A1030' }}>
              <strong>Таблица products не найдена.</strong> Создайте в Supabase:
              <pre style={{ marginTop: 8, background: '#fff', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', color: '#1C2E26' }}>
                {SQL_PRODUCTS}
              </pre>
              <button onClick={seedProducts} disabled={seedingProds} style={{ marginTop: 10, padding: '7px 16px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {seedingProds ? 'Заполняем...' : 'Инициализировать базовые артикулы'}
              </button>
            </div>
          )}

          {dbProds && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#7A6A5A', fontWeight: 600 }}>
                  {products.length} артикулов
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {products.length === 0 && (
                    <button onClick={seedProducts} disabled={seedingProds} style={{ padding: '7px 14px', background: 'rgba(196,168,130,0.15)', color: '#6A4A10', border: '1px solid rgba(196,168,130,0.4)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {seedingProds ? 'Заполняем...' : '↺ Заполнить базовыми'}
                    </button>
                  )}
                  <button onClick={() => { setNewProd(true); setNewProdFields({name:'',label:'',color_hex:'#888888',nm_id:''}) }}
                    style={{ padding: '7px 16px', background: '#1C2E26', color: '#C4A882', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + Добавить артикул
                  </button>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F5F0E8' }}>
                      {['Цвет','Название','Метка','nmId WB',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#4A3A2A', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(196,168,130,0.2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(prod => (
                      editProd?.id === prod.id ? (
                        <tr key={prod.id} style={{ background: 'rgba(196,168,130,0.06)' }}>
                          <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                            <input type="color" value={editProdFields.color_hex||'#888888'}
                              onChange={e=>setEditProdFields({...editProdFields,color_hex:e.target.value})}
                              style={{ width:36, height:30, padding:2, border:'1px solid rgba(74,111,82,0.25)', borderRadius:6, cursor:'pointer' }}/>
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                            <input value={editProdFields.name||''} onChange={e=>setEditProdFields({...editProdFields,name:e.target.value})} style={{...inp,width:180}}/>
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                            <input value={editProdFields.label||''} onChange={e=>setEditProdFields({...editProdFields,label:e.target.value})} style={{...inp,width:100}}/>
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                            <input type="number" value={editProdFields.nm_id||''} onChange={e=>setEditProdFields({...editProdFields,nm_id:e.target.value})} style={{...inp,width:120}}/>
                          </td>
                          <td style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap' }}>
                            <button onClick={saveProdEdit} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#1C2E26', color:'#C4A882', border:'none', cursor:'pointer', fontWeight:700, marginRight:6 }}>Сохранить</button>
                            <button onClick={()=>setEditProd(null)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'transparent', color:'#7A6A5A', border:'1px solid rgba(74,111,82,0.2)', cursor:'pointer', fontWeight:700 }}>Отмена</button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={prod.id} style={{ opacity: prod.active===false ? 0.5 : 1 }}>
                          <td style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>
                            <span style={{ width:22, height:22, borderRadius:'50%', background:prod.color_hex||'#888', display:'inline-block', border:'1px solid rgba(0,0,0,0.1)', verticalAlign:'middle' }}></span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight:700, borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{prod.name}</td>
                          <td style={{ padding: '10px 14px', color:'#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)' }}>{prod.label||'—'}</td>
                          <td style={{ padding: '10px 14px', color:'#7A6A5A', borderBottom: '0.5px solid rgba(74,111,82,0.07)', fontFamily:'monospace', fontSize:12 }}>
                            {prod.nm_id ? prod.nm_id : <span style={{ color:'#C4B8A8', fontStyle:'italic', fontFamily:'inherit' }}>не задан</span>}
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(74,111,82,0.07)', whiteSpace: 'nowrap' }}>
                            <button onClick={()=>{setEditProd(prod);setEditProdFields({name:prod.name,label:prod.label||'',color_hex:prod.color_hex||'#888888',nm_id:prod.nm_id||'',active:prod.active})}}
                              style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid rgba(196,168,130,0.4)', background:'rgba(196,168,130,0.1)', color:'#4A3A2A', cursor:'pointer', fontWeight:700 }}>
                              ✎
                            </button>
                          </td>
                        </tr>
                      )
                    ))}
                    {products.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#7A6A5A' }}>Нет артикулов</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:10, fontSize:11, color:'#9A8878' }}>
                * nmId WB — артикул товара в системе Wildberries. Используется для автоматического обновления данных.
              </div>
            </>
          )}
        </div>
      )}

      {/* ======= НОРМАТИВЫ МАТЕРИАЛОВ ======= */}
      {tab === 'norms' && (
        <div>
          {!dbNorms && (
            <div style={{ background: '#EED4DD', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6A1030' }}>
              <strong>Таблица product_materials не найдена.</strong> Создайте в Supabase:
              <pre style={{ marginTop: 8, background: '#fff', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', color: '#1C2E26' }}>
                {SQL_PRODUCT_MATERIALS}
              </pre>
            </div>
          )}

          {!dbProds && (
            <div style={{ background: '#EEE4C8', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#6A4A10' }}>
              ⓘ Сначала создайте таблицу products и добавьте артикулы на вкладке «Артикулы».
            </div>
          )}

          {dbProds && products.length === 0 && (
            <div style={{ background: '#EEE4C8', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#6A4A10' }}>
              ⓘ Добавьте артикулы на вкладке «Артикулы», затем вернитесь сюда.
            </div>
          )}

          {dbProds && products.length > 0 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#7A6A5A', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Выберите артикул
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {products.filter(p => p.active !== false).map(p => (
                    <button key={p.id} onClick={() => setSelProduct(p.id)} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${selProduct===p.id ? '#1C2E26' : 'rgba(74,111,82,0.2)'}`,
                      background: selProduct===p.id ? '#1C2E26' : 'transparent',
                      color: selProduct===p.id ? '#C4A882' : '#4A3A2A',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:p.color_hex||'#888', flexShrink:0 }}></span>
                      {p.label || p.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedProduct && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(74,111,82,0.15)', overflow: 'auto' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(196,168,130,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width:14, height:14, borderRadius:'50%', background:selectedProduct.color_hex||'#888', display:'inline-block' }}></span>
                    <span style={{ fontWeight:800, fontSize:14, color:'#1C2E26' }}>
                      Нормативы для: {selectedProduct.name}
                    </span>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'#9A8878' }}>
                      {productNorms.filter(n => n.norm > 0).length} материалов задано
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F5F0E8' }}>
                        <th style={{ padding:'9px 14px', textAlign:'left', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)' }}>Материал</th>
                        <th style={{ padding:'9px 14px', textAlign:'left', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)' }}>Ед.</th>
                        <th style={{ padding:'9px 10px', textAlign:'right', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap' }}>Норма на 1 шт</th>
                        <th style={{ padding:'9px 14px', textAlign:'right', color:'#4A3A2A', fontWeight:700, fontSize:11, borderBottom:'1px solid rgba(196,168,130,0.2)', whiteSpace:'nowrap' }}>Выход из 1 ед.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map(mat => {
                        const norm = productNorms.find(n => n.material_id === mat.id)
                        const editKey = `${selProduct}_${mat.id}`
                        const isEditing = normEdits[editKey] !== undefined
                        const displayVal = isEditing ? normEdits[editKey] : (norm?.norm > 0 ? norm.norm : '')
                        const isSaving = savingNorm === editKey
                        const hasValue = norm?.norm > 0
                        return (
                          <tr key={mat.id} style={{ background: hasValue ? '#FAFFF8' : 'transparent' }}>
                            <td style={{ padding:'8px 14px', fontWeight: hasValue ? 700 : 400, color: hasValue ? '#1C2E26' : '#7A6A5A', borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>{mat.name}</td>
                            <td style={{ padding:'8px 14px', color:'#7A6A5A', borderBottom:'0.5px solid rgba(74,111,82,0.07)', fontSize:12 }}>{mat.unit}</td>
                            <td style={{ padding:'6px 10px', textAlign:'right', borderBottom:'0.5px solid rgba(74,111,82,0.07)' }}>
                              <input
                                type="number" step="0.0001" min="0"
                                value={displayVal}
                                placeholder="0"
                                disabled={!dbNorms}
                                onChange={e => setNormEdits({...normEdits, [editKey]: e.target.value})}
                                onBlur={() => {
                                  if (normEdits[editKey] !== undefined) {
                                    saveNorm(selProduct, mat.id, normEdits[editKey])
                                    const n = {...normEdits}; delete n[editKey]; setNormEdits(n)
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    saveNorm(selProduct, mat.id, normEdits[editKey] ?? norm?.norm ?? 0)
                                    const n = {...normEdits}; delete n[editKey]; setNormEdits(n)
                                    e.target.blur()
                                  }
                                }}
                                style={{ width:110, padding:'4px 8px', border:`1px solid ${isEditing ? '#1C2E26' : 'rgba(74,111,82,0.25)'}`, borderRadius:6, fontSize:13, textAlign:'right', background: isSaving ? '#F5F0E8' : '#fff' }}
                              />
                            </td>
                            <td style={{ padding:'8px 14px', textAlign:'right', borderBottom:'0.5px solid rgba(74,111,82,0.07)', color:'#7A6A5A', fontSize:12 }}>
                              {norm?.norm > 0 ? `${(1/norm.norm).toFixed(1)} шт` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ padding:'10px 14px', fontSize:11, color:'#9A8878' }}>
                    * Введите норму расхода на 1 изделие. Нажмите Enter или кликните вне поля — сохранится автоматически. Поставьте 0 чтобы убрать норму.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ПОПАП — НОВЫЙ СКЛАД */}
      {newWh && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=>setNewWh(false)}>
          <div style={{ background:'#fff', borderRadius:16, width:440, padding:'24px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'#1C2E26' }}>Добавить склад WB</span>
              <button onClick={()=>setNewWh(false)} style={{ fontSize:20, background:'none', border:'none', cursor:'pointer', color:'#7A6A5A' }}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>Название склада WB</div>
                <input value={newWhFields.name} onChange={e=>setNewWhFields({...newWhFields,name:e.target.value})} placeholder="Новосибирск" style={inp}/>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>Федеральный округ</div>
                <input value={newWhFields.fo} onChange={e=>setNewWhFields({...newWhFields,fo:e.target.value})} placeholder="Сибирский" style={inp}/>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>ID (латиницей)</div>
                <input value={newWhFields.id} onChange={e=>setNewWhFields({...newWhFields,id:e.target.value})} placeholder="novosib" style={inp}/>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>Тариф WB, ₽/л·30</div>
                <input type="number" value={newWhFields.wb_tariff} onChange={e=>setNewWhFields({...newWhFields,wb_tariff:e.target.value})} placeholder="150" style={inp}/>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>СДЭК, ₽/партию</div>
                <input type="number" value={newWhFields.sdek_tariff} onChange={e=>setNewWhFields({...newWhFields,sdek_tariff:e.target.value})} placeholder="1500" style={inp}/>
              </div>
            </div>
            <button onClick={addWarehouse} style={{ width:'100%', padding:'10px', background:'#1C2E26', color:'#C4A882', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Добавить
            </button>
          </div>
        </div>
      )}

      {/* ПОПАП — НОВЫЙ АРТИКУЛ */}
      {newProd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=>setNewProd(false)}>
          <div style={{ background:'#fff', borderRadius:16, width:460, padding:'24px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'#1C2E26' }}>Новый артикул</span>
              <button onClick={()=>setNewProd(false)} style={{ fontSize:20, background:'none', border:'none', cursor:'pointer', color:'#7A6A5A' }}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>Название (полное)</div>
                <input value={newProdFields.name} onChange={e=>setNewProdFields({...newProdFields,name:e.target.value})} placeholder="Кокошник Ягоды" style={inp}/>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>Метка (краткая)</div>
                <input value={newProdFields.label} onChange={e=>setNewProdFields({...newProdFields,label:e.target.value})} placeholder="Ягоды" style={inp}/>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>Цвет</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={newProdFields.color_hex}
                    onChange={e=>setNewProdFields({...newProdFields,color_hex:e.target.value})}
                    style={{ width:38, height:36, padding:2, border:'1px solid rgba(74,111,82,0.25)', borderRadius:6, cursor:'pointer', flexShrink:0 }}/>
                  <input value={newProdFields.color_hex} onChange={e=>setNewProdFields({...newProdFields,color_hex:e.target.value})}
                    placeholder="#7D3C98" style={{...inp, fontFamily:'monospace', fontSize:12}}/>
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'#7A6A5A', fontWeight:700, marginBottom:4 }}>nmId WB</div>
                <input type="number" value={newProdFields.nm_id} onChange={e=>setNewProdFields({...newProdFields,nm_id:e.target.value})}
                  placeholder="добавить позже" style={inp}/>
              </div>
            </div>
            <div style={{ fontSize:11, color:'#9A8878', marginBottom:14 }}>
              После добавления задайте нормативы материалов на вкладке «Нормативы материалов».
            </div>
            <button onClick={addProduct} style={{ width:'100%', padding:'10px', background:'#1C2E26', color:'#C4A882', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
