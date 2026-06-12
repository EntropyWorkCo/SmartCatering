import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://deno.land/x/xlsx@0.20.0/mod.ts";

const CATEGORY_MAP: Record<string, string> = {
  "Başlangıç": "ÇORBA ÇEŞİTLERİ",
  "Ana Yemek": "ANA YEMEK",
  "Yardımcı": "YARDIMCI",
  "Tamamlayıcı": "TAMAMLAYICI",
};

const PRICE_MAP: Record<string, number> = {
  "ÇORBA ÇEŞİTLERİ": 135,
  "ANA YEMEK": 180,
  "YARDIMCI": 90,
  "TAMAMLAYICI": 35,
};

interface ImportResponse {
  success: boolean;
  timestamp: string;
  mode: "replace" | "append";
  imported: Record<string, number>;
  total: number;
  duplicates: number;
  errors: string[];
  warnings: string[];
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mode = (formData.get("mode") as string) || "append";

    if (!file) {
      return new Response(JSON.stringify({ error: "File required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheetNames = workbook.SheetNames.filter(
      (name) =>
        !name.toLowerCase().includes("özet") &&
        !name.toLowerCase().includes("tüm liste") &&
        !name.toLowerCase().includes("tekrarsız")
    );

    let allItems: any[] = [];
    const importedCount: Record<string, number> = {};
    const errors: string[] = [];
    const warnings: string[] = [];
    let duplicateCount = 0;

    // Process each sheet
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      const mappedCategory = CATEGORY_MAP[sheetName];
      if (!mappedCategory) {
        warnings.push(`Sheet "${sheetName}" kategorisi bilinmiyor, skip edildi`);
        continue;
      }

      const price = PRICE_MAP[mappedCategory];
      const categoryKey = sheetName;

      // Parse rows (skip header)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[1]) continue;

        const name = String(row[1]).trim();
        if (!name || name.length < 2) continue;

        // Skip numeric values (summary rows)
        if (!isNaN(Number(name))) continue;

        allItems.push({
          name,
          category: mappedCategory,
          price,
          status: "draft",
          is_active: true,
        });

        importedCount[categoryKey] = (importedCount[categoryKey] || 0) + 1;
      }
    }

    if (allItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No valid items found in Excel",
          errors,
          warnings,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Duplicate check
    const existingNames = await supabase
      .from("menu_items")
      .select("name, category")
      .in(
        "category",
        Object.values(CATEGORY_MAP)
      );

    const existingSet = new Set(
      (existingNames.data || []).map((item) =>
        `${item.name.toLowerCase()}|${item.category}`
      )
    );

    const newItems = allItems.filter((item) => {
      const key = `${item.name.toLowerCase()}|${item.category}`;
      if (existingSet.has(key)) {
        duplicateCount++;
        return false;
      }
      return true;
    });

    if (newItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Tüm yemekler zaten yüklü",
          duplicates: duplicateCount,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Mode: replace - delete old items
    if (mode === "replace") {
      const { error: deleteError } = await supabase
        .from("menu_items")
        .delete()
        .in("category", Object.values(CATEGORY_MAP))
        .eq("status", "passive");

      if (deleteError) {
        errors.push(`Eski yemekler silinirken hata: ${deleteError.message}`);
      }
    }

    // Batch insert
    const { error: insertError, data: inserted } = await supabase
      .from("menu_items")
      .insert(newItems)
      .select();

    if (insertError) {
      errors.push(`Database insert hatası: ${insertError.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          errors,
          warnings,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const response: ImportResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      mode,
      imported: importedCount,
      total: newItems.length,
      duplicates: duplicateCount,
      errors,
      warnings,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
