"use client";

interface Props {
  error: Error & {
    digest?: string;
  };

  reset: () => void;
}

export default function ErrorPage({
  error,
  reset,
}: Props) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div
        className="
          rounded-3xl
          border
          border-red-500/20
          bg-red-500/10
          p-10
          text-center
          backdrop-blur-xl
        "
      >
        <h2 className="text-3xl font-black text-white">
          Something went wrong
        </h2>

        <p className="mt-4 text-gray-300">
          {error.message}
        </p>

        <button
          onClick={() => reset()}
          className="
            mt-6
            rounded-2xl
            bg-gradient-to-r
            from-cyan-400
            to-blue-500
            px-6
            py-3
            font-bold
            text-black
          "
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

