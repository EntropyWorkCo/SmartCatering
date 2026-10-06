-- ==============================================================================
-- Otomatik Kurumsal Sipariş Fiyatı Sıfırlama Tetikleyicisi (PostgreSQL Trigger)
-- Amaç: Kurumsal kullanıcıların (şirket sahibi veya çalışanı) siparişlerinde,
-- istemci (mobil telefon) ne gönderirse göndersin, veritabanına tutarın daima 0 TL 
-- olarak kaydedilmesini garanti altına alır.
-- ==============================================================================

CREATE OR REPLACE FUNCTION enforce_corporate_order_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_is_corporate BOOLEAN := false;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    -- Kullanıcının kurumsal olup olmadığını tespit et
    SELECT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = NEW.user_id 
        AND (u.is_company = true OR u.company_id IS NOT NULL OR u.role IN ('owner', 'corporate'))
    ) OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = NEW.user_id
    ) INTO v_is_corporate;

    -- Eğer kurumsalsa ve manuel borç/ödeme değilse tutarı kesinlikle 0 TL yap
    IF v_is_corporate AND NEW.order_type NOT IN ('MANUAL_DEBT', 'MANUAL_PAYMENT') THEN
      NEW.total_amount := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_corporate_order_pricing ON adisyon;
CREATE TRIGGER trg_enforce_corporate_order_pricing
BEFORE INSERT OR UPDATE ON adisyon
FOR EACH ROW
EXECUTE FUNCTION enforce_corporate_order_pricing();


-- ==============================================================================
-- Adisyon Kalemleri (adisyon_items) İçin Fiyat Sıfırlama Tetikleyicisi
-- ==============================================================================

CREATE OR REPLACE FUNCTION enforce_corporate_order_item_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_is_corporate BOOLEAN := false;
  v_order_type TEXT;
BEGIN
  SELECT a.order_type, (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = a.user_id 
        AND (u.is_company = true OR u.company_id IS NOT NULL OR u.role IN ('owner', 'corporate'))
    ) OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = a.user_id
    )
  ) INTO v_order_type, v_is_corporate
  FROM adisyon a
  WHERE a.id = NEW.adisyon_id;

  IF v_is_corporate AND v_order_type NOT IN ('MANUAL_DEBT', 'MANUAL_PAYMENT') THEN
    NEW.unit_price := 0;
    NEW.line_total := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_corporate_order_item_pricing ON adisyon_items;
CREATE TRIGGER trg_enforce_corporate_order_item_pricing
BEFORE INSERT OR UPDATE ON adisyon_items
FOR EACH ROW
EXECUTE FUNCTION enforce_corporate_order_item_pricing();
