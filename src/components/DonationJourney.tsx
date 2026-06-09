import { useCallback, useEffect, useRef, useState } from "react";
import { donationJourneyStages, type DonationJourneyStage } from "@/lib/donate-photos";

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-clay sm:text-[11px]">
      {children}
    </p>
  );
}

function resolveActiveSlideIndex(container: HTMLDivElement): number {
  const containerMid = container.getBoundingClientRect().left + container.clientWidth / 2;
  const slides = Array.from(container.children) as HTMLElement[];
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  slides.forEach((slide, i) => {
    const rect = slide.getBoundingClientRect();
    const slideMid = rect.left + rect.width / 2;
    const dist = Math.abs(slideMid - containerMid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  });

  return bestIdx;
}

function StageCarousel({ stage }: { stage: DonationJourneyStage }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const syncActiveIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIdx(resolveActiveSlideIndex(el));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    syncActiveIndex();

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncActiveIndex);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", syncActiveIndex);
    window.addEventListener("resize", syncActiveIndex);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", syncActiveIndex);
      window.removeEventListener("resize", syncActiveIndex);
    };
  }, [syncActiveIndex, stage.photos.length]);

  const goToSlide = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const slide = el.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIdx(index);
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stage.photos.map((photo, i) => (
          <div
            key={photo.src}
            className="w-full shrink-0 snap-center snap-always px-1 sm:px-0"
            aria-hidden={i !== activeIdx}
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink/40 sm:rounded-3xl">
              <div className="relative aspect-[4/5] sm:aspect-[5/4]">
                <img
                  src={photo.src}
                  alt={photo.caption}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <p className="text-[13px] leading-relaxed text-white/90 sm:text-sm">{photo.caption}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stage.photos.length > 1 && (
        <div
          className="mt-4 flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label={`صور المرحلة — ${activeIdx + 1} من ${stage.photos.length}`}
        >
          {stage.photos.map((photo, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={photo.src}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`صورة ${i + 1} من ${stage.photos.length}`}
                onClick={() => goToSlide(i)}
                className="touch-target grid place-items-center px-1.5 py-2"
              >
                <span
                  className={[
                    "block rounded-full transition-all duration-300 ease-out",
                    isActive
                      ? "h-2.5 w-8 bg-clay shadow-[0_0_14px_rgba(131,235,145,0.65)]"
                      : "h-2 w-2 bg-white/35 hover:bg-white/55",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, isActive }: { stage: DonationJourneyStage; isActive: boolean }) {
  return (
    <article
      id={`journey-${stage.id}`}
      className={[
        "scroll-mt-24 rounded-3xl border transition-all duration-500",
        isActive
          ? "border-clay/40 bg-white/[0.07] shadow-[0_0_40px_-12px_rgba(196,120,90,0.35)]"
          : "border-white/8 bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className={[
              "grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-colors",
              isActive ? "bg-clay text-white" : "bg-white/10 text-white/70",
            ].join(" ")}
          >
            {stage.step}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl leading-tight text-white sm:text-2xl">{stage.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/65 sm:text-sm">{stage.description}</p>
          </div>
        </div>

        <div className="mt-5 lg:hidden">
          <StageCarousel stage={stage} />
        </div>
      </div>

      {/* Desktop: compact photo strip */}
      <div className="hidden border-t border-white/8 lg:block">
        <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 sm:p-6">
          {stage.photos.map((photo) => (
            <div key={photo.src} className="group overflow-hidden rounded-xl border border-white/10">
              <div className="relative aspect-square">
                <img
                  src={photo.src}
                  alt={photo.caption}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                <p className="absolute inset-x-0 bottom-0 translate-y-full p-2 text-[11px] text-white/90 transition group-hover:translate-y-0">
                  {photo.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function DonationJourney() {
  const [activeStage, setActiveStage] = useState(0);
  const stageRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const nodes = stageRefs.current.filter(Boolean) as HTMLElement[];
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target) {
          const idx = nodes.indexOf(visible[0].target as HTMLElement);
          if (idx >= 0) setActiveStage(idx);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const totalPhotos = donationJourneyStages.reduce((n, s) => n + s.photos.length, 0);

  return (
    <section id="journey" className="relative isolate overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-clay/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute inset-0 grain opacity-40" />

      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
        <div className="max-w-2xl">
          <Kicker>مسار تبرّعك</Kicker>
          <h2 className="mt-3 font-display text-3xl leading-[1.12] sm:text-4xl md:text-5xl">
            من حسابك <span className="text-clay">إلى يد العائلة.</span>
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/70 sm:text-base">
            {totalPhotos} صورة حقيقية من عمليات الشراء والتوزيع — لترى أين تذهب كل ليرة تتبرّع بها.
          </p>
        </div>

        {/* Mobile: sticky step pills */}
        <div className="sticky top-[max(4rem,calc(env(safe-area-inset-top)+3.5rem))] z-20 -mx-4 mt-8 border-b border-white/10 bg-ink/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {donationJourneyStages.map((stage, i) => (
              <a
                key={stage.id}
                href={`#journey-${stage.id}`}
                className={[
                  "shrink-0 rounded-full border px-3.5 py-2 text-[11px] transition",
                  i === activeStage
                    ? "border-clay bg-clay text-white"
                    : "border-white/15 text-white/70 hover:border-white/30",
                ].join(" ")}
              >
                {stage.step} {stage.title}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 lg:mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10 xl:gap-14">
          {/* Desktop sticky narrative */}
          <div className="hidden lg:block">
            <div className="sticky top-28 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="font-mono text-[11px] text-clay">
                  المرحلة {donationJourneyStages[activeStage]?.step}
                </div>
                <h3 className="mt-2 font-display text-3xl leading-tight">
                  {donationJourneyStages[activeStage]?.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  {donationJourneyStages[activeStage]?.description}
                </p>
              </div>

              <div className="space-y-2">
                {donationJourneyStages.map((stage, i) => (
                  <a
                    key={stage.id}
                    href={`#journey-${stage.id}`}
                    className={[
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition",
                      i === activeStage
                        ? "border-clay/50 bg-clay/10 text-white"
                        : "border-white/8 text-white/60 hover:border-white/20 hover:text-white/90",
                    ].join(" ")}
                  >
                    <span className="font-mono text-[10px] text-clay">{stage.step}</span>
                    <span className="flex-1">{stage.title}</span>
                    <span className="font-mono text-[10px] text-white/40">{stage.photos.length}</span>
                  </a>
                ))}
              </div>

              <p className="text-[12px] leading-relaxed text-white/45">
                اسحب الصور على الهاتف، أو مرّر بين المراحل لترى التفاصيل الكاملة.
              </p>
            </div>
          </div>

          {/* Stage stack */}
          <div className="space-y-5 sm:space-y-6">
            {donationJourneyStages.map((stage, i) => (
              <div
                key={stage.id}
                ref={(el) => {
                  stageRefs.current[i] = el;
                }}
              >
                <StageCard stage={stage} isActive={i === activeStage} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center sm:mt-14">
          <p className="max-w-md text-[13px] leading-relaxed text-white/55 sm:text-sm">
            كل صورة موثّقة من عملياتنا الفعلية في الجنوب اللبناني. شفافية ليست شعاراً — إنها التزام.
          </p>
          <a
            href="#methods"
            className="inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-[13px] font-medium text-white transition hover:bg-clay/90 sm:text-sm"
          >
            اختر طريقة التبرّع وابدأ ↓
          </a>
        </div>
      </div>
    </section>
  );
}
