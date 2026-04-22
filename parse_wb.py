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
    'orders': 0,
    'sold': defaultdict(int),
    'to_seller': defaultdict(float),
    'log_per_sku': defaultdict(float),
    'vv_per_sku': defaultdict(float),
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

            col_peresl = 'К перечислению Продавцу за реализованный Товар'
            col_log = 'Услуги по доставке товара покупателю'
            col_vv = 'Вознаграждение Вайлдберриз (ВВ), без НДС'
            col_shtraf = 'Общая сумма штрафов'
            col_reason = 'Обоснование для оплаты'
            col_qty = 'Кол-во'
            col_sku = 'Код номенклатуры'
            col_logtype = 'Виды логистики, штрафов и корректировок ВВ'
            col_date = 'Дата продажи'

            df['month'] = df[col_date].astype(str).str[:7]
            df = df[df['month'] >= '2026-01']
            if df.empty:
                continue

            for c in [col_peresl, col_log, col_vv, col_shtraf, col_qty]:
                df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)
            df[col_sku] = pd.to_numeric(df[col_sku], errors='coerce').fillna(0).astype(int)

            # Только кокошники
            kokosh = df[df[col_sku].isin(SKUS.keys())]

            # Продажи кокошников
            sales = kokosh[kokosh[col_reason] == 'Продажа']
            for month, grp in sales.groupby('month'):
                results[month]['revenue'] += grp[col_peresl].sum()
                results[month]['vv'] += grp[col_vv].abs().sum()
                results[month]['shtraf'] += grp[col_shtraf].abs().sum()
                results[month]['orders'] += len(grp)
                for sku_id, color in SKUS.items():
                    sku_rows = grp[(grp[col_sku] == sku_id) & (grp[col_qty] > 0)]
                    if not sku_rows.empty:
                        results[month]['sold'][color] += int(sku_rows[col_qty].sum())
                        results[month]['to_seller'][color] += sku_rows[col_peresl].sum()
                        results[month]['vv_per_sku'][color] += sku_rows[col_vv].abs().sum()

            # Логистика кокошников при продажах
            log_sale = kokosh[(kokosh[col_reason] == 'Логистика') & (kokosh[col_logtype] == 'К клиенту при продаже')]
            for month, grp in log_sale.groupby('month'):
                results[month]['log_sale'] += grp[col_log].sum()
                for sku_id, color in SKUS.items():
                    sku_rows = grp[grp[col_sku] == sku_id]
                    if not sku_rows.empty:
                        results[month]['log_per_sku'][color] += sku_rows[col_log].sum()

            # Логистика кокошников при отменах
            log_cancel = kokosh[(kokosh[col_reason] == 'Логистика') & (kokosh[col_logtype] == 'К клиенту при отмене')]
            for month, grp in log_cancel.groupby('month'):
                results[month]['log_cancel'] += grp[col_log].sum()

            print(f'OK: {fname}')
        except Exception as e:
            print(f'Ошибка {fname}: {e}')

print('\n=== РЕЗУЛЬТАТЫ ПО МЕСЯЦАМ (только кокошники) ===\n')
for month in sorted(results.keys()):
    r = results[month]
    total_sold = sum(r['sold'].values())
    buyout = total_sold / r['orders'] * 100 if r['orders'] > 0 else 0
    print(f'--- {month} ---')
    print(f'  Заказов:     {r["orders"]}')
    print(f'  Выкупов:     {total_sold}')
    print(f'  % выкупа:    {buyout:.1f}%')
    print(f'  Выручка:     {r["revenue"]:>12,.0f} ₽')
    print(f'  Лог.продажи: {r["log_sale"]:>12,.0f} ₽')
    print(f'  Лог.отмены:  {r["log_cancel"]:>12,.0f} ₽')
    print(f'  Комиссия ВВ: {r["vv"]:>12,.0f} ₽')
    for color in ['Красный', 'Белый', 'Черный', 'Цветной']:
        sold = r['sold'][color]
        if sold > 0:
            avg = r['to_seller'][color] / sold
            log_avg = r['log_per_sku'][color] / sold if r['log_per_sku'][color] > 0 else 0
            vv_avg = r['vv_per_sku'][color] / sold
            print(f'  {color}: {sold} шт | к перечисл. {avg:.0f}₽ | лог {log_avg:.0f}₽ | ВВ {vv_avg:.0f}₽')
    print()
    