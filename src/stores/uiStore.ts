import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UiState {
  searchText: string;
  favoriteOnly: boolean;
  under30Only: boolean;
  selectedTag: string | null;
  toast: ToastMessage | null;
  setSearchText: (text: string) => void;
  toggleFavoriteOnly: () => void;
  toggleUnder30Only: () => void;
  setSelectedTag: (tag: string | null) => void;
  clearFilters: () => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  searchText: '',
  favoriteOnly: false,
  under30Only: false,
  selectedTag: null,
  toast: null,
  setSearchText: (searchText) => set({ searchText }),
  toggleFavoriteOnly: () => set((s) => ({ favoriteOnly: !s.favoriteOnly })),
  toggleUnder30Only: () => set((s) => ({ under30Only: !s.under30Only })),
  setSelectedTag: (selectedTag) =>
    set((s) => ({ selectedTag: s.selectedTag === tagOrNull(selectedTag) ? null : selectedTag })),
  clearFilters: () =>
    set({ searchText: '', favoriteOnly: false, under30Only: false, selectedTag: null }),
  showToast: (toast) => set({ toast: { ...toast, id: String(Date.now()) } }),
  dismissToast: () => set({ toast: null }),
}));

function tagOrNull(tag: string | null): string | null {
  return tag && tag.trim().length > 0 ? tag : null;
}
