-- ============================================================
-- Migration 001: Settings tables, products, new materials
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. WB Warehouses table (enables Settings page management)
CREATE TABLE IF NOT EXISTS wb_warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fo TEXT,
  wb_tariff INTEGER DEFAULT 0,
  sdek_tariff INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO wb_warehouses (id, name, fo, wb_tariff, sdek_tariff) VALUES
  ('ekb',      'Екатеринбург',   'Уральский',    190, 934),
  ('vlad',     'Владимир',       'Центральный',  130, 1354),
  ('voronezh', 'Воронеж',        'Центральный',  130, 1460),
  ('kotovsk',  'Котовск',        'Центральный',  120, 1565),
  ('novosem',  'Новосемейкино',  'Приволжский',  160, 1249),
  ('volgograd','Волгоград',      'Южный',        170, 1670),
  ('ryazan',   'Рязань',         'Центральный',  130, 1355)
ON CONFLICT (id) DO NOTHING;

-- 2. Products table (артикулы)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nm_id BIGINT,
  color TEXT DEFAULT '#888888',
  short_name TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO products (name, nm_id, color, short_name) VALUES
  ('Кокошник Красный',  539619113, '#C0392B', 'Красный'),
  ('Кокошник Белый',    546758919, '#7F8C8D', 'Белый'),
  ('Кокошник Черный',   539628943, '#2C3E50', 'Чёрный'),
  ('Кокошник Цветной',  546766746, '#27AE60', 'Цветной'),
  ('Кокошник Ягоды',    NULL,      '#7D3C98', 'Ягоды'),
  ('Кокошник Петушки',  NULL,      '#E67E22', 'Петушки')
ON CONFLICT DO NOTHING;

-- 3. Product–Material norms table
CREATE TABLE IF NOT EXISTS product_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  norm DECIMAL(10,6) NOT NULL DEFAULT 0,
  UNIQUE(product_id, material_id)
);

-- 4. New materials (item 24)
INSERT INTO materials (name, unit, category) VALUES
  ('Резинка Бежевая',             'м',  'Фурнитура'),
  ('Габардин Ягоды',              'м',  'Ткань'),
  ('Габардин Петушки',            'м',  'Ткань'),
  ('Основа пластиковая большая',  'шт', 'Фурнитура')
ON CONFLICT DO NOTHING;

-- ============================================================
-- After running, go to Settings → Настройки in the app
-- to manage warehouses and SDEK tariffs via the interface.
-- ============================================================
