import { create } from 'zustand';
import { Voucher, CurrencyTotal, GrandTotal } from '@/types/voucher';
import { saveVoucher as saveToDb, getAllVouchers, deleteVoucher as deleteFromDb, clearAllVouchers } from '@/utils/storage';

interface VoucherStore {
  vouchers: Voucher[];
  selectedIds: Set<string>;
  isLoading: boolean;
  
  // Actions
  loadVouchers: () => Promise<void>;
  addVoucher: (voucher: Voucher) => Promise<void>;
  updateVoucher: (id: string, updates: Partial<Voucher>) => Promise<void>;
  deleteVoucher: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Computed
  getSelectedVouchers: () => Voucher[];
  calculateTotals: () => GrandTotal;
}

export const useVoucherStore = create<VoucherStore>((set, get) => ({
  vouchers: [],
  selectedIds: new Set(),
  isLoading: false,

  loadVouchers: async () => {
    set({ isLoading: true });
    try {
      const vouchers = await getAllVouchers();
      set({ vouchers: vouchers.sort((a, b) => b.createdAt - a.createdAt) });
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addVoucher: async (voucher) => {
    await saveToDb(voucher);
    set(state => ({
      vouchers: [voucher, ...state.vouchers],
    }));
  },

  updateVoucher: async (id, updates) => {
    const state = get();
    const voucher = state.vouchers.find(v => v.id === id);
    if (!voucher) return;

    const updated = { ...voucher, ...updates };
    await saveToDb(updated);
    
    set(state => ({
      vouchers: state.vouchers.map(v => v.id === id ? updated : v),
    }));
  },

  deleteVoucher: async (id) => {
    await deleteFromDb(id);
    set(state => ({
      vouchers: state.vouchers.filter(v => v.id !== id),
      selectedIds: new Set([...state.selectedIds].filter(sid => sid !== id)),
    }));
  },

  clearAll: async () => {
    await clearAllVouchers();
    set({ vouchers: [], selectedIds: new Set() });
  },

  toggleSelection: (id) => {
    set(state => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    });
  },

  selectAll: () => {
    const state = get();
    set({ selectedIds: new Set(state.vouchers.map(v => v.id)) });
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  getSelectedVouchers: () => {
    const state = get();
    return state.vouchers.filter(v => state.selectedIds.has(v.id));
  },

  calculateTotals: (): GrandTotal => {
    const selected = get().getSelectedVouchers();
    const validVouchers = selected.filter(v => v.amount !== null && v.amount > 0);

    if (validVouchers.length === 0) {
      return {
        totalByCurrency: [],
        overallTotal: null,
        singleCurrency: true,
      };
    }

    // Group by currency
    const byCurrency = validVouchers.reduce((acc, voucher) => {
      const curr = voucher.currency;
      if (!acc[curr]) {
        acc[curr] = { currency: curr, total: 0, count: 0 };
      }
      acc[curr].total += voucher.amount!;
      acc[curr].count += 1;
      return acc;
    }, {} as Record<string, CurrencyTotal>);

    const totalByCurrency = Object.values(byCurrency);
    const singleCurrency = totalByCurrency.length === 1;
    const overallTotal = singleCurrency ? totalByCurrency[0].total : null;

    return {
      totalByCurrency,
      overallTotal,
      singleCurrency,
    };
  },
}));
