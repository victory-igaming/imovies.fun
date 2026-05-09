import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;

  searchOpen: boolean;

  trailerModalOpen: boolean;

  toggleSidebar: () => void;

  toggleSearch: () => void;

  setTrailerModal: (
    value: boolean
  ) => void;
}

export const useUIStore =
  create<UIState>((set) => ({
    sidebarOpen: true,

    searchOpen: false,

    trailerModalOpen: false,

    toggleSidebar: () =>
      set((state) => ({
        sidebarOpen:
          !state.sidebarOpen,
      })),

    toggleSearch: () =>
      set((state) => ({
        searchOpen:
          !state.searchOpen,
      })),

    setTrailerModal: (
      value
    ) =>
      set({
        trailerModalOpen:
          value,
      }),
  }));