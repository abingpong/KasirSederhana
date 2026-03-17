import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, SafeAreaView, SectionList
} from 'react-native';

// FONT
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

// FIREBASE
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// COLORS
const COLORS = {
  background: '#F7F9FC',
  cardBg: '#FFFFFF',
  primary: '#2C3E50',
  textMain: '#2D3436',
  textMuted: '#A0AAB2',
  border: '#EDF1F5',
};

export default function App() {

  // FONT LOAD SAFE
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // STATE
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // FIREBASE SAFE FETCH
  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(collection(db, "barang"), (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInventory(items);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.log("Firebase Error:", e);
      setLoading(false);
    }
  }, []);

  // GROUP DATA
  const getData = () => {
    const filtered = inventory.filter(item =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped = filtered.reduce((acc, item) => {
      const cat = (item.category || 'UMUM').toUpperCase();
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    return Object.keys(grouped).map(key => ({
      title: key,
      data: grouped[key]
    }));
  };

  // CART
  const addToCart = (item) => {
    setCart(c => {
      const exist = c.find(i => i.id === item.id);
      if (exist) {
        return c.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...c, { ...item, qty: 1 }];
    });
  };

  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  // PREVENT BLANK SCREEN
  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <Text>Loading Font...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kasir Warkop</Text>
        <Text style={styles.headerSub}>Mode Transaksi</Text>
      </View>

      <View style={styles.container}>

        {/* TOTAL */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rp {totalPrice.toLocaleString('id-ID')}</Text>
          <Text style={styles.totalItems}>{totalItems} item</Text>
        </View>

        {/* SEARCH */}
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Cari produk..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* LOADING */}
        {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

        {/* EMPTY */}
        {!loading && inventory.length === 0 && (
          <Text style={styles.empty}>Belum ada data barang</Text>
        )}

        {/* LIST */}
        <SectionList
          sections={getData()}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.section}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => addToCart(item)} activeOpacity={0.6}>
              <View style={styles.item}>
                <View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>Rp {item.price}</Text>
                </View>

                <View style={styles.addBtn}>
                  <Text style={{ color: 'white', fontSize: 20 }}>+</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />

      </View>
    </SafeAreaView>
  );
}

// STYLE
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  container: {
    flex: 1,
    paddingHorizontal: 14,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  header: {
    padding: 16,
  },

  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: COLORS.primary,
  },

  headerSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textMuted,
  },

  totalCard: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
  },

  totalLabel: {
    color: '#D0D7DE',
    fontFamily: 'Inter_400Regular',
  },

  totalValue: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },

  totalItems: {
    color: '#D0D7DE',
    marginTop: 4,
  },

  searchBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 10,
  },

  searchInput: {
    padding: 12,
    fontFamily: 'Inter_400Regular',
  },

  section: {
    marginTop: 12,
    marginBottom: 6,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: COLORS.textMuted,
  },

  item: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  itemName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMain,
  },

  itemPrice: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: COLORS.primary,
  },

  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.textMuted,
    fontFamily: 'Inter_400Regular'
  }
});