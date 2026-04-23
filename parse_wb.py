import os
import pandas as pd

SKUS = {539619113,546758919,539628943,546766746}
reports_dir = '/workspaces/zlatka-erp/wb_reports'
weekly = []

COLS = ['Код номенклатуры','Дата продажи','Обоснование для оплаты',
        'К перечислению Продавцу за реализованный Товар',
        'Услуги по доставке товара покупателю',
        'Виды логистики, штрафов и корректировок ВВ']

for item in sorted(os.listdir(reports_dir)):
    item_path = os.path.join(reports_dir, item)
    if not os.path.isdir(item_path): continue
    for fname in os.listdir(item_path):
        if not fname.endswith('.xlsx'): continue
        fpath = os.path.join(item_path, fname)
        try:
            df = pd.read_excel(fpath, engine='openpyxl', usecols=COLS)
            df['Код номенклатуры'] = pd.to_numeric(df['Код номенклатуры'], errors='coerce').fillna(0).astype(int)
            kokosh = df[df['Код номенклатуры'].isin(SKUS)]
            if kokosh.empty: continue

            col_p = 'К перечислению Продавцу за реализованный Товар'
            col_l = 'Услуги по доставке товара покупателю'
            col_r = 'Обоснование для оплаты'
            col_lt = 'Виды логистики, штрафов и корректировок ВВ'
            col_d = 'Дата продажи'

            kokosh[col_p] = pd.to_numeric(kokosh[col_p], errors='coerce').fillna(0)
            kokosh[col_l] = pd.to_numeric(kokosh[col_l], errors='coerce').fillna(0)

            sales = kokosh[kokosh[col_r] == 'Продажа']
            ls = kokosh[(kokosh[col_r] == 'Логистика') & (kokosh[col_lt] == 'К клиенту при продаже')][col_l].sum()
            lc = kokosh[(kokosh[col_r] == 'Логистика') & (kokosh[col_lt] == 'К клиенту при отмене')][col_l].sum()
            revenue = sales[col_p].sum()
            net = revenue - ls - lc

            dates = pd.to_datetime(kokosh[col_d], errors='coerce').dropna()
            if dates.empty: continue
            p_start = dates.min().strftime('%Y-%m-%d')
            p_end = dates.max().strftime('%Y-%m-%d')
            report_num = fname.split('№')[1].split('_')[0] if '№' in fname else fname[:10]

            print(f'{report_num} | {p_start}—{p_end} | NET: {round(net):,} ₽')
            weekly.append({'report_num':report_num,'period_start':p_start,'period_end':p_end,'net':round(net)})
        except Exception as e:
            print(f'Ошибка {fname}: {e}')

print(f'\nВсего: {len(weekly)}')
for w in sorted(weekly, key=lambda x: x['period_start']):
    from datetime import datetime, timedelta
    payout_date = datetime.strptime(w['period_end'], '%Y-%m-%d') + timedelta(days=35)
    print(f"Выплата {payout_date.strftime('%d.%m.%Y')} | период {w['period_start']}—{w['period_end']} | {w['net']:,} ₽")