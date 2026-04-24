import os, requests
from supabase import create_client

SUPABASE_URL = 'https://eqakagcbrzqfbsrgzaeh.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYWthZ2NicnpxZmJzcmd6YWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTQ4NzgsImV4cCI6MjA5MTk5MDg3OH0.Hgv8sVv4lctRLzxbrsvYt8kg-IRKVeRMjXl6fq9Ytew'
WB_TOKEN = os.environ.get('WB_TOKEN') or open('/workspaces/zlatka-erp/.env').read().split('VITE_WB_TOKEN=')[1].strip()

SKUS = {539619113:'Кокошник Красный',546758919:'Кокошник Белый',539628943:'Кокошник Черный',546766746:'Кокошник Цветной'}

WH_MAP = {
  'Екатеринбург - Перспективная 14': 'ekb',
  'Екатеринбург': 'ekb',
  'Владимир': 'vlad',
  'Воронеж': 'voronezh',
  'Котовск': 'kotovsk',
  'Самара (Новосемейкино)': 'novosem',
  'Новосемейкино': 'novosem',
  'Волгоград': 'volgograd',
  'Рязань (Тюшевское)': 'ryazan',
  'Рязань': 'ryazan',
  'Невинномысск': 'nevinnomyssk',
}

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

from datetime import datetime, timedelta
date_from = '2025-01-01'

r = requests.get('https://statistics-api.wildberries.ru/api/v1/supplier/stocks',
  headers={'Authorization': WB_TOKEN}, params={'dateFrom': date_from})

stocks = r.json()
print(f'Получено записей: {len(stocks)}')

kok = [s for s in stocks if s.get('nmId') in SKUS]
print(f'Кокошников: {len(kok)}')

# Группируем по складу и артикулу
by_wh = {}
for s in kok:
    wh = s.get('warehouseName','')
    wh_id = WH_MAP.get(wh)
    if not wh_id:
        continue
    prod = SKUS[s['nmId']]
    key = f'{wh_id}:{prod}'
    if key not in by_wh:
        by_wh[key] = {'warehouse':wh_id,'product':prod,'quantity':0}
    by_wh[key]['quantity'] += s.get('quantity',0)

for key, data in by_wh.items():
    print(f"{data['warehouse']} / {data['product']}: {data['quantity']} шт")
    sb.table('wb_stocks').upsert({
        'warehouse': data['warehouse'],
        'product': data['product'],
        'quantity': data['quantity'],
        'updated_at': datetime.now().isoformat()
    }, on_conflict='warehouse,product').execute()

print('Готово!')
