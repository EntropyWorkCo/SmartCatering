-- ============================================================
-- Firma bazlı tabak fiyatlandırması
-- Her firma için tabldot türüne (2/3/4 kurs) göre birim fiyat
-- ============================================================

CREATE TABLE IF NOT EXISTS company_meal_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    selection_count INT  NOT NULL CHECK (selection_count IN (2, 3, 4)),
    unit_price      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, selection_count)
);

-- Otomatik updated_at güncellemesi
CREATE OR REPLACE FUNCTION update_company_meal_prices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_meal_prices_updated_at
BEFORE UPDATE ON company_meal_prices
FOR EACH ROW EXECUTE FUNCTION update_company_meal_prices_timestamp();

-- RLS: Admin her şeyi görebilir/değiştirebilir, firma sahibi sadece kendi satırını okuyabilir
ALTER TABLE company_meal_prices ENABLE ROW LEVEL SECURITY;

-- Admin politikası (tam erişim)
CREATE POLICY "Admin full access"
ON company_meal_prices
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.role = 'admin'
    )
);

-- Firma sahibi: sadece kendi firmasının fiyatlarını okuyabilir
CREATE POLICY "Company owner read own prices"
ON company_meal_prices
FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
    )
);
