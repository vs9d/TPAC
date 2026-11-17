"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Banknote, ChevronLeft, ChevronRight, Paintbrush, Star, Truck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image: string | null;
  video: string | null;
}

const INTERVAL = 7000;
const chipIcons = [Truck, Banknote, Paintbrush];

/** Slides whose image is one of our studio product renders use the side-by-side layout; real photos/videos go full-bleed. */
const isFullBleed = (s: HeroSlide) => !!s.video || (!!s.image && !s.image.startsWith("/products/"));

export function HeroSlider({ slides, rating }: { slides: HeroSlide[]; rating: { average: number; count: number } | null }) {
  const { locale, dict } = useI18n();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dir, setDir] = useState(1);
  const many = slides.length > 1;
  const rtl = locale === "ar";
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const slide = slides[index]!;

  const go = useCallback((to: number, d?: number) => {
    setDir(d ?? (to >= index ? 1 : -1));
    setIndex(((to % slides.length) + slides.length) % slides.length);
  }, [index, slides.length]);
  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const running = many && !paused && !hidden && !reduce;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(next, INTERVAL);
    return () => clearTimeout(t);
  }, [running, index, next]);

  const fullBleed = isFullBleed(slide);

  const compact = !isFullBleed(slide);
  const text = (
    <motion.div
      key={`t-${slide.id}`}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } }}
      className="relative z-10"
    >
      {[
        <p key="e" className="inline-flex items-center gap-2 rounded-full border border-snow/25 bg-snow/10 px-3.5 py-1.5 text-xs font-bold backdrop-blur">
          <span className="size-2 rounded-full bg-amber" /> {dict.home.heroEyebrow}
        </p>,
        <h1 key="h" className={cn("display mt-4 whitespace-pre-line md:mt-5", compact ? "text-[clamp(2.2rem,9vw,6rem)]" : "text-[clamp(2.7rem,10vw,7rem)]")}>{slide.title}</h1>,
        <p key="p" className={cn("mt-3 max-w-md text-[0.95rem] leading-relaxed text-snow/80 md:mt-4 md:text-lg", compact && "line-clamp-2 md:line-clamp-none")}>{slide.subtitle}</p>,
        <div key="c" className="mt-5 flex flex-wrap gap-3 md:mt-6">
          <Link href={slide.href} className={cn("btn btn-light group px-7 text-base", compact ? "h-12 md:h-14" : "h-14")}>
            {slide.cta} <Arrow className="size-4 transition-transform group-hover:-translate-x-1 ltr:group-hover:translate-x-1" />
          </Link>
          <Link href={`/${locale}/design`} className={cn("btn btn-glass h-14 px-6 text-base", compact && "hidden sm:inline-flex")}><Paintbrush className="size-4" /> {dict.home.heroCtaSecondary}</Link>
        </div>,
        <ul key="s" className={cn("mt-5 flex flex-wrap gap-2", compact && "hidden md:flex")}>
          {dict.home.heroChips.map((c, i) => {
            const Icon = chipIcons[i] ?? Truck;
            return (
              <li key={c} className="inline-flex items-center gap-2 rounded-full border border-snow/20 bg-night/30 px-3.5 py-2 text-xs font-semibold text-snow/90 backdrop-blur">
                <Icon className="size-3.5 text-amber" /> {c}
              </li>
            );
          })}
        </ul>,
      ].map((el, i) => (
        <motion.div key={i} variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}>
          {el}
        </motion.div>
      ))}
    </motion.div>
  );

  return (
    <section className="container-x pt-3 md:pt-5" aria-roledescription="carousel" aria-label={dict.home.heroEyebrow}>
      <div
        className="relative isolate h-[min(calc(100svh-8.5rem),820px)] min-h-[560px] overflow-hidden rounded-[2rem] bg-night text-snow ring-1 ring-black/5 dark:ring-snow/10 md:h-[640px] md:rounded-[2.75rem]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={slide.id}
            custom={dir}
            className="absolute inset-0"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 * (rtl ? -1 : 1) }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 * (rtl ? -1 : 1) }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            drag={many && !reduce ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              const forward = rtl ? info.offset.x > 70 : info.offset.x < -70;
              const back = rtl ? info.offset.x < -70 : info.offset.x > 70;
              if (forward) next();
              else if (back) prev();
            }}
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${slides.length}`}
          >
            {fullBleed ? (
              <>
                {slide.image && <Image src={slide.image} alt="" fill priority={index === 0} sizes="(min-width:1280px) 1300px, 100vw" className="object-cover" />}
                {slide.video && <SlideVideo src={slide.video} poster={slide.image} active={!hidden} />}
                <div className="absolute inset-0 bg-gradient-to-t from-night/95 via-night/45 to-night/20" />
                <div className="absolute inset-0 from-night/55 to-transparent rtl:bg-gradient-to-l ltr:bg-gradient-to-r md:from-night/70" />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-16 pt-24 md:px-14 md:pb-20">{text}</div>
              </>
            ) : (
              <>
                <div aria-hidden className="absolute -start-24 -top-24 size-[26rem] rounded-full bg-pine/50 blur-[90px]" />
                <div aria-hidden className="absolute -bottom-32 -end-16 size-[22rem] rounded-full bg-amber/25 blur-[100px]" />
                <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:22px_22px]" />
                <div className="relative grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 px-5 pb-16 pt-14 md:grid-cols-12 md:grid-rows-1 md:items-center md:gap-6 md:px-14 md:pb-14 md:pt-8">
                  <div className="md:col-span-7">{text}</div>
                  <div className="relative flex min-h-0 justify-center md:col-span-5 md:h-full md:items-center">
                    <div className="relative aspect-[4/5] h-full max-h-[480px] overflow-hidden rounded-[1.75rem] bg-[#ebe7de] shadow-[0_30px_60px_-30px_rgba(0,0,0,.8)] md:h-auto md:max-h-[520px] md:-rotate-2 md:rtl:rotate-2">
                      <Image src={slide.image || "/products/baghdad-nights-hoodie-black-back.webp"} alt="" fill priority={index === 0} sizes="(min-width:768px) 36vw, 70vw" className="object-cover" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {rating && rating.count > 0 && (
          <Link href={`/${locale}/reviews`} className="absolute end-4 top-4 z-20 flex items-center gap-2 rounded-full border border-snow/20 bg-night/55 px-3.5 py-2 text-sm font-bold backdrop-blur-md md:end-6 md:top-6">
            <Star className="size-4 fill-amber text-amber" />
            <span className="tabular-nums" dir="ltr">{rating.average.toFixed(1)}</span>
            <span className="hidden text-xs font-medium text-snow/70 sm:inline">{dict.reviews.navLabel}</span>
          </Link>
        )}

        {many && (
          <>
            <div className="absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-2 px-5 md:bottom-7 md:justify-start md:px-14" role="tablist" aria-label="slides">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${i + 1}`}
                  onClick={() => go(i)}
                  data-ripple
                  className="relative grid h-8 place-items-center"
                >
                  <span className={cn("relative block h-1.5 overflow-hidden rounded-full bg-snow/30 transition-all duration-300", i === index ? "w-12" : "w-6")}>
                    {i === index && (
                      <span
                        key={`${index}-${running}`}
                        className="absolute inset-y-0 start-0 block rounded-full bg-snow"
                        style={running ? { animation: `heroProgress ${INTERVAL}ms linear forwards` } : { width: reduce || !many ? "100%" : "0%" }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="absolute bottom-5 end-5 z-20 hidden gap-2 md:flex md:end-14">
              <button onClick={rtl ? next : prev} aria-label="previous" data-ripple className="grid size-12 place-items-center rounded-full border border-snow/25 bg-night/40 backdrop-blur transition-colors hover:bg-snow hover:text-night"><ChevronLeft className="size-5" /></button>
              <button onClick={rtl ? prev : next} aria-label="next" data-ripple className="grid size-12 place-items-center rounded-full border border-snow/25 bg-night/40 backdrop-blur transition-colors hover:bg-snow hover:text-night"><ChevronRight className="size-5" /></button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Looping muted video (the only kind browsers autoplay). The poster image shows until the first frame is ready. */
function SlideVideo({ src, poster, active }: { src: string; poster: string | null; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) void v.play().catch(() => undefined);
    else v.pause();
  }, [active]);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      disablePictureInPicture
      onCanPlay={() => setReady(true)}
      className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
    />
  );
}
