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
    addItem: (item: Omit<CartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    clearCart: () => void;
    getTotal: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
    items: [],

    addItem: (newItem) => {
        set((state) => {
            // If it's not a package, and the exact same item was added, we can bump quantity.
            // But if it's a package with sub-selections, it's safer to just push a new unique item.
            if (!newItem.is_package) {
                const existingItem = state.items.find(i => i.menu_item_id === newItem.menu_item_id && !i.is_package);
                if (existingItem) {
                    return {
                        items: state.items.map(i =>
                            i.id === existingItem.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
                        )
                    };
                }
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

    clearCart: () => set({ items: [] }),

    getTotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
}));
