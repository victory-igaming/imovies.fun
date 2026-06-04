import {
  getSponsoredAdvertisements,
  type SponsoredAdvertisement,
} from "@/services/cmsdb";

function SponsorCard({ sponsor }: { sponsor: SponsoredAdvertisement }) {
  const from = sponsor.gradient_from || "#06b6d4";
  const to = sponsor.gradient_to || "#2563eb";

  const cardContent = (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/10 p-4 transition duration-300 hover:-translate-y-1 hover:border-white/20"
      style={{
        background: `linear-gradient(135deg, ${from}33, ${to}33)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 blur-2xl transition duration-300 group-hover:opacity-40"
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      />

      {sponsor.image_url && (
        <img
          src={sponsor.image_url}
          alt={sponsor.title}
          className="absolute right-0 top-0 h-full w-28 object-cover opacity-20 transition duration-300 group-hover:opacity-30"
        />
      )}

      <div className="relative z-10">
        {sponsor.badge_text && (
          <span className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80">
            {sponsor.badge_text}
          </span>
        )}

        <p className="font-black text-white">
          {sponsor.title}
        </p>

        {sponsor.subtitle && (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-300">
            {sponsor.subtitle}
          </p>
        )}

        {sponsor.cta_text && (
          <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-white/20">
            {sponsor.cta_text}
          </div>
        )}
      </div>
    </div>
  );

  if (sponsor.target_url) {
    return (
      <a
        href={sponsor.target_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block"
      >
        {cardContent}
      </a>
    );
  }

  return cardContent;
}

export default async function SidebarSponsorBox() {
  const sponsors = await getSponsoredAdvertisements();

  if (!sponsors.length) {
    return null;
  }

  return (
    <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-2xl font-black text-white">
          Sponsored
        </h3>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-gray-400">
          Ads
        </span>
      </div>

      <div className="space-y-4">
        {sponsors.map((sponsor) => (
          <SponsorCard key={sponsor.id} sponsor={sponsor} />
        ))}
      </div>
    </aside>
  );
}