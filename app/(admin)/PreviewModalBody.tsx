import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface Props {
  previewData: any;
  colors: any;
  styles: any;
}

type SectionTab = 'OPEN' | 'PAID' | 'FINANCIAL';

export default function PreviewModalBody({ previewData, colors, styles }: Props) {
  const [sectionTab, setSectionTab] = useState<SectionTab>('OPEN');

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
    (d.dayOrdersEnriched as any[]).every((o: any) => o.isPaid)
  );

  return (
    <View style={{ gap: 0 }}>
      {/* Özet Kartlar */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={[styles.previewStatCard, { backgroundColor: previewData.debtPositive ? colors.dangerBg : colors.surface, borderColor: previewData.debtPositive ? colors.danger : colors.surfaceBorder }]}>
          <Text style={[styles.previewStatLabel, { color: previewData.debtPositive ? colors.danger : colors.muted }]}>GUNCEL BORC</Text>
          <Text style={[styles.previewStatValue, { color: previewData.debtColor }]}>{previewData.debtLabel}</Text>
        </View>
        <View style={[styles.previewStatCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.previewStatLabel, { color: colors.muted }]}>TOPLAM TABAK</Text>
          <Text style={[styles.previewStatValue, { color: colors.text }]}>{previewData.totalPlates}</Text>
        </View>
      </View>

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
                        <View style={{ gap: 4 }}>
                          <View style={styles.previewTabldotTag}>
                            <Text style={styles.previewTabldotTagText}>{order.tabldotQuantity > 1 ? `${order.tabldotQuantity}x ` : ''}{order.tabldotLabel}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                            {order.mealContents.map((mc: string, mi: number) => (
                              <View key={mi} style={styles.previewMealChip}>
                                <Text style={styles.previewMealChipText}>{mc}</Text>
                              </View>
                            ))}
                          </View>
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
          ) : paidMealDays.map(({ dateKey, date, dayOrdersEnriched }: any) => (
            <View key={dateKey} style={[styles.previewDayBlock, { opacity: 0.7 }]}>
              <View style={styles.previewDayHeader}>
                <Text style={styles.previewDayDate}>
                  {(date as Date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <View style={[styles.previewBadge, styles.previewBadgePaid]}>
                  <Text style={[styles.previewBadgeText, { color: '#3B6D11' }]}>Odendi</Text>
                </View>
              </View>
              {dayOrdersEnriched.map((order: any) => (
                <View key={order.id} style={styles.previewPersonRow}>
                  <View style={styles.previewAvatar}>
                    <Text style={styles.previewAvatarText}>{order.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewPersonName}>{order.userName || 'Musteri'}</Text>
                    {order.hasSelections ? (
                      <View style={styles.previewTabldotTag}>
                        <Text style={styles.previewTabldotTagText}>{order.tabldotQuantity > 1 ? `${order.tabldotQuantity}x ` : ''}{order.tabldotLabel}</Text>
                      </View>
                    ) : (
                      <Text style={styles.previewOtherItem}>Yemek siparisi</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}
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
    </View>
  );
}
