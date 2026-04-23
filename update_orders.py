import os
import requests
from datetime import datetime, timedelta
from supabase import create_client

SUPABASE_URL = 'https://eqakagcbrzqfbsrgzaeh.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYWthZ2NicnpxZmJzcmd6YWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTQ4NzgsImV4cCI6MjA5MTk5MDg3OH0.Hgv8sVv4lctRLzxbrsvYt8kg-IRKVeRMjXl6fq9Ytew'

WB_TOKEN = os.environ.get('WB_TOKEN') or os.environ.get('VITE_WB_TOKEN')
if not WB_TOKEN:
    try:
        WB_TOKEN = open(os.path.join(os.path.dirname(__file__), '.env')).read().split('VITE_WB_TOKEN=')[1].strip()
    except:
        raise Exception('WB_TOKEN not found!')

SKUS = {
    539619113: 'red',
    546758919: 'white',
    539628943: 'black',
    546766746: 'color'
}

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

date_from = '2025-10-01T00:00:00'

resp = requests.get(
    'https://statistics-api.wildberries.ru/api/v1/supplier/orders',
    headers={'Authorization': WB_TOKEN},
    params={'dateFrom': date_from, 'flag': 0}
)

all_orders = resp.json()
print(f'Всего заказов с API: {len(all_orders)}')

kok_orders = [o for o in all_orders if o.get('nmId') in SKUS]
print(f'Кокошников: {len(kok_orders)}')

by_date = {}
for o in kok_orders:
    date = o.get('date', '')[:10]
    if not date:
        continue
    if date not in by_date:
        by_date[date] = {'red':0,'white':0,'black':0,'color':0}
    by_date[date][SKUS[o['nmId']]] += 1

print(f'Дат с заказами: {len(by_date)}')

for date, counts in sorted(by_date.items()):
    total = sum(counts.values())
    print(f'{date}: кр={counts["red"]} бел={counts["white"]} чёр={counts["black"]} цв={counts["color"]} итого={total}')
    sb.table('wb_orders').upsert({
        'date': date,
        'red': counts['red'],
        'white': counts['white'],
        'black': counts['black'],
        'color': counts['color']
    }, on_conflict='date').execute()

print('Готово!')
