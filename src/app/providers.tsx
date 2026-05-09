"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  ReactNode,
  useState,
} from "react";

interface Props {
  children: ReactNode;
}

export default function Providers({
  children,
}: Props) {
  /* PREVENT RECREATION */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,

            refetchOnWindowFocus: false,

            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

