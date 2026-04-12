import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserRole, UserRole } from '@/lib/hooks/useUserRole';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Belirli rollere göre içeriği gizleyen veya gösteren koruyucu bileşen.
 */
export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { role, loading } = useUserRole();

  if (loading) return null;

  if (!role || !allowedRoles.includes(role)) {
    return fallback || null;
  }

  return <>{children}</>;
}

export function AccessDenied() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bu içeriği görüntüleme yetkiniz bulunmamaktadır.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
});
