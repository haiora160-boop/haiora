import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function MobileHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>POS SaaS Mobile</Text>
      <Text style={styles.title}>App nhân viên / quản lý / khách hàng</Text>
      <Text style={styles.desc}>Scaffold Expo để phát triển order bằng điện thoại, QR order, push notification và offline queue.</Text>
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Bắt đầu phát triển</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0f172a' },
  badge: { color: '#93c5fd', fontWeight: '800', marginBottom: 16 },
  title: { color: 'white', fontSize: 32, fontWeight: '900', lineHeight: 38 },
  desc: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, marginTop: 16 },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 18, marginTop: 28, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '900' },
});
