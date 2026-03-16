import { create } from 'zustand';

export type SelectedMeal = {
    category: string;
    item_id: string;
    item_name: string;
};

export type CartItem = {
    id: string; // unique string for the cart item
    menu_item_id: string;
    name: string;
    price: number;
    quantity: number;
    is_package: boolean;
    selections?: SelectedMeal[]; // if it's a package, these are the chosen meals
};

type CartState = {
    items: CartItem[];
    orderMode: 'eat_now' | 'pre_order' | null;
    setOrderMode: (mode: 'eat_now' | 'pre_order' | null) => void;
    addItem: (item: Omit<CartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    decrementItem: (menu_item_id: string) => void;
    clearCart: () => void;
    getTotal: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    orderMode: null,

    setOrderMode: (mode) => set({ orderMode: mode }),

    addItem: (newItem) => {
        set((state) => {
            // Since we are simplifying and removing sub-selections,
            // we can merge quantity for all identical menu items.
            const existingItem = state.items.find(i => i.menu_item_id === newItem.menu_item_id);
            if (existingItem) {
                return {
                    items: state.items.map(i =>
                        i.id === existingItem.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
                    )
                };
            }

            // Add as completely new line item
            return {
                items: [...state.items, { ...newItem, id: Math.random().toString(36).substring(7) }]
            };
        });
    },

    removeItem: (id) => {
        set((state) => ({ items: state.items.filter(i => i.id !== id) }));
    },

    decrementItem: (menu_item_id) => {
        set((state) => {
            const existingItem = state.items.find(i => i.menu_item_id === menu_item_id);
            if (!existingItem) return state;

            if (existingItem.quantity > 1) {
                return {
                    items: state.items.map(i =>
                        i.id === existingItem.id ? { ...i, quantity: i.quantity - 1 } : i
                    )
                };
            } else {
                return {
                    items: state.items.filter(i => i.id !== existingItem.id)
                };
            }
        });
    },

    getItemQuantity: (menuItemId: string) => {
        const item = get().items.find(i => i.menu_item_id === menuItemId);
        return item ? item.quantity : 0;
    },

    clearCart: () => set({ items: [] }),

    getTotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
}));
