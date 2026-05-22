import { View, Text, Pressable, StyleSheet, Image, SafeAreaView } from 'react-native';

export default function MobileHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.badge}>Smart POS – Smart Business</Text>
        <Text style={styles.title}>HAIORA POS Mobile</Text>
        <Text style={styles.desc}>Giao diện điện thoại dành cho nhân viên order, quản lý doanh thu, QR order và vận hành quán F&B.</Text>
        <View style={styles.grid}>
          <View style={styles.card}><Text style={styles.cardTitle}>Order nhanh</Text><Text style={styles.cardText}>Chạm món, chọn bàn, gửi bếp.</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>Realtime</Text><Text style={styles.cardText}>Đồng bộ trạng thái bàn/bếp.</Text></View>
        </View>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Mở hệ thống POS</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fffaf0' },
  container: { flex: 1, padding: 22, justifyContent: 'center' },
  logoWrap: { alignSelf: 'center', width: 152, height: 152, borderRadius: 38, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#6b3f00', shadowOpacity: 0.16, shadowRadius: 22, elevation: 6, marginBottom: 20 },
  logo: { width: 120, height: 120 },
  badge: { alignSelf: 'center', color: '#b7791f', fontWeight: '900', marginBottom: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 32, fontWeight: '900', textAlign: 'center', lineHeight: 38 },
  desc: { color: '#64748b', fontSize: 16, lineHeight: 24, marginTop: 14, textAlign: 'center', fontWeight: '600' },
  grid: { flexDirection: 'row', gap: 12, marginTop: 24 },
  card: { flex: 1, backgroundColor: 'white', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#f1d99c' },
  cardTitle: { color: '#6b3f00', fontWeight: '900', fontSize: 15 },
  cardText: { color: '#64748b', marginTop: 6, fontWeight: '600', lineHeight: 18 },
  button: { minHeight: 54, backgroundColor: '#6b3f00', padding: 16, borderRadius: 22, marginTop: 26, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '900', fontSize: 16 }
});
