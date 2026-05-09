
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816]">
      <div className="flex flex-col items-center gap-6">
        {/* SPINNER */}
        <div
          className="
            h-16
            w-16
            rounded-full
            border-4
            border-cyan-400
            border-t-transparent
            animate-spin
          "
        />

        {/* TEXT */}
        <p className="text-lg text-gray-300">
          Loading movie...
        </p>
      </div>
    </div>
  );
}

