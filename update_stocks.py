import os, requests
from datetime import datetime, timedelta
from supabase import create_client

SUPABASE_URL = 'https://eqakagcbrzqfbsrgzaeh.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYWthZ2NicnpxZmJzcmd6YWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTQ4NzgsImV4cCI6MjA5MTk5MDg3OH0.Hgv8sVv4lctRLzxbrsvYt8kg-IRKVeRMjXl6fq9Ytew'

WB_TOKEN = os.environ.get('WB_TOKEN')
if not WB_TOKEN:
    try:
        for line in open('/workspaces/zlatka-erp/.env').readlines():
            if line.startswith('VITE_WB_TOKEN='):
                WB_TOKEN = line.split('=', 1)[1].strip()
                break
    except:
        pass

print(f'Токен получен: {bool(WB_TOKEN)}')

SKUS = {539619113:'Кокошник Красный',546758919:'Кокошник Белый',539628943:'Кокошник Черный',546766746:'Кокошник Цветной'}

WH_MAP = {
  'Екатеринбург - Перспективная 14':'ekb','Екатеринбург':'ekb',
  'Владимир':'vlad','Воронеж':'voronezh','Котовск':'kotovsk',
  'Самара (Новосемейкино)':'novosem','Новосемейкино':'novosem',
  'Волгоград':'volgograd','Рязань (Тюшевское)':'ryazan','Рязань':'ryazan',
  'Невинномысск':'nevinnomyssk',
}

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# 1. Обновляем остатки
print('=== Остатки ===')
r = requests.get('https://statistics-api.wildberries.ru/api/v1/supplier/stocks',
  headers={'Authorization': WB_TOKEN}, params={'dateFrom': '2025-01-01'})
stocks = r.json()
kok = [s for s in stocks if s.get('nmId') in SKUS]
print(f'Кокошников: {len(kok)}')

by_wh = {}
for s in kok:
    wh = WH_MAP.get(s.get('warehouseName',''))
    if not wh: continue
    prod = SKUS[s['nmId']]
    key = f'{wh}:{prod}'
    if key not in by_wh:
        by_wh[key] = {'warehouse':wh,'product':prod,'quantity':0,'in_way_to_client':0,'in_way_from_client':0}
    by_wh[key]['quantity'] += s.get('quantity', 0)
    by_wh[key]['in_way_to_client'] += s.get('inWayToClient', 0)
    by_wh[key]['in_way_from_client'] += s.get('inWayFromClient', 0)

for key, data in by_wh.items():
    print(f"{data['warehouse']} / {data['product']}: {data['quantity']} шт (к клиенту: {data['in_way_to_client']}, от клиента: {data['in_way_from_client']})")
    sb.table('wb_stocks').upsert({
        'warehouse': data['warehouse'],
        'product': data['product'],
        'quantity': data['quantity'],
        'in_way_to_client': data['in_way_to_client'],
        'in_way_from_client': data['in_way_from_client'],
        'updated_at': datetime.now().isoformat()
    }, on_conflict='warehouse,product').execute()

# 2. Обновляем темп продаж по складам
print('\n=== Продажи по складам (14 дней) ===')
date_from = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%dT00:00:00')
r2 = requests.get('https://statistics-api.wildberries.ru/api/v1/supplier/sales',
  headers={'Authorization': WB_TOKEN}, params={'dateFrom': date_from, 'flag': 0})
sales = r2.json()
kok_sales = [s for s in sales if s.get('nmId') in SKUS and s.get('saleID','').startswith('S')]
print(f'Продаж: {len(kok_sales)}')

by_wh_sales = {}
for s in kok_sales:
    wh = WH_MAP.get(s.get('warehouseName',''))
    if not wh: continue
    prod = SKUS[s['nmId']]
    key = f'{wh}:{prod}'
    if key not in by_wh_sales:
        by_wh_sales[key] = {'warehouse':wh,'product':prod,'sales_14d':0}
    by_wh_sales[key]['sales_14d'] += 1

for key, data in by_wh_sales.items():
    daily = round(data['sales_14d'] / 14, 2)
    print(f"{data['warehouse']} / {data['product']}: {data['sales_14d']} за 14д = {daily}/день")
    sb.table('wb_sales_by_wh').upsert({
        'warehouse': data['warehouse'],
        'product': data['product'],
        'sales_14d': data['sales_14d'],
        'daily_rate': daily,
        'updated_at': datetime.now().isoformat()
    }, on_conflict='warehouse,product').execute()

print('\nГотово!')