export interface UserProfile {
  id: string;
  ad_soyad: string;
  telefon: string;
  
  // Kurumsal Checkbox Mantığı
  is_kurumsal: boolean;
  firma_unvani?: string | null;
  vergi_no?: string | null;
  
  rol: 'admin' | 'musteri';
  bakiye: number;
}