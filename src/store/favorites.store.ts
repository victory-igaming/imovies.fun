import { create } from "zustand";

interface FavoritesState {
  favorites: any[];

  toggleFavorite: (
    movie: any
  ) => void;

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

      toggleFavorite: (movie: any) => {
        const { favorites } = get();
        const isFav = favorites.some((fav) => fav.id === movie.id);

        if (isFav) {
          set({
            favorites: favorites.filter((fav) => fav.id !== movie.id),
          });
        } else {
          set({
            favorites: [...favorites, movie],
          });
        }
      },

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

