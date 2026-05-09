import { create } from "zustand";

interface WatchlistState {
  watchlist: any[];

  addToWatchlist: (
    movie: any
  ) => void;

  removeFromWatchlist: (
    id: number
  ) => void;

  isInWatchlist: (
    id: number
  ) => boolean;
}

export const useWatchlistStore =
  create<WatchlistState>(
    (set, get) => ({
      watchlist: [],

      addToWatchlist: (
        movie
      ) =>
        set((state) => ({
          watchlist: [
            ...state.watchlist,
            movie,
          ],
        })),

      removeFromWatchlist: (
        id
      ) =>
        set((state) => ({
          watchlist:
            state.watchlist.filter(
              (movie) =>
                movie.id !== id
            ),
        })),

      isInWatchlist: (
        id
      ) =>
        get().watchlist.some(
          (movie) =>
            movie.id === id
        ),
    })
  );
