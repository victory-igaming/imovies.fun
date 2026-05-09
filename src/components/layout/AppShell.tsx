 
import Sidebar from "./Sidebar";

import MobileNav from "./MobileNav";

import Header from "./Header";

interface Props {  children: React.ReactNode;
}

export default function AppShell({
  children,
}: Props) {
  return (
    <main className="flex min-h-screen bg-[#050816] text-white">
      {/* SIDEBAR */}
      <Sidebar />

      {/* CONTENT */}
      <section className="flex-1 md:ml-64 pb-24">
        {/* TOP HEADER */}
        <Header />

        {/* PAGE CONTENT */}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </section>

      {/* MOBILE NAV */}
      <MobileNav />
    </main>
  );
}

