import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface Props {
  previewData: any;
  tabldotOzet?: { rows: { sc: number; count: number }[]; total: number; monthLabel: string } | null;
  colors: any;
  styles: any;
}

type SectionTab = 'OPEN' | 'PAID' | 'FINANCIAL';

export default function PreviewModalBody({ previewData, tabldotOzet, colors, styles }: Props) {
  const [sectionTab, setSectionTab] = useState<SectionTab>('OPEN');
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!previewData) return null;

  const tabs: { key: SectionTab; label: string; icon: string }[] = [
    { key: 'OPEN', label: 'Açık', icon: 'hourglass-empty' },
    { key: 'PAID', label: 'Ödendi', icon: 'check-circle' },
    { key: 'FINANCIAL', label: 'Hareketler', icon: 'account-balance-wallet' },
  ];

  const openMealDays = previewData.mealDaysEnriched.filter((d: any) =>
    (d.dayOrdersEnriched as any[]).some((o: any) => !o.isPaid)
  );
  const paidMealDays = previewData.mealDaysEnriched.filter((d: any) =>
    (d.dayOrdersEnriched as any[]).some((o: any) => o.isPaid)
  );

  return (
    <View style={{ gap: 0 }}>
      {/* Özet Kartlar */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[styles.previewStatCard, { backgroundColor: previewData.debtPositive ? colors.dangerBg : colors.surface, borderColor: previewData.debtPositive ? colors.danger : colors.surfaceBorder }]}>
          <Text style={[styles.previewStatLabel, { color: previewData.debtPositive ? colors.danger : colors.muted }]}>GUNCEL BORC</Text>
          <Text style={[styles.previewStatValue, { color: previewData.debtColor }]}>{previewData.debtLabel}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowBreakdown(!showBreakdown)}
          style={[styles.previewStatCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
        >
          <Text style={[styles.previewStatLabel, { color: colors.muted }]}>TOPLAM TABAK ▾</Text>
          <Text style={[styles.previewStatValue, { color: colors.text }]}>{previewData.totalPlates}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabldot Dağılım Detayı */}
      {showBreakdown && (
        <View style={{ 
          backgroundColor: colors.surface, 
          borderColor: colors.surfaceBorder, 
          borderWidth: 1, 
          borderRadius: 12, 
          padding: 14, 
          marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <MaterialIcons name="restaurant" size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Tabldot Dağılım Detayı</Text>
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>2'li Tabldot (2 Kurs)</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{previewData.tabldot2Count || 0} adet</Text>
            </View>
            <View style={{ height: 0.5, backgroundColor: colors.surfaceBorder }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>3'lü Tabldot (3 Kurs)</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{previewData.tabldot3Count || 0} adet</Text>
            </View>
            <View style={{ height: 0.5, backgroundColor: colors.surfaceBorder }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>4'lü Tabldot (4 Kurs)</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{previewData.tabldot4Count || 0} adet</Text>
            </View>
          </View>
        </View>
      )}

      {/* Sekme Butonları */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {tabs.map((t) => {
          const isActive = sectionTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setSectionTab(t.key)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.surfaceBorder,
              }}
            >
              <MaterialIcons name={t.icon as any} size={14} color={isActive ? '#fff' : colors.muted} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#fff' : colors.muted }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ACIK YEMEKLER */}
      {sectionTab === 'OPEN' && (
        <View>
          {openMealDays.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <MaterialIcons name="check-circle" size={40} color="#16a34a" />
              <Text style={{ color: colors.muted, fontWeight: '600' }}>Tum yemekler odendi.</Text>
            </View>
          ) : openMealDays.map(({ dateKey, date, dayOrdersEnriched }: any) => {
            const openOrders = dayOrdersEnriched.filter((o: any) => !o.isPaid);
            if (openOrders.length === 0) return null;
            return (
              <View key={dateKey} style={styles.previewDayBlock}>
                <View style={styles.previewDayHeader}>
                  <Text style={styles.previewDayDate}>
                    {(date as Date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                  <View style={[styles.previewBadge, styles.previewBadgeOpen]}>
                    <Text style={[styles.previewBadgeText, { color: '#854F0B' }]}>Acik</Text>
                  </View>
                </View>
                {openOrders.map((order: any) => (
                  <View key={order.id} style={styles.previewPersonRow}>
                    <View style={styles.previewAvatar}>
                      <Text style={styles.previewAvatarText}>{order.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewPersonName}>{order.userName || 'Musteri'}</Text>
                      {order.hasSelections ? (
                        <View style={{ gap: 6 }}>
                          {(order.allTabldotItems as any[]).map((t: any, ti: number) => (
                            <View key={ti} style={{ gap: 4 }}>
                              <View style={styles.previewTabldotTag}>
                                <Text style={styles.previewTabldotTagText}>{t.quantity > 1 ? `${t.quantity}x ` : ''}{t.label}</Text>
                              </View>
                              {t.mealContents.length > 0 && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                  {(t.mealContents as string[]).map((mc: string, mi: number) => (
                                    <View key={mi} style={styles.previewMealChip}>
                                      <Text style={styles.previewMealChipText}>{mc}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          ))}
                          {/* Tabldotla birlikte gelen ek ürünler (Cacık vb.) */}
                          {order.allRegularItems?.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                              {(order.allRegularItems as string[]).map((name: string, ri: number) => (
                                <View key={ri} style={styles.previewMealChip}>
                                  <Text style={styles.previewMealChipText}>{name}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ) : order.allRegularItems?.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {(order.allRegularItems as string[]).map((name: string, ri: number) => (
                            <View key={ri} style={styles.previewMealChip}>
                              <Text style={styles.previewMealChipText}>{name}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.previewOtherItem}>Yemek siparisi</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* ODENDI YEMEKLER */}
      {sectionTab === 'PAID' && (
        <View>
          {paidMealDays.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <MaterialIcons name="hourglass-empty" size={40} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: '600' }}>Henuz odenen yemek yok.</Text>
            </View>
          ) : paidMealDays.map(({ dateKey, date, dayOrdersEnriched }: any) => {
            const paidOrders = (dayOrdersEnriched as any[]).filter((o: any) => o.isPaid);
            if (paidOrders.length === 0) return null;
            return (
            <View key={dateKey} style={[styles.previewDayBlock, { opacity: 0.7 }]}>
              <View style={styles.previewDayHeader}>
                <Text style={styles.previewDayDate}>
                  {(date as Date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <View style={[styles.previewBadge, styles.previewBadgePaid]}>
                  <Text style={[styles.previewBadgeText, { color: '#3B6D11' }]}>Odendi</Text>
                </View>
              </View>
              {paidOrders.map((order: any) => (
                <View key={order.id} style={styles.previewPersonRow}>
                  <View style={styles.previewAvatar}>
                    <Text style={styles.previewAvatarText}>{order.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewPersonName}>{order.userName || 'Musteri'}</Text>
                    {order.hasSelections ? (
                      <View style={{ gap: 4 }}>
                        {(order.allTabldotItems as any[]).map((t: any, ti: number) => (
                          <View key={ti} style={styles.previewTabldotTag}>
                            <Text style={styles.previewTabldotTagText}>{t.quantity > 1 ? `${t.quantity}x ` : ''}{t.label}</Text>
                          </View>
                        ))}
                        {/* Tabldotla birlikte gelen ek ürünler (Cacık vb.) */}
                        {order.allRegularItems?.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            {(order.allRegularItems as string[]).map((name: string, ri: number) => (
                              <View key={ri} style={styles.previewMealChip}>
                                <Text style={styles.previewMealChipText}>{name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : order.allRegularItems?.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                        {(order.allRegularItems as string[]).map((name: string, ri: number) => (
                          <View key={ri} style={styles.previewMealChip}>
                            <Text style={styles.previewMealChipText}>{name}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.previewOtherItem}>Yemek siparisi</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
            );
          })}
        </View>
      )}

      {/* HESAP HAREKETLERI */}
      {sectionTab === 'FINANCIAL' && (
        <View>
          {previewData.hasFinancial ? (
            <View style={styles.previewFinanceCard}>
              {previewData.financialRows.map((entry: any) => {
                const badgeStyle = entry.badgeKey === 'payment'
                  ? styles.previewBadgePayment
                  : entry.badgeKey === 'closing'
                  ? styles.previewBadgeClosing
                  : styles.previewBadgeOpen;
                return (
                  <View key={entry.id} style={[styles.previewFinanceRow, entry.notLast && { borderBottomWidth: 0.5, borderColor: colors.surfaceBorder }]}>
                    <Text style={styles.previewFinanceDate}>{new Date(entry.created_at).toLocaleDateString('tr-TR')}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewFinanceLabel}>{entry.label}</Text>
                      {entry.note ? <Text style={styles.previewFinanceNote} numberOfLines={1}>{entry.note}</Text> : null}
                    </View>
                    {entry.hasAmount ? (
                      <Text style={[styles.previewFinanceAmount, { color: entry.amountColor }]}>{entry.amountStr}</Text>
                    ) : null}
                    <View style={[styles.previewBadge, badgeStyle, { marginLeft: 8 }]}>
                      <Text style={[styles.previewBadgeText, { color: entry.badgeColor }]}>{entry.badgeLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <MaterialIcons name="account-balance-wallet" size={40} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: '600' }}>Henuz hesap hareketi yok.</Text>
            </View>
          )}
        </View>
      )}

      {/* TABLDOT OZETI — seçili aya göre */}
      {tabldotOzet && tabldotOzet.rows.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tabldot Ozeti
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>{tabldotOzet.monthLabel}</Text>
          </View>
          <View style={[styles.previewFinanceCard]}>
            {tabldotOzet.rows.map((row, idx) => (
              <View
                key={row.sc}
                style={[
                  styles.previewFinanceRow,
                  idx < tabldotOzet.rows.length - 1 && { borderBottomWidth: 0.5, borderColor: colors.surfaceBorder },
                ]}
              >
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: row.sc === 4 ? '#185FA5' : row.sc === 3 ? '#1D9E75' : '#BA7517',
                  marginRight: 8,
                }} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>{row.sc}'lü Tabldot</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{row.count} adet</Text>
              </View>
            ))}
            <View style={[styles.previewFinanceRow, { backgroundColor: colors.surfaceAlt || colors.surface }]}>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>Toplam</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#185FA5' }}>{tabldotOzet.total} adet</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
