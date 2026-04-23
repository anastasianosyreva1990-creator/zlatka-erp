import pandas as pd
from datetime import datetime, timedelta
from supabase import create_client

SUPABASE_URL = 'https://eqakagcbrzqfbsrgzaeh.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYWthZ2NicnpxZmJzcmd6YWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTQ4NzgsImV4cCI6MjA5MTk5MDg3OH0.Hgv8sVv4lctRLzxbrsvYt8kg-IRKVeRMjXl6fq9Ytew'

ARTS = {
    '01102025NAO': 'red',
    '02102025NAO': 'black',
    '05102025NAO': 'white',
    '10102025NAO': 'color'
}

import sys
if len(sys.argv) < 2:
    print('Использование: python3 update_orders_excel.py <путь_к_файлу.xlsx>')
    sys.exit(1)

filepath = sys.argv[1]
df = pd.read_excel(filepath)
zlatka = df[df['Бренд'] == 'ЗЛАТКА'].copy()

# Конвертируем число Excel в дату
def excel_date(n):
    if hasattr(n, 'strftime'):
        return n.strftime('%Y-%m-%d')
    return (datetime(1899, 12, 30) + timedelta(days=int(n))).strftime('%Y-%m-%d')

zlatka['date'] = zlatka['День'].apply(excel_date)
zlatka['color_key'] = zlatka['Артикул продавца'].map(ARTS)
zlatka = zlatka[zlatka['color_key'].notna()]

# Группируем по дате и цвету — берём ЗАКАЗЫ (не выкупы)
by_date = {}
for _, row in zlatka.iterrows():
    d = row['date']
    c = row['color_key']
    qty = int(row['Заказано, шт.'] or 0)
    if d not in by_date:
        by_date[d] = {'red':0,'white':0,'black':0,'color':0}
    by_date[d][c] += qty

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f'Дат с заказами: {len(by_date)}')
for date, counts in sorted(by_date.items()):
    total = sum(counts.values())
    if total == 0:
        continue
    print(f'{date}: кр={counts["red"]} бел={counts["white"]} чёр={counts["black"]} цв={counts["color"]} итого={total}')
    sb.table('wb_orders').upsert({
        'date': date,
        'red': counts['red'],
        'white': counts['white'],
        'black': counts['black'],
        'color': counts['color']
    }, on_conflict='date').execute()

print('Готово!')
