import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Keyboard, ActivityIndicator, Platform, StatusBar, SafeAreaView, ScrollView, Modal, SectionList, FlatList } from 'react-native';

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

// --- TEMA WARNA MINIMALIS & ELEGAN ---
const COLORS = {
  background: '#F7F9FC',
  cardBg: '#FFFFFF',
  primary: '#2C3E50',
  admin: '#B68D40',
  accent: '#3498DB',
  danger: '#E74C3C',
  textMain: '#2D3436',
  textMuted: '#A0AAB2',
  border: '#EDF1F5',
  overlay: 'rgba(44, 62, 80, 0.4)',
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
  const [sortType, setSortType] = useState('az'); // Default ke az agar pengelompokan rapi

  useEffect(() => {
    const q = query(collection(db, "barang"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventory(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- LOGIC PROCESSED DATA (UNTUK SECTIONLIST) ---
  const getProcessedData = () => {
    // 1. Filter pencarian
    let filteredData = inventory.filter(item => {
      const name = item.name ? item.name.toUpperCase() : '';
      const cat = item.category ? item.category.toUpperCase() : '';
      const queryStr = searchQuery.toUpperCase();
      return name.includes(queryStr) || cat.includes(queryStr); 
    });

    // 2. Sorting di dalam kategori
    if (sortType === 'az') {
        filteredData.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortType === 'price_low') {
        filteredData.sort((a, b) => a.price - b.price);
    } else if (sortType === 'newest') {
        // Biarkan sesuai urutan default dari firebase
    }

    // 3. Kelompokkan berdasarkan kategori
    const groupedData = filteredData.reduce((acc, item) => {
      const category = (item.category || 'UMUM').toUpperCase(); // Default 'UMUM' jika kosong
      if (!acc[category]) { acc[category] = []; }
      acc[category].push(item);
      return acc;
    }, {});

    // 4. Ubah format menjadi array objek untuk SectionList
    const sections = Object.keys(groupedData).map(key => ({
      title: key,
      data: groupedData[key]
    }));

    // 5. Urutkan nama kategori sesuai abjad (A-Z)
    return sections.sort((a, b) => a.title.localeCompare(b.title));
  };

  const addToCart = (item) => {
    setCart(currentCart => {
      const existing = currentCart.find(i => i.id === item.id);
      if (existing) return currentCart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...currentCart, { ...item, qty: 1 }];
    });
  };
  const updateQty = (id, change) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + change } : i).filter(i => i.qty > 0));
  const removeFromCart = (id) => setCart(c => c.filter(i => i.id !== id));
  const clearCart = () => setCart([]);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const saveItem = async () => {
    if (!itemName || !itemPrice) { alert('Harap isi data dengan lengkap.'); return; }
    const payload = { name: itemName, price: parseInt(itemPrice), category: itemCategory || 'Umum' };
    try {
      if (editMode) { await updateDoc(doc(db, "barang", editMode), payload); setEditMode(null); }
      else { await addDoc(collection(db, "barang"), { ...payload, createdAt: new Date() }); }
      setItemName(''); setItemPrice(''); setItemCategory('');
      if (Platform.OS !== 'web') Keyboard.dismiss();
    } catch (e) { alert(e.message); }
  };
  
  const prepareEdit = (item) => { 
    setItemName(item.name); setItemPrice(item.price.toString()); setItemCategory(item.category || ''); setEditMode(item.id); 
  };
  
  const deleteItem = async (id) => {
    const act = async () => { try { await deleteDoc(doc(db, "barang", id)); } catch (e) { alert(e.message); } };
    Platform.OS === 'web' ? (confirm("Hapus item ini?") && act()) : Alert.alert('Konfirmasi', 'Hapus item ini dari database?', [{ text: 'Batal', style:'cancel' }, { text: 'Hapus', onPress: act, style:'destructive' }]);
  };

  const SortButton = ({ label, value, active }) => (
    <TouchableOpacity onPress={() => setSortType(value)} style={[styles.sortChip, active && { backgroundColor: viewMode === 'admin' ? COLORS.admin : COLORS.primary, borderColor: viewMode === 'admin' ? COLORS.admin : COLORS.primary }]}>
      <Text style={[styles.sortText, active && { color: COLORS.cardBg }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <View style={styles.headerContainer}>
        <View style={{flex: 1}}>
            <Text style={[styles.headerTitle, { color: viewMode === 'admin' ? COLORS.admin : COLORS.primary }]}>
              {viewMode === 'admin' ? 'Manajemen Data' : 'Kasir Warkop'}
            </Text>
            <Text style={styles.headerSub}>{viewMode === 'admin' ? 'Mode Administrator' : 'Mode Transaksi'}</Text>
        </View>
        <TouchableOpacity 
            style={[styles.switchBtn, { backgroundColor: viewMode === 'admin' ? '#FDF8F0' : '#F0F4F8', borderColor: viewMode === 'admin' ? '#EFE1C6' : '#D9E2EC' }]} 
            onPress={() => setViewMode(viewMode === 'cashier' ? 'admin' : 'cashier')}
        >
            <Text style={{color: viewMode === 'admin' ? COLORS.admin : COLORS.primary, fontSize: 13, fontWeight: '600'}}>
              {viewMode === 'cashier' ? 'Ke Admin' : 'Ke Kasir'}
            </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        
        {viewMode === 'cashier' && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setShowCartModal(true)}>
            <View style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>Total Tagihan</Text>
                <Text style={styles.totalValue}>Rp {totalPrice.toLocaleString('id-ID')}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                 <View style={styles.qtyBadge}><Text style={styles.qtyText}>{totalItems} Item</Text></View>
                 <Text style={{color: COLORS.primary, fontSize: 12, marginTop: 8, fontWeight: '500'}}>Lihat Detail →</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {viewMode === 'admin' && (
          <View style={styles.inputCard}>
            <Text style={[styles.sectionTitle, { color: COLORS.admin }]}>{editMode ? "Edit Item" : "Tambah Item Baru"}</Text>
            <TextInput style={styles.input} placeholder="Nama Produk" placeholderTextColor={COLORS.textMuted} value={itemName} onChangeText={setItemName} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1.5 }]} placeholder="Kategori" placeholderTextColor={COLORS.textMuted} value={itemCategory} onChangeText={setItemCategory} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Harga" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={itemPrice} onChangeText={setItemPrice} />
            </View>
            <View style={{flexDirection:'row', gap: 10, marginTop: 5}}>
               {editMode && <TouchableOpacity onPress={()=>{setEditMode(null);setItemName('');setItemPrice('');setItemCategory('')}} style={[styles.btnFull, {backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border}]}><Text style={{color: COLORS.textMain, fontWeight: '500'}}>Batal</Text></TouchableOpacity>}
               <TouchableOpacity onPress={saveItem} style={[styles.btnFull, {backgroundColor: COLORS.admin}]}><Text style={{color: COLORS.cardBg, fontWeight:'600'}}>{editMode ? "Simpan Perubahan" : "Tambahkan"}</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{flex: 1}}>
          <View style={{marginBottom: 10}}>
            <View style={styles.searchContainer}>
              <Text style={{color: COLORS.textMuted, marginRight: 8}}>🔍</Text>
              <TextInput style={styles.searchInput} placeholder="Cari nama atau kategori..." placeholderTextColor={COLORS.textMuted} value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <View style={{height: 40, marginTop: 10}}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                <SortButton label="Abjad A-Z" value="az" active={sortType === 'az'} />
                <SortButton label="Harga Terendah" value="price_low" active={sortType === 'price_low'} />
                <SortButton label="Terbaru Ditambah" value="newest" active={sortType === 'newest'} />
              </ScrollView>
            </View>
          </View>

          {loading ? <ActivityIndicator size="large" color={viewMode === 'admin' ? COLORS.admin : COLORS.primary} style={{marginTop: 20}} /> : (
            <SectionList
              sections={getProcessedData()}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              
              // RENDER HEADER KATEGORI
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeaderContainer}>
                  <Text style={styles.sectionHeaderText}>{title}</Text>
                  <View style={styles.sectionHeaderLine} />
                </View>
              )}
              
              // RENDER ISI BARANGNYA
              renderItem={({ item }) => (
                <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => viewMode === 'cashier' ? addToCart(item) : prepareEdit(item)}
                >
                  <View style={[styles.itemCard, editMode === item.id && {borderColor: COLORS.admin, borderWidth: 1.5}]}>
                    <View style={styles.itemLeft}>
                      {/* Badge Kategori Dihapus karena sudah ada header */}
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.itemPrice, { color: viewMode === 'admin' ? COLORS.textMuted : COLORS.primary }]}>Rp {item.price.toLocaleString('id-ID')}</Text>
                    </View>
                    
                    {viewMode === 'admin' ? (
                        <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.iconBtnDelete}>
                           <Text style={{color: COLORS.danger, fontWeight: '500', fontSize: 12}}>Hapus</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.addBtnSmall}><Text style={{color: COLORS.primary, fontWeight:'500', fontSize: 18}}>+</Text></View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>

      <Modal animationType="slide" transparent={true} visible={showCartModal} onRequestClose={() => setShowCartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Pesanan</Text>
              <TouchableOpacity onPress={() => setShowCartModal(false)} style={styles.closeBtn}><Text style={{color: COLORS.textMuted, fontSize: 20}}>×</Text></TouchableOpacity>
            </View>
            <FlatList
                data={cart}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 40, color: COLORS.textMuted}}>Belum ada pesanan.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.cartItem}>
                    <View style={{flex: 1, paddingRight: 10}}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>Rp {item.price.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.qty}</Text>
                      <TouchableOpacity onPress={() => updateQty(item.id, 1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                    <View style={{alignItems: 'flex-end', minWidth: 80}}>
                       <Text style={{fontWeight: '600', color: COLORS.textMain}}>Rp {(item.price * item.qty).toLocaleString('id-ID')}</Text>
                    </View>
                  </View>
                )}
            />
            <View style={styles.modalFooter}>
               <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center'}}>
                 <Text style={{fontSize: 15, color: COLORS.textMuted}}>Total Pembayaran</Text>
                 <Text style={{fontSize: 22, fontWeight: '700', color: COLORS.primary}}>Rp {totalPrice.toLocaleString('id-ID')}</Text>
               </View>
               <View style={{flexDirection: 'row', gap: 12}}>
                 <TouchableOpacity onPress={() => { clearCart(); setShowCartModal(false); }} style={[styles.btnFull, {backgroundColor: '#FFF0F0'}]}><Text style={{color: COLORS.danger, fontWeight: '600'}}>Kosongkan</Text></TouchableOpacity>
                 <TouchableOpacity onPress={() => setShowCartModal(false)} style={[styles.btnFull, {backgroundColor: COLORS.primary}]}><Text style={{color: COLORS.cardBg, fontWeight: '600'}}>Selesai & Bayar</Text></TouchableOpacity>
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
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 25 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  switchBtn: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },

  totalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 3 },
  totalLabel: { color: COLORS.textMuted, fontSize: 13, fontWeight: '500' },
  totalValue: { color: COLORS.textMain, fontSize: 26, fontWeight: '700', marginTop: 4 },
  qtyBadge: { backgroundColor: '#F0F4F8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  qtyText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },

  inputCard: { backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, padding: 16, fontSize: 15, color: COLORS.textMain, marginBottom: 12 },
  btnFull: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: 14, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.textMain },
  sortChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginRight: 8, backgroundColor: COLORS.cardBg },
  sortText: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },

  // --- STYLING HEADER KATEGORI BARU ---
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 10, backgroundColor: COLORS.background },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1 },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: 10 },

  itemCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  itemLeft: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: '700' },
  iconBtnDelete: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFF0F0' },
  addBtnSmall: { backgroundColor: '#F0F4F8', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  closeBtn: { backgroundColor: COLORS.background, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cartItemName: { fontWeight: '600', fontSize: 15, color: COLORS.textMain, marginBottom: 4 },
  cartItemPrice: { color: COLORS.textMuted, fontSize: 13 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 4 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qtyBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.textMuted },
  qtyValue: { fontSize: 15, fontWeight: '600', paddingHorizontal: 8, color: COLORS.textMain },
  modalFooter: { marginTop: 24, paddingTop: 16 }
});