import { create } from "zustand";

interface ContinueWatchingItem {
  movieId: number;

  title: string;

  poster: string;

  progress: number;

  duration: number;

  updatedAt: number;
}

interface PlayerStore {
  /* PLAYER */
  isPlaying: boolean;

  isMuted: boolean;

  volume: number;

  theaterMode: boolean;

  currentMovieId: number | null;

  currentTime: number;

  duration: number;

  /* FAVORITES */
  favorites: number[];

  /* RECENTLY VIEWED */
  recentlyViewed: number[];

  /* CONTINUE WATCHING */
  continueWatching: ContinueWatchingItem[];

  /* PLAYER ACTIONS */
  setPlaying: (playing: boolean) => void;

  setMuted: (muted: boolean) => void;

  setVolume: (volume: number) => void;

  toggleTheaterMode: () => void;

  setCurrentMovie: (id: number) => void;

  setCurrentTime: (time: number) => void;

  setDuration: (duration: number) => void;

  /* FAVORITES */
  toggleFavorite: (id: number) => void;

  isFavorite: (id: number) => boolean;

  /* RECENTLY VIEWED */
  addRecentlyViewed: (id: number) => void;

  /* CONTINUE WATCHING */
  updateContinueWatching: (
    item: ContinueWatchingItem
  ) => void;

  removeContinueWatching: (
    movieId: number
  ) => void;
}

export const usePlayerStore =
  create<PlayerStore>((set, get) => ({
    /* INITIAL STATE */
    isPlaying: false,

    isMuted: false,

    volume: 1,

    theaterMode: false,

    currentMovieId: null,

    currentTime: 0,

    duration: 0,

    favorites: [],

    recentlyViewed: [],

    continueWatching: [],

    /* PLAYER */
    setPlaying: (playing) =>
      set({
        isPlaying: playing,
      }),

    setMuted: (muted) =>
      set({
        isMuted: muted,
      }),

    setVolume: (volume) =>
      set({
        volume,
      }),

    toggleTheaterMode: () =>
      set((state) => ({
        theaterMode:
          !state.theaterMode,
      })),

    setCurrentMovie: (id) =>
      set({
        currentMovieId: id,
      }),

    setCurrentTime: (time) =>
      set({
        currentTime: time,
      }),

    setDuration: (duration) =>
      set({
        duration,
      }),

    /* FAVORITES */
    toggleFavorite: (id) => {
      const favorites =
        get().favorites;

      const exists =
        favorites.includes(id);

      if (exists) {
        set({
          favorites: favorites.filter(
            (fav) => fav !== id
          ),
        });
      } else {
        set({
          favorites: [...favorites, id],
        });
      }
    },

    isFavorite: (id) => {
      return get().favorites.includes(id);
    },

    /* RECENTLY VIEWED */
    addRecentlyViewed: (id) => {
      const existing =
        get().recentlyViewed.filter(
          (movieId) => movieId !== id
        );

      set({
        recentlyViewed: [
          id,
          ...existing,
        ].slice(0, 20),
      });
    },

    /* CONTINUE WATCHING */
    updateContinueWatching: (
      item
    ) => {
      const existing =
        get().continueWatching.filter(
          (movie) =>
            movie.movieId !== item.movieId
        );

      set({
        continueWatching: [
          item,
          ...existing,
        ].slice(0, 20),
      });
    },

    removeContinueWatching: (
      movieId
    ) => {
      set({
        continueWatching:
          get().continueWatching.filter(
            (movie) =>
              movie.movieId !==
              movieId
          ),
      });
    },
  }));