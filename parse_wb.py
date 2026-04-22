import os
import pandas as pd
from collections import defaultdict

SKUS = {
    539619113: 'Красный',
    546758919: 'Белый',
    539628943: 'Черный',
    546766746: 'Цветной'
}

results = defaultdict(lambda: {
    'revenue': 0, 'log_sale': 0, 'log_cancel': 0,
    'vv': 0, 'shtraf': 0,
    'sold': defaultdict(int),
    'to_seller': defaultdict(float),
    'log_per_sku': defaultdict(float)
})

reports_dir = '/workspaces/zlatka-erp/wb_reports'

for item in sorted(os.listdir(reports_dir)):
    item_path = os.path.join(reports_dir, item)
    if not os.path.isdir(item_path):
        continue
    for fname in os.listdir(item_path):
        if not fname.endswith('.xlsx'):
            continue
        fpath = os.path.join(item_path, fname)
        try:
            df = pd.read_excel(fpath, engine='openpyxl')
            print(f'OK: {fname} ({len(df)} строк)')

            df['month'] = df['Дата продажи'].astype(str).str[:7]
            df = df[df['month'] >= '2026-01']
            if df.empty:
                continue

            col_peresl = 'К перечислению Продавцу за реализованный Товар'
            col_log = 'Услуги по доставке товара покупателю'
            col_vv = 'Вознаграждение Вайлдберриз (ВВ), без НДС'
            col_shtraf = 'Общая сумма штрафов'
            col_reason = 'Обоснование для оплаты'
            col_qty = 'Кол-во'
            col_sku = 'Код номенклатуры'
            col_logtype = 'Виды логистики, штрафов и корректировок ВВ'

            for c in [col_peresl, col_log, col_vv, col_shtraf, col_qty]:
                df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)
            df[col_sku] = pd.to_numeric(df[col_sku], errors='coerce').fillna(0).astype(int)

            sales = df[df[col_reason] == 'Продажа']
            log_sale = df[(df[col_reason] == 'Логистика') & (df[col_logtype] == 'К клиенту при продаже')]
            log_cancel = df[(df[col_reason] == 'Логистика') & (df[col_logtype] == 'К клиенту при отмене')]

            for month, grp in sales.groupby('month'):
                results[month]['revenue'] += grp[col_peresl].sum()
                results[month]['vv'] += grp[col_vv].abs().sum()
                results[month]['shtraf'] += grp[col_shtraf].abs().sum()
                for sku_id, color in SKUS.items():
                    sku_rows = grp[(grp[col_sku] == sku_id) & (grp[col_qty] > 0)]
                    if not sku_rows.empty:
                        results[month]['sold'][color] += int(sku_rows[col_qty].sum())
                        results[month]['to_seller'][color] += sku_rows[col_peresl].sum()
                        results[month]['log_per_sku'][color] += sku_rows[col_log].sum()

            for month, grp in log_sale.groupby('month'):
                results[month]['log_sale'] += grp[col_log].sum()

            for month, grp in log_cancel.groupby('month'):
                results[month]['log_cancel'] += grp[col_log].sum()

        except Exception as e:
            print(f'Ошибка {fname}: {e}')

print('\n=== РЕЗУЛЬТАТЫ ПО МЕСЯЦАМ ===\n')
for month in sorted(results.keys()):
    r = results[month]
    print(f'--- {month} ---')
    print(f'  Выручка:     {r["revenue"]:>12,.0f} ₽')
    print(f'  Лог.продажи: {r["log_sale"]:>12,.0f} ₽')
    print(f'  Лог.отмены:  {r["log_cancel"]:>12,.0f} ₽')
    print(f'  Комиссия ВВ: {r["vv"]:>12,.0f} ₽')
    print(f'  Штрафы:      {r["shtraf"]:>12,.0f} ₽')
    for color in ['Красный', 'Белый', 'Черный', 'Цветной']:
        sold = r['sold'][color]
        if sold > 0:
            avg = r['to_seller'][color] / sold
            log_avg = r['log_per_sku'][color] / sold
            print(f'  {color}: {sold} шт, ср.выручка {avg:.0f}₽, ср.лог {log_avg:.0f}₽')
    print()