import { create } from "zustand";

interface FavoritesState {
  favorites: any[];

  addFavorite: (
    movie: any
  ) => void;

  removeFavorite: (
    id: number
  ) => void;

  isFavorite: (
    id: number
  ) => boolean;
}

export const useFavoritesStore =
  create<FavoritesState>(
    (set, get) => ({
      favorites: [],

      addFavorite: (
        movie
      ) =>
        set((state) => ({
          favorites: [
            ...state.favorites,
            movie,
          ],
        })),

      removeFavorite: (
        id
      ) =>
        set((state) => ({
          favorites:
            state.favorites.filter(
              (movie) =>
                movie.id !== id
            ),
        })),

      isFavorite: (id) =>
        get().favorites.some(
          (movie) =>
            movie.id === id
        ),
    })
  );

