'use client';

import { create } from 'zustand';

export type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: string | number;
  description?: string | null;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
};

export type PosItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

type PosState = {
  tableId?: string;
  tableName?: string;
  items: PosItem[];
  orderNote?: string;
  setTable: (tableId: string, tableName: string) => void;
  setOrderNote: (note: string) => void;
  addProduct: (product: Product) => void;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  updateItemNote: (productId: string, note: string) => void;
  clear: () => void;
};

export const usePosStore = create<PosState>((set) => ({
  tableId: undefined,
  tableName: undefined,
  items: [],
  orderNote: '',
  setTable: (tableId, tableName) => set({ tableId, tableName }),
  setOrderNote: (note) => set({ orderNote: note }),
  addProduct: (product) =>
    set((state) => {
      const price = Number(product.price);
      const existed = state.items.find((item) => item.productId === product.id);
      if (existed) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }
      return { items: [...state.items, { productId: product.id, name: product.name, price, quantity: 1, note: '' }] };
    }),
  increase: (productId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    })),
  decrease: (productId) =>
    set((state) => ({
      items: state.items
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    })),
  updateItemNote: (productId, note) =>
    set((state) => ({
      items: state.items.map((item) => (item.productId === productId ? { ...item, note } : item)),
    })),
  clear: () => set({ items: [], tableId: undefined, tableName: undefined, orderNote: '' }),
}));
