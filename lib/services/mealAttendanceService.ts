/**
 * mealAttendanceService.ts
 * ─────────────────────────────────────────────────────────────
 * Çalışanların günlük yemek bildirimi takibi.
 * meal_attendance tablosunu okur (trigger ile otomatik dolar).
 * ─────────────────────────────────────────────────────────────
 */

import { supabase } from "../supabase";
import { notificationService } from "./notificationService";

// ── Tipler ────────────────────────────────────────────────────

export interface MealItem {
  name: string;
  quantity: number;
}

export interface EmployeeAttendance {
  userId: string;
  fullName: string;
  phone: string;
  hasMeal: boolean;           // O gün yemek bildirimi yaptı mı?
  adisyonId?: string;         // Hangi siparişe bağlı
  items: MealItem[];          // Ne yedi (adisyon_items)
  attendanceDate: string;     // "2026-05-29"
}

export interface DailySummary {
  date: string;
  done: EmployeeAttendance[];
  notDone: EmployeeAttendance[];
  total: number;
  doneCount: number;
}

// ── Servis ────────────────────────────────────────────────────

export const mealAttendanceService = {

  /**
   * Belirli bir gün için firmadaki tüm çalışanların yemek durumunu getirir.
   * @param companyId  Firma ID
   * @param date       "YYYY-MM-DD" formatında tarih (default: bugün)
   */
  async getDailyAttendance(
    companyId: string,
    date?: string
  ): Promise<EmployeeAttendance[]> {
    // Varsayılan: bugün (Türkiye saati — UTC+3)
    const targetDate = date || (() => {
      const now = new Date();
      // UTC+3 offset uygula
      const trTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      return trTime.toISOString().split("T")[0];
    })();

    // 1. Tüm aktif çalışanları çek
    const { data: employees, error: empErr } = await supabase
      .from("users")
      .select("id, full_name, phone")
      .eq("company_id", companyId)
      .not("role", "in", '("deleted","admin")')
      .order("full_name");

    if (empErr) throw empErr;

    // 2. Firma sahibini ekle
    const { data: company } = await supabase
      .from("companies")
      .select("user_id, users!companies_user_id_fkey(id, full_name, phone)")
      .eq("id", companyId)
      .maybeSingle();

    const ownerUser = (company as any)?.["users!companies_user_id_fkey"]
      ?? (company as any)?.users;

    // Firma sahibi + çalışanlar (birleşik, tekrar yok)
    const allPeople: { id: string; full_name: string; phone: string }[] = [];
    if (ownerUser && ownerUser.id) {
      allPeople.push(ownerUser);
    }
    (employees || []).forEach((emp) => {
      if (!allPeople.find((p) => p.id === emp.id)) {
        allPeople.push(emp);
      }
    });

    if (allPeople.length === 0) return [];

    // 3. O günkü meal_attendance kayıtlarını çek
    const { data: attendance } = await supabase
      .from("meal_attendance")
      .select("user_id, adisyon_id, attendance_date")
      .eq("company_id", companyId)
      .eq("attendance_date", targetDate);

    // user_id → adisyon_id map
    const attendanceMap = new Map<string, string | null>(
      (attendance || []).map((a) => [a.user_id, a.adisyon_id])
    );

    // 4. Yemek yapanların ne yediğini çek (adisyon_items join)
    const adisyonIds = [...attendanceMap.values()].filter(Boolean) as string[];
    const itemsMap = new Map<string, MealItem[]>();

    if (adisyonIds.length > 0) {
      const { data: rawItems } = await supabase
        .from("adisyon_items")
        .select("adisyon_id, quantity, menu_items(name)")
        .in("adisyon_id", adisyonIds);

      (rawItems || []).forEach((row: any) => {
        const existing = itemsMap.get(row.adisyon_id) || [];
        existing.push({
          name: row.menu_items?.name || "Yemek",
          quantity: row.quantity,
        });
        itemsMap.set(row.adisyon_id, existing);
      });
    }

    // 5. Birleştir ve döndür
    return allPeople.map((person) => {
      const adisyonId = attendanceMap.has(person.id)
        ? (attendanceMap.get(person.id) ?? undefined)
        : undefined;

      return {
        userId: person.id,
        fullName: person.full_name || "İsimsiz",
        phone: person.phone || "",
        hasMeal: attendanceMap.has(person.id),
        adisyonId,
        items: adisyonId ? (itemsMap.get(adisyonId) || []) : [],
        attendanceDate: targetDate,
      };
    });
  },

  /**
   * Günlük özet: kaç kişi yaptı/yapmadı
   */
  async getDailySummary(companyId: string, date?: string): Promise<DailySummary> {
    const attendance = await this.getDailyAttendance(companyId, date);
    const done    = attendance.filter((a) => a.hasMeal);
    const notDone = attendance.filter((a) => !a.hasMeal);
    return {
      date: date || new Date().toISOString().split("T")[0],
      done,
      notDone,
      total: attendance.length,
      doneCount: done.length,
    };
  },

  /**
   * Mevcut günlük raporu firma sahibine push olarak gönderir.
   * Gün sonu (16:00) çağrılır.
   */
  async sendDailySummaryToOwner(
    companyId: string,
    ownerId: string
  ): Promise<void> {
    const summary = await this.getDailySummary(companyId);

    const doneNames = summary.done
      .map((a) => a.fullName.split(" ")[0])
      .join(", ");

    const body =
      summary.doneCount > 0
        ? `${doneNames} bugün yemek yedi. ${summary.notDone.length} kişi yemedi. (${summary.doneCount}/${summary.total})`
        : `Bugün hiçbir çalışan yemek bildirimi yapmadı. (0/${summary.total})`;

    await notificationService.sendViaEdgeFunction({
      type: "MEAL_REMINDER",
      title: "📊 Günlük Yemek Özeti",
      body,
      data: { screen: "corporate-info", tab: "KONTROL" },
      userId: ownerId,
    });
  },

  /**
   * Yemek kaydı yapmayan çalışanlara hatırlatma push gönderir.
   * Öğle (13:00) çağrılır.
   */
  async sendMealReminder(
    companyId: string,
    excludeOwnerId?: string
  ): Promise<number> {
    const summary = await this.getDailySummary(companyId);

    // Firma sahibini hariç tut (o zaten bildirim alacak)
    const targetIds = summary.notDone
      .map((a) => a.userId)
      .filter((id) => id !== excludeOwnerId);

    if (targetIds.length === 0) return 0;

    await notificationService.sendViaEdgeFunction({
      type: "MEAL_REMINDER",
      title: "🍽️ Bugün yemek yediniz mi?",
      body: "Bugün henüz yemek bildirimi yapmadınız. Sipariş vermek için uygulamayı açın.",
      data: { screen: "home" },
      userIds: targetIds,
    });

    return targetIds.length;
  },

  /**
   * Belirli çalışanlara (ID listesiyle) tekil hatırlatma gönderir.
   */
  async sendReminderToUsers(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    await notificationService.sendViaEdgeFunction({
      type: "MEAL_REMINDER",
      title: "🍽️ Bugün yemek yediniz mi?",
      body: "Bugün henüz yemek bildirimi yapmadınız.",
      data: { screen: "home" },
      userIds,
    });
  },
};
