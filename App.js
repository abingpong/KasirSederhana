import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Keyboard, ActivityIndicator, Platform, StatusBar, SafeAreaView, ScrollView, Modal, SectionList, FlatList, LayoutAnimation, UIManager } from 'react-native';

// --- FIREBASE SETUP ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- TEMA WARNA MODERN (SLATE & INDIGO) ---
const COLORS = {
  background: '#F1F5F9', // Slate 100
  cardBg: '#FFFFFF',
  primary: '#4F46E5', // Indigo 600
  primaryLight: '#EEF2FF', // Indigo 50
  admin: '#F59E0B', // Amber 500
  adminLight: '#FEF3C7', // Amber 50
  danger: '#EF4444', // Red 500
  dangerLight: '#FEF2F2', // Red 50
  textMain: '#0F172A', // Slate 900
  textMuted: '#64748B', // Slate 500
  border: '#E2E8F0', // Slate 200
  overlay: 'rgba(15, 23, 42, 0.5)',
  avatarBg: ['#FCA5A5', '#FCD34D', '#86EFAC', '#93C5FD', '#C4B5FD', '#F9A8D4', '#FDBA74']
};

const getAvatarColor = (str) => {
  if (!str) return COLORS.avatarBg[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS.avatarBg[Math.abs(hash) % COLORS.avatarBg.length];
};

export default function App() {
  const [viewMode, setViewMode] = useState('cashier'); 
  const [inventory, setInventory] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [cart, setCart] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); 
  const [sortType, setSortType] = useState('az'); 

  const animateLayout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  useEffect(() => {
    const q = query(collection(db, "barang"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      animateLayout();
      setInventory(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getProcessedData = () => {
    let filteredData = inventory.filter(item => {
      const name = item.name ? item.name.toUpperCase() : '';
      const cat = item.category ? item.category.toUpperCase() : '';
      const queryStr = searchQuery.toUpperCase();
      return name.includes(queryStr) || cat.includes(queryStr); 
    });

    if (sortType === 'az') {
        filteredData.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortType === 'price_low') {
        filteredData.sort((a, b) => a.price - b.price);
    }

    const groupedData = filteredData.reduce((acc, item) => {
      const category = (item.category || 'UMUM').toUpperCase(); 
      if (!acc[category]) { acc[category] = []; }
      acc[category].push(item);
      return acc;
    }, {});

    const sections = Object.keys(groupedData).map(key => ({
      title: key,
      data: groupedData[key]
    }));

    return sections.sort((a, b) => a.title.localeCompare(b.title));
  };

  const addToCart = (item) => {
    animateLayout();
    setCart(currentCart => {
      const existing = currentCart.find(i => i.id === item.id);
      if (existing) return currentCart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...currentCart, { ...item, qty: 1 }];
    });
  };
  
  const updateQty = (id, change) => {
    animateLayout();
    setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + change } : i).filter(i => i.qty > 0));
  };
  
  const clearCart = () => {
    animateLayout();
    setCart([]);
  };
  
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const saveItem = async () => {
    if (!itemName || !itemPrice) { alert('Harap isi data dengan lengkap.'); return; }
    const payload = { name: itemName, price: parseInt(itemPrice), category: itemCategory || 'Umum' };
    try {
      if (editMode) { 
        await updateDoc(doc(db, "barang", editMode), payload); 
        animateLayout();
        setEditMode(null); 
      }
      else { 
        await addDoc(collection(db, "barang"), { ...payload, createdAt: new Date() }); 
      }
      setItemName(''); setItemPrice(''); setItemCategory('');
      if (Platform.OS !== 'web') Keyboard.dismiss();
    } catch (e) { alert(e.message); }
  };
  
  const prepareEdit = (item) => { 
    animateLayout();
    setItemName(item.name); setItemPrice(item.price.toString()); setItemCategory(item.category || ''); setEditMode(item.id); 
  };
  
  const deleteItem = async (id) => {
    const act = async () => { try { await deleteDoc(doc(db, "barang", id)); } catch (e) { alert(e.message); } };
    Platform.OS === 'web' ? (confirm("Hapus item ini?") && act()) : Alert.alert('Konfirmasi', 'Hapus item ini dari database?', [{ text: 'Batal', style:'cancel' }, { text: 'Hapus', onPress: act, style:'destructive' }]);
  };

  const toggleViewMode = () => {
    animateLayout();
    setViewMode(viewMode === 'cashier' ? 'admin' : 'cashier');
  };

  const SortButton = ({ label, value, active }) => (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={() => { animateLayout(); setSortType(value); }} 
      style={[
        styles.sortChip, 
        active && { 
          backgroundColor: viewMode === 'admin' ? COLORS.admin : COLORS.primary, 
          borderColor: viewMode === 'admin' ? COLORS.admin : COLORS.primary 
        }
      ]}
    >
      <Text style={[styles.sortText, active && { color: COLORS.cardBg }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <View style={{flex: 1}}>
            <Text style={[styles.headerTitle, { color: viewMode === 'admin' ? COLORS.admin : COLORS.primary }]}>
              {viewMode === 'admin' ? 'Manajemen Data' : 'Warkop SUyitno'}
            </Text>
            <Text style={styles.headerSub}>{viewMode === 'admin' ? 'Kelola inventaris warung Anda' : 'Mau pesan apa hari ini?'}</Text>
        </View>
        <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.switchBtn, { backgroundColor: viewMode === 'admin' ? COLORS.adminLight : COLORS.primaryLight }]} 
            onPress={toggleViewMode}
        >
            <Text style={{color: viewMode === 'admin' ? COLORS.admin : COLORS.primary, fontSize: 13, fontWeight: '700'}}>
              {viewMode === 'cashier' ? 'Admin Mode' : 'Kasir Mode'}
            </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        
        {/* INPUT CARD FOR ADMIN */}
        {viewMode === 'admin' && (
          <View style={styles.inputCard}>
            <Text style={[styles.sectionTitle, { color: COLORS.admin }]}>{editMode ? "✎ Edit Barang" : "➕ Tambah Barang"}</Text>
            <TextInput style={styles.input} placeholder="Nama Produk" placeholderTextColor={COLORS.textMuted} value={itemName} onChangeText={setItemName} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1.5 }]} placeholder="Kategori (Mkn/Mnmn)" placeholderTextColor={COLORS.textMuted} value={itemCategory} onChangeText={setItemCategory} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Harga" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={itemPrice} onChangeText={setItemPrice} />
            </View>
            <View style={{flexDirection:'row', gap: 12, marginTop: 4}}>
               {editMode && (
                 <TouchableOpacity activeOpacity={0.8} onPress={()=>{animateLayout(); setEditMode(null);setItemName('');setItemPrice('');setItemCategory('')}} style={[styles.btnFull, {backgroundColor: COLORS.background}]}>
                   <Text style={{color: COLORS.textMuted, fontWeight: '600'}}>Batal</Text>
                 </TouchableOpacity>
               )}
               <TouchableOpacity activeOpacity={0.8} onPress={saveItem} style={[styles.btnFull, {backgroundColor: COLORS.admin}]}>
                 <Text style={{color: COLORS.cardBg, fontWeight:'700', fontSize: 15}}>{editMode ? "Simpan Perubahan" : "Tambahkan"}</Text>
               </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MAIN CONTENT AREA */}
        <View style={{flex: 1}}>
          <View style={{marginBottom: 16}}>
            <View style={styles.searchContainer}>
              <Text style={{color: COLORS.textMuted, marginRight: 10, fontSize: 16}}>🔍</Text>
              <TextInput style={styles.searchInput} placeholder="Cari nama atau kategori..." placeholderTextColor={COLORS.textMuted} value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <View style={{height: 44, marginTop: 12}}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10}}>
                <SortButton label="A-Z" value="az" active={sortType === 'az'} />
                <SortButton label="Harga Terendah" value="price_low" active={sortType === 'price_low'} />
                <SortButton label="Terbaru" value="newest" active={sortType === 'newest'} />
              </ScrollView>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={viewMode === 'admin' ? COLORS.admin : COLORS.primary} style={{marginTop: 40}} />
          ) : (
            <SectionList
              sections={getProcessedData()}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: viewMode === 'cashier' && cart.length > 0 ? 120 : 40 }}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeaderContainer}>
                  <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
                const avatarColor = getAvatarColor(item.name);
                return (
                  <TouchableOpacity 
                      activeOpacity={0.7} 
                      onPress={() => viewMode === 'cashier' ? addToCart(item) : prepareEdit(item)}
                  >
                    <View style={[styles.itemCard, editMode === item.id && {borderColor: COLORS.admin, borderWidth: 1.5, shadowColor: COLORS.admin}]}>
                      <View style={[styles.itemAvatar, { backgroundColor: avatarColor }]}>
                        <Text style={styles.itemAvatarText}>{initial}</Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.itemPrice, { color: viewMode === 'admin' ? COLORS.textMuted : COLORS.primary }]}>Rp {item.price.toLocaleString('id-ID')}</Text>
                      </View>
                      
                      {viewMode === 'admin' ? (
                          <TouchableOpacity activeOpacity={0.7} onPress={() => deleteItem(item.id)} style={styles.iconBtnDelete}>
                             <Text style={{color: COLORS.danger, fontWeight: '700', fontSize: 13}}>Hapus</Text>
                          </TouchableOpacity>
                      ) : (
                          <View style={styles.addBtnSmall}>
                            <Text style={{color: COLORS.primary, fontWeight:'700', fontSize: 20}}>+</Text>
                          </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>

      {/* FLOATING CART SUMMARY (CASHIER MODE) */}
      {viewMode === 'cashier' && cart.length > 0 && (
        <View style={styles.floatingCartWrapper}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => { animateLayout(); setShowCartModal(true); }}>
            <View style={styles.floatingCart}>
              <View style={styles.floatingCartLeft}>
                 <View style={styles.qtyBadgeFloat}><Text style={styles.qtyTextFloat}>{totalItems}</Text></View>
                 <View style={{marginLeft: 12}}>
                   <Text style={styles.floatingTotalLabel}>Total Belanja</Text>
                   <Text style={styles.floatingTotalValue}>Rp {totalPrice.toLocaleString('id-ID')}</Text>
                 </View>
              </View>
              <View style={styles.floatingCartRight}>
                 <Text style={styles.floatingCheckoutText}>Bayar</Text>
                 <Text style={{color: COLORS.cardBg, fontSize: 16, marginLeft: 4}}>→</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* BOTTOM SHEET MODAL UNTUK CART */}
      <Modal animationType="slide" transparent={true} visible={showCartModal} onRequestClose={() => setShowCartModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCartModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pesanan Saat Ini</Text>
              <TouchableOpacity onPress={() => setShowCartModal(false)} style={styles.closeBtn}>
                <Text style={{color: COLORS.textMuted, fontSize: 22, fontWeight: '300'}}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
                data={cart}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 40, color: COLORS.textMuted, fontSize: 16}}>Keranjang masih kosong.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.cartItem}>
                    <View style={{flex: 1, paddingRight: 10}}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>Rp {item.price.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.qty}</Text>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => updateQty(item.id, 1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                    <View style={{alignItems: 'flex-end', minWidth: 85}}>
                       <Text style={{fontWeight: '700', color: COLORS.textMain, fontSize: 15}}>Rp {(item.price * item.qty).toLocaleString('id-ID')}</Text>
                    </View>
                  </View>
                )}
            />
            <View style={styles.modalFooter}>
               <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center'}}>
                 <Text style={{fontSize: 16, color: COLORS.textMuted, fontWeight: '500'}}>Total Pembayaran</Text>
                 <Text style={{fontSize: 24, fontWeight: '800', color: COLORS.primary}}>Rp {totalPrice.toLocaleString('id-ID')}</Text>
               </View>
               <View style={{flexDirection: 'row', gap: 12}}>
                 <TouchableOpacity activeOpacity={0.8} onPress={() => { clearCart(); setShowCartModal(false); }} style={[styles.btnFull, {backgroundColor: COLORS.dangerLight, flex: 0.8}]}>
                   <Text style={{color: COLORS.danger, fontWeight: '700'}}>Hapus Semua</Text>
                 </TouchableOpacity>
                 <TouchableOpacity activeOpacity={0.8} onPress={() => { alert('Fitur pembayaran belum terintegrasi.'); setShowCartModal(false); }} style={[styles.btnFull, {backgroundColor: COLORS.primary, flex: 1.2}]}>
                   <Text style={{color: COLORS.cardBg, fontWeight: '700', fontSize: 16}}>Proses Bayar</Text>
                 </TouchableOpacity>
               </View>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, paddingHorizontal: 20 },
  
  // Header
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, fontWeight: '500' },
  switchBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },

  // Admin Input Card
  inputCard: { backgroundColor: COLORS.cardBg, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: COLORS.textMain, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  input: { backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, fontSize: 15, color: COLORS.textMain, marginBottom: 12, fontWeight: '500' },
  btnFull: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Search & Filter
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: 16, paddingHorizontal: 18, shadowColor: COLORS.textMain, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 16, fontSize: 15, color: COLORS.textMain, fontWeight: '500' },
  sortChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, marginRight: 10, backgroundColor: COLORS.cardBg },
  sortText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },

  // Item List
  sectionHeaderContainer: { marginTop: 24, marginBottom: 12, backgroundColor: COLORS.background },
  sectionHeaderText: { fontSize: 15, fontWeight: '800', color: COLORS.textMain, textTransform: 'uppercase', letterSpacing: 1 },
  
  itemCard: { backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: COLORS.textMain, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  itemAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  itemAvatarText: { color: COLORS.cardBg, fontSize: 20, fontWeight: '800' },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  itemPrice: { fontSize: 15, fontWeight: '700' },
  
  iconBtnDelete: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.dangerLight },
  addBtnSmall: { backgroundColor: COLORS.primaryLight, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  // Floating Cart
  floatingCartWrapper: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  floatingCart: { backgroundColor: COLORS.primary, borderRadius: 24, padding: 16, paddingLeft: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center' },
  qtyBadgeFloat: { backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  qtyTextFloat: { color: COLORS.cardBg, fontWeight: '800', fontSize: 16 },
  floatingTotalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  floatingTotalValue: { color: COLORS.cardBg, fontSize: 18, fontWeight: '800', marginTop: 2 },
  floatingCartRight: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  floatingCheckoutText: { color: COLORS.cardBg, fontWeight: '700', fontSize: 15 },

  // Bottom Sheet Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay },
  modalContent: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  dragHandle: { width: 40, height: 5, backgroundColor: COLORS.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  closeBtn: { backgroundColor: COLORS.background, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  cartItemName: { fontWeight: '700', fontSize: 16, color: COLORS.textMain, marginBottom: 6 },
  cartItemPrice: { color: COLORS.textMuted, fontSize: 14, fontWeight: '500' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.textMuted },
  qtyValue: { fontSize: 16, fontWeight: '700', paddingHorizontal: 10, color: COLORS.textMain },
  
  modalFooter: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLORS.background }
});