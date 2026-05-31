import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { supabase } from "../supabase";

export type UserRole = 'admin' | 'firma_sahibi' | 'firma_calisan' | 'bireysel' | null;

interface AuthState {
  session: any | null;
  user: any | null;
  role: UserRole;
  firmaId: string | null;
  isAdmin: boolean;
  loading: boolean;
  initialized: boolean;
  subscription: any | null;

  initialize: (force?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => void;
}

// ─── Yardımcı: rol + admin cache guard ─────────────────────────────────────
async function resolveWithCache(session: any): Promise<{ role: UserRole; firmaId: string | null }> {
  const result = await resolveRoleData(session);
  let { role, firmaId } = result;
  try {
    const cachedIsAdmin = await AsyncStorage.getItem("isAdmin");
    if (cachedIsAdmin === "true") role = 'admin';
  } catch (_) {}
  return { role, firmaId };
}

// ─── Yardımcı: rol null kalırsa 3sn sonra tekrar dene, 6sn'de 'bireysel' fallback
function scheduleRoleRetry(session: any, get: () => AuthState, set: (s: Partial<AuthState>) => void) {
  // 3 saniye sonra yeniden dene
  setTimeout(async () => {
    if (get().role !== null || !get().user) return; // Zaten set edilmişse çık
    console.log("🔁 Rol yeniden deneniyor (3sn)...");
    const { role, firmaId } = await resolveWithCache(session);
    if (role !== null) {
      set({ role, firmaId, isAdmin: role === 'admin' });
      return;
    }
    // 6 saniye sonra son fallback
    setTimeout(() => {
      if (get().role !== null || !get().user) return;
      console.warn("⚠️ Rol belirlenemedi, 'bireysel' olarak ayarlandı (fallback).");
      set({ role: 'bireysel', firmaId: null, isAdmin: false });
    }, 3000); // 3+3 = 6sn toplam
  }, 3000);
}

// ─── Store ──────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  role: null,
  firmaId: null,
  isAdmin: false,
  loading: true,
  initialized: false,
  subscription: null,

  setRole: (role: UserRole) => set({ role, loading: false }),

  initialize: async (force = false) => {
    // Çift çağrı koruması
    if (get().initialized && !force) return;
    if (!force && !get().initialized && get().subscription) return;

    // ── 1. DİNLEYİCİYİ BAŞLAT ────────────────────────────────────────────
    if (!get().subscription) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        console.log("🔄 Auth State:", _event);

        // INITIAL_SESSION → getSession zaten işliyor, çift çalışmayı önle
        if (_event === 'INITIAL_SESSION') return;

        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
          const { role, firmaId } = await resolveWithCache(session);

          if (role !== null) {
            // Rol bilindi → tam güncelleme
            set({
              session,
              user: session?.user || null,
              role,
              firmaId,
              isAdmin: role === 'admin',
              loading: false,
            });
          } else {
            // Rol henüz belirlenemedi — user/session HER ZAMAN yazılır,
            // aksi hâlde _layout user'ı göremez ve welcome'a yönlendirir.
            set({ session, user: session?.user || null, loading: false });
            // 3sn sonra tekrar dene, 6sn'de bireysel fallback
            scheduleRoleRetry(session, get, set);
          }
        } else if (_event === 'SIGNED_OUT') {
          // Admin cache'i de temizle — yoksa yeni oturum açan kullanıcı admin sanılır
          AsyncStorage.multiRemove(["isAdmin", "userRole"]).catch(() => {});
          set({ session: null, user: null, role: null, firmaId: null, isAdmin: false, loading: false });
        }
      });
      set({ subscription });
    }

    // ── 2. OTURUMU KONTROL ET ─────────────────────────────────────────────
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      let finalSession = session;

      // Bozuk token → temizle
      if (sessionError && (sessionError.message.includes("Refresh Token") || sessionError.status === 400)) {
        console.warn("🔄 Bozuk oturum tespit edildi, temizleniyor...");
        await get().signOut();
        return;
      }

      // Oturum yoksa soft user kontrolü
      if (sessionError || !session) {
        try {
          const softUserStr = await AsyncStorage.getItem("softUser");
          if (softUserStr) {
            const softUser = JSON.parse(softUserStr);
            finalSession = { user: softUser, isSoftUser: true } as any;
          }
        } catch (_) {}
      }

      const { role, firmaId } = await resolveWithCache(finalSession);

      if (role === null) {
        // Rol null → mevcut rol'e dokunma, sadece session/user/loading/initialized yaz.
        // onAuthStateChange SIGNED_IN veya scheduleRoleRetry rolü yazacak.
        console.log("⏳ initialize: rol null, retry planlandı.");
        set({
          session: finalSession,
          user: finalSession?.user || null,
          loading: false,
          initialized: true,
        });
        if (finalSession?.user) {
          scheduleRoleRetry(finalSession, get, set);
        }
      } else {
        set({
          session: finalSession,
          user: finalSession?.user || null,
          role,
          firmaId,
          isAdmin: role === 'admin',
          loading: false,
          initialized: true,
        });
      }
    } catch (error) {
      set({ loading: false, initialized: true });
    }
  },

  signOut: async () => {
    // 1. ÖNCE state'i ve cache'i temizle
    set({ session: null, user: null, role: null, firmaId: null, isAdmin: false, loading: false });
    await AsyncStorage.multiRemove(["isAdmin", "softUser", "userRole", "firmaId"]);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut error:", e);
    }
  },
}));

