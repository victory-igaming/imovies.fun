This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).


# FULL PROJECT STRUCTURE
imovies-fun/
│
├── app/
│   ├── (home)/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   │
│   ├── movie/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── loading.tsx
│   │       └── error.tsx
│   │
│   ├── watch/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── loading.tsx
│   │
│   ├── search/
│   │   └── page.tsx
│   │
│   ├── favorites/
│   │   └── page.tsx
│   │
│   ├── library/
│   │   └── page.tsx
│   │
│   ├── api/
│   │   ├── tmdb/
│   │   │   └── route.ts
│   │   │
│   │   ├── ads/
│   │   │   └── route.ts
│   │   │
│   │   └── playback/
│   │       └── route.ts
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── providers.tsx
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── MobileNav.tsx
│   │   └── AppShell.tsx
│   │
│   ├── movie/
│   │   ├── MovieCard.tsx
│   │   ├── MovieGrid.tsx
│   │   ├── HeroBanner.tsx
│   │   ├── GenreBadge.tsx
│   │   ├── RatingBadge.tsx
│   │   └── TrailerModal.tsx
│   │
│   ├── player/
│   │   ├── VideoPlayer.tsx
│   │   ├── PlayerControls.tsx
│   │   ├── TheaterMode.tsx
│   │   ├── SubtitleSelector.tsx
│   │   ├── ContinueWatching.tsx
│   │   └── AdOverlayPlayer.tsx
│   │
│   ├── ads/
│   │   ├── AdsenseBanner.tsx
│   │   ├── SidebarAds.tsx
│   │   ├── MobileAds.tsx
│   │   └── SponsoredCard.tsx
│   │
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── GlassCard.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Modal.tsx
│   │   ├── Input.tsx
│   │   └── Loader.tsx
│   │
│   └── common/
│       ├── Logo.tsx
│       ├── ThemeToggle.tsx
│       └── InfiniteScroll.tsx
│
├── features/
│   ├── tmdb/
│   │   ├── hooks.ts
│   │   ├── queries.ts
│   │   └── tmdb.types.ts
│   │
│   ├── ads/
│   │   ├── ad-manager.ts
│   │   ├── ad-selector.ts
│   │   └── useAdInjection.ts
│   │
│   ├── player/
│   │   ├── playback-manager.ts
│   │   ├── continue-watch.ts
│   │   └── subtitle-manager.ts
│   │
│   └── search/
│       ├── useSearch.ts
│       ├── search-store.ts
│       └── filters.ts
│
├── hooks/
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useInfiniteMovies.ts
│   ├── useKeyboardShortcut.ts
│   └── useVisibilityPause.ts
│
├── services/
│   ├── tmdb.service.ts
│   ├── player.service.ts
│   ├── ads.service.ts
│   └── analytics.service.ts
│
├── store/
│   ├── player.store.ts
│   ├── favorites.store.ts
│   ├── watchlist.store.ts
│   ├── theme.store.ts
│   └── ui.store.ts
│
├── config/
│   ├── site.ts
│   ├── ads-config.json
│   ├── navigation.ts
│   └── theme.ts
│
├── lib/
│   ├── prisma.ts
│   ├── react-query.ts
│   ├── tmdb.ts
│   ├── validators.ts
│   └── rate-limit.ts
│
├── types/
│   ├── movie.ts
│   ├── player.ts
│   ├── ads.ts
│   └── api.ts
│
├── utils/
│   ├── format.ts
│   ├── cn.ts
│   ├── image.ts
│   ├── storage.ts
│   └── time.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│   ├── logo/
│   ├── ads/
│   │   ├── ad1.mp4
│   │   ├── ad2.mp4
│   │   └── ad3.mp4
│   │
│   ├── placeholders/
│   └── icons/
│
├── styles/
│   ├── animations.css
│   ├── player.css
│   └── scrollbar.css
│
├── middleware.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── package.json
├── .env.local
└── README.md




First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
