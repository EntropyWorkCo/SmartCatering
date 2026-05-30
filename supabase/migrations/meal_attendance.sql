-- ============================================================
-- meal_attendance Migration
-- Çalışanların günlük yemek bildirimi takibi
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- 1. TABLO
CREATE TABLE IF NOT EXISTS public.meal_attendance (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  company_id      uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  attendance_date date        NOT NULL DEFAULT CURRENT_DATE,
  adisyon_id      uuid        REFERENCES public.adisyon(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),

  -- Günde bir kez kayıt: aynı kişi aynı günü iki kez giremez
  CONSTRAINT uq_user_date UNIQUE (user_id, attendance_date)
);

-- 2. INDEX (firma + tarih bazlı hızlı sorgu)
CREATE INDEX IF NOT EXISTS idx_meal_attendance_company_date
  ON public.meal_attendance (company_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_meal_attendance_user_date
  ON public.meal_attendance (user_id, attendance_date);

-- 3. RLS
ALTER TABLE public.meal_attendance ENABLE ROW LEVEL SECURITY;

-- Firma sahibi kendi firmasının kayıtlarını görebilir
CREATE POLICY "owner_select_attendance"
  ON public.meal_attendance FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Herkes kendi kaydını ekleyebilir (trigger ekler ama fallback için)
CREATE POLICY "user_insert_own_attendance"
  ON public.meal_attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role her şeyi yapabilir (trigger ve Edge Function için)
CREATE POLICY "service_role_all"
  ON public.meal_attendance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin tüm kayıtları görebilir
CREATE POLICY "admin_select_all"
  ON public.meal_attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. TRİGGER FONKSİYONU
-- adisyon tablosuna INSERT gelince otomatik meal_attendance oluşturur
CREATE OR REPLACE FUNCTION public.fn_log_meal_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Manuel borç/ödeme kayıtlarını ve user_id boş olanları atla
  IF NEW.order_type IN ('MANUAL_DEBT', 'MANUAL_PAYMENT') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kullanıcının bağlı olduğu şirketi bul:
  --   a) Çalışansa: users.company_id
  --   b) Firma sahibiyse: companies.user_id üzerinden
  SELECT COALESCE(u.company_id, c.id)
  INTO   v_company_id
  FROM   public.users u
  LEFT   JOIN public.companies c ON c.user_id = u.id
  WHERE  u.id = NEW.user_id
  LIMIT  1;

  -- Şirketi olmayan (bireysel) kullanıcıları atla
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Günlük tekil kayıt — zaten varsa hiçbir şey yapma
  INSERT INTO public.meal_attendance (
    user_id,
    company_id,
    attendance_date,
    adisyon_id
  )
  VALUES (
    NEW.user_id,
    v_company_id,
    CURRENT_DATE,   -- Türkiye saatine göre UTC+3 — Supabase timezone'u ayarlıysa doğru
    NEW.id
  )
  ON CONFLICT (user_id, attendance_date) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. TRİGGER (adisyon INSERT'te tetikle)
DROP TRIGGER IF EXISTS trg_meal_attendance ON public.adisyon;

CREATE TRIGGER trg_meal_attendance
  AFTER INSERT ON public.adisyon
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_meal_attendance();

-- ============================================================
-- NOTLAR:
-- • Supabase'in varsayılan timezone'u UTC'dir.
--   Türkiye (UTC+3) için CURRENT_DATE yerine
--   (NOW() AT TIME ZONE 'Europe/Istanbul')::date kullanabilirsiniz.
--   Trigger'da bunu değiştirmek için fn_log_meal_attendance'ı güncelleyin.
-- • Geçmiş adisyon kayıtlarını doldurmak için:
--   INSERT INTO meal_attendance (user_id, company_id, attendance_date, adisyon_id)
--   SELECT a.user_id, ..., a.created_at::date, a.id FROM adisyon a ...
--   ON CONFLICT DO NOTHING;
-- ============================================================