// ─── Rol Çözümleme ───────────────────────────────────────────────────────────
async function resolveRoleData(session: any): Promise<{ role: UserRole; firmaId: string | null }> {
  if (!session?.user) return { role: null, firmaId: null };

  // Admin login öncesi cache kontrolü — DB'den önce hızlı yol
  try {
    const cachedIsAdmin = await AsyncStorage.getItem("isAdmin");
    const cachedRole    = await AsyncStorage.getItem("userRole");
    if (cachedIsAdmin === "true" && cachedRole === "admin") {
      return { role: 'admin', firmaId: null };
    }
  } catch (_) {}

  const timeoutPromise = new Promise<{ role: UserRole; firmaId: string | null }>((resolve) => {
    setTimeout(() => {
      console.warn("⚠️ Rol çözümleme zaman aşımı (8sn).");
      resolve({ role: null, firmaId: null });
    }, 8000); // 10→8sn: daha hızlı retry başlayabilsin
  });

  const logicPromise = (async (): Promise<{ role: UserRole; firmaId: string | null }> => {
    const userId    = session.user.id;
    const isSoftUser = !!session.isSoftUser;

    // 1. Metadata (en hızlı)
    const metadata          = session.user.app_metadata || session.user.user_metadata || {};
    const roleFromMetadata  = metadata.role;
    const firmaIdFromMetadata = metadata.firma_id;

    const mapRole = (r: string): UserRole => {
      if (r === "admin") return "admin";
      if (r === "owner" || r === "corporate" || r === "firma_sahibi") return "firma_sahibi";
      if (r === "employee" || r === "staff" || r === "firma_calisan") return "firma_calisan";
      return "bireysel";
    };

    if (roleFromMetadata) {
      return { role: mapRole(roleFromMetadata), firmaId: firmaIdFromMetadata || null };
    }

    // 2. Veritabanı
    if (!isSoftUser) {
      try {
        const { data: isAdminRPC } = await supabase.rpc("is_admin");
        if (isAdminRPC) return { role: 'admin', firmaId: null };

        const { data: profile } = await supabase
          .from("users")
          .select("role, company_id, is_company")
          .eq("id", userId)
          .maybeSingle();

        if (profile) {
          return {
            role: mapRole(profile.role || (profile.is_company ? 'corporate' : 'bireysel')),
            firmaId: profile.company_id || null,
          };
        }
      } catch (e) {
        console.warn("Database role check failed:", e);
        return { role: null, firmaId: null };
      }
    }

    // Soft user veya profil bulunamadı
    return { role: 'bireysel', firmaId: null };
  })();

  return Promise.race([logicPromise, timeoutPromise]);
}
