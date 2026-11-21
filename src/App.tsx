import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import TechText from "./components/TechText";
import DriftWall, { type DriftWallItem } from "./components/DriftWall";
import {
  FALLBACK_VIDEO_URL,
  fetchVideos,
  trackError,
  useStats,
  type VideoRow,
} from "./lib/supabase";
import { sendRecruteEmail, type RecruteData } from "./lib/resend";
import { cn } from "./utils/cn";

/* ---------------- Types & constants ---------------- */
type Tab = "ringkasan" | "library" | "portofolio" | "experience" | "project" | "recrute";
type Filter = "semua" | "terbaru" | "favorit";

const ICONS = {
  home: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10",
  list: "M4 6h16M4 12h16M4 18h10",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  heart:
    "M12 20.5l-1.4-1.3C5.6 14.7 2.5 11.9 2.5 8.4 2.5 5.6 4.7 3.5 7.5 3.5c1.6 0 3.1.8 4.1 2 1-1.2 2.5-2 4.1-2 2.8 0 5 2.1 5 4.9 0 3.5-3.1 6.3-8.1 10.8L12 20.5z",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  download: "M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  check: "M4 12.5l5 5L20 6.5",
  briefcase: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm0 5h16M10 12v1h4v-1",
  folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z",
  handshake: "M7 12l3 3 7-7M2.5 10.5l4-4 3 2 3-2 4 4M5 13.5l2 2M8 16l2 2M13 15l-2 2",
  pin: "M12 21s7-5.1 7-12A7 7 0 1 0 5 9c0 6.9 7 12 7 12zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  cap: "M12 4 2 9l10 5 10-5-10-5zM6 11.2V16c0 1.9 2.7 3.5 6 3.5s6-1.6 6-3.5v-4.8M22 9v5",
};

const MENUS: { id: Tab; label: string; icon: string }[] = [
  { id: "ringkasan", label: "Ringkasan", icon: ICONS.home },
  { id: "library", label: "Library", icon: ICONS.list },
  { id: "portofolio", label: "Portofolio", icon: ICONS.user },
  { id: "experience", label: "Experience", icon: ICONS.briefcase },
  { id: "project", label: "Project", icon: ICONS.folder },
  { id: "recrute", label: "Recrute", icon: ICONS.handshake },
];

/* Drawer khusus Library hanya menampilkan navigasi utama, bukan semua halaman. */
const LIBRARY_DRAWER_NAV = MENUS.filter((m) => m.id === "ringkasan" || m.id === "library");

const LIBRARY_FILTERS: { id: Filter; label: string; desc: string; icon: string }[] = [
  { id: "semua", label: "Semua Video", desc: "Seluruh koleksi video", icon: ICONS.grid },
  { id: "terbaru", label: "Terbaru", desc: "Urutkan dari yang paling baru", icon: ICONS.clock },
  { id: "favorit", label: "Favorit", desc: "Video yang kamu tandai", icon: ICONS.heart },
];

const DRAWER_ACTIONS = [
  { id: "reload", label: "Muat Ulang Data", desc: "Ambil ulang dari Supabase", icon: ICONS.refresh },
];

const TOTAL_MENU = MENUS.length + LIBRARY_FILTERS.length + DRAWER_ACTIONS.length;

/* Gambar untuk dinding animasi di hero */
const WALL_IDS = [
  1015, 1025, 1039, 1043, 1044, 1050, 1062, 1069, 1074, 1080, 1084, 106, 110, 133, 164, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25,
];
const WALL_ITEMS: DriftWallItem[] = WALL_IDS.map((id, i) => ({
  image: `https://picsum.photos/id/${id}/600/400`,
  title: `Tile ${i + 1}`,
}));

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/* ---------------- Favorites (localStorage) ---------------- */
const FAV_KEY = "myverse:favorites";

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const toggleFavorite = useCallback((url: string) => {
    setFavorites((prev) => {
      const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* storage penuh / diblokir – abaikan */
      }
      return next;
    });
  }, []);
  return { favorites, toggleFavorite };
}

/* Nilai untuk mengurutkan "Terbaru": created_at jika ada, kalau tidak pakai id */
function stamp(v: VideoRow): number {
  if (typeof v.created_at === "string") {
    const t = Date.parse(v.created_at);
    if (!Number.isNaN(t)) return t;
  }
  const n = typeof v.id === "number" ? v.id : Number(v.id);
  return Number.isNaN(n) ? 0 : n;
}

/* ---------------- Animated wall background (dipakai hero & portofolio) ---------------- */
function AnimatedWall() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <DriftWall
        items={WALL_ITEMS}
        columns={10}
        tileWidth={180}
        tileHeight={124}
        gap={14}
        tilt={14}
        turn={-12}
        perspective={1200}
        depth={90}
        speed={32}
        direction="up"
        variance={0.45}
        parallax={0}
        lift={0}
        fade={0.15}
        dim={0.92}
        overlayColor="rgba(0,0,0,0.25)"
        radius={12}
        roll={0}
        pauseOnHover={false}
        grayscale={false}
      />
    </div>
  );
}

/* ---------------- Hero Section ---------------- */
function HeroSection() {
  return (
    <header className="relative h-[380px] w-full overflow-hidden bg-black sm:h-[460px]">
      {/* Background animasi – hanya memenuhi area hero ini */}
      <AnimatedWall />

      {/* Bayangan lembut hanya di belakang teks (bukan overlay hitam penuh) */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[62%] w-full max-w-3xl bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.4)_45%,transparent_78%)]"
        aria-hidden="true"
      />

      {/* Teks hero – rata dengan sisi kiri layar */}
      <div className="relative z-[1] flex h-full flex-col justify-end px-4 pb-7 sm:px-6 sm:pb-9">
        <h1 className="sr-only">My Verse</h1>
        <div
          className="-ml-2 h-[72px] w-full max-w-3xl [filter:drop-shadow(0_2px_14px_rgba(0,0,0,0.85))] sm:h-[100px]"
          aria-hidden="true"
        >
          <TechText
            text="My Verse"
            fontWeight={600}
            fontSize={88}
            reveal="letter"
            dashLength={4}
            dashGap={2}
            specks={15}
            intro="none"
            introDuration={2}
            clickKick
            guides={false}
            fontFamily=""
            letterSpacing={-0.05}
            accentColor="#0cb1ef"
            reach={200}
            softness={0.7}
            lineStyle="dashed"
            strokeWidth={1.5}
            speed={1}
            bounce={0.4}
            selection
            labels
            color="#ffffff"
            align="left"
            edgeMargin={8}
            draggable
            sweep
          />
        </div>
        <p className="mt-3 max-w-xl text-left text-sm leading-relaxed text-zinc-200 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)] sm:text-base">
          Selamat datang di My Verse — ruang untuk menikmati dan mengelola koleksi video favoritmu
          dalam satu tempat.
        </p>
      </div>
    </header>
  );
}

/* ---------------- Header (transparan di atas, jadi card saat scroll) ---------------- */
function SiteHeader({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  /* Pantau posisi scroll untuk mengubah header menjadi card */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Tutup menu saat klik di luar atau tekan Esc */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (id: Tab) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <header
      ref={rootRef}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "bg-transparent" : "bg-gradient-to-b from-black/70 via-black/25 to-transparent"
      )}
    >
      <div className={cn("transition-all duration-300 ease-out", scrolled ? "px-3 pt-3 sm:px-6" : "px-0 pt-0")}>
        <div
          className={cn(
            "relative mx-auto flex items-center justify-between gap-3 transition-all duration-300 ease-out",
            scrolled
              ? "max-w-5xl rounded-2xl border border-white/10 bg-zinc-950/90 px-4 py-2.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl"
              : "max-w-none border border-transparent bg-transparent px-4 py-4 sm:px-6"
          )}
        >
          {/* Judul */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
              My Verse
            </span>
            {scrolled && tab !== "ringkasan" && (
              <span className="ml-1 hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400 sm:inline">
                {MENUS.find((m) => m.id === tab)?.label}
              </span>
            )}
          </div>

          {/* Tombol menu */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="header-nav"
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition sm:px-4",
              open
                ? "border-white/25 bg-white text-black"
                : "border-white/15 bg-black/30 text-white backdrop-blur hover:border-white/30 hover:bg-white/10"
            )}
          >
            <Icon d={open ? ICONS.close : ICONS.menu} className="h-4 w-4" />
            <span className="hidden sm:inline">{open ? "Tutup" : "Menu"}</span>
          </button>

        </div>
      </div>

      {/* Menu navbar vertikal dari sisi kiri – tanpa animasi */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id="header-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,268px)] flex-col border-r border-white/10 bg-zinc-950"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-base font-semibold tracking-tight">
                  Apa yang sedang kamu cari?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <Icon d={ICONS.close} className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Navigasi
              </p>
              <ul className="flex flex-col gap-1">
                {MENUS.map((m) => {
                  const active = tab === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => select(m.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium",
                          active ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-lg",
                            active ? "bg-black/10" : "bg-white/5 text-zinc-300"
                          )}
                        >
                          <Icon d={m.icon} className="h-4 w-4" />
                        </span>
                        <span className="flex-1">{m.label}</span>
                        {active && <Icon d={ICONS.check} className="h-4 w-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-white/10 px-4 py-3 text-xs text-zinc-500">
              Tekan <kbd className="rounded border border-white/15 px-1">Esc</kbd> untuk menutup
            </div>
          </div>
        </>
      )}
    </header>
  );
}

/* ---------------- Video Player ---------------- */
function VideoPlayer({
  src,
  loading,
  audioUnlocked,
  videoRef,
}: {
  src: string;
  loading: boolean;
  audioUnlocked: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const unlockedRef = useRef(audioUnlocked);

  /* Terapkan status audio tanpa memuat ulang video dari awal. */
  useEffect(() => {
    unlockedRef.current = audioUnlocked;
    const video = videoRef.current;
    if (!video) return;

    video.muted = !audioUnlocked;
    if (audioUnlocked) {
      video.volume = 1;
      video.play().catch(() => {
        /* Browser may still require another direct interaction. */
      });
    }
  }, [audioUnlocked, videoRef]);

  /* Video selalu mulai otomatis dalam keadaan muted sampai klik pertama membuka audio. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    video.muted = !unlockedRef.current;
    video.loop = true;
    video.load();
    video.play().catch(() => {
      /* Autoplay with sound is blocked until the first user interaction. */
    });
  }, [src, videoRef]);

  return (
    <section aria-label="Video player" className="w-full">
      {src && !loading ? (
        <video
          ref={videoRef}
          key={src}
          src={src}
          className="block aspect-video w-full bg-black object-contain"
          autoPlay
          loop
          muted={!audioUnlocked}
          playsInline
          preload="auto"
          onError={() => trackError()}
        />
      ) : (
        <div className="aspect-video w-full bg-black" aria-hidden="true" />
      )}
    </section>
  );
}

/* ---------------- Stats Grid ---------------- */
function StatsGrid() {
  const { requests, errors } = useStats();
  const items = [
    { label: "Total Menu", value: TOTAL_MENU, color: "from-violet-500/20", dot: "bg-violet-400" },
    { label: "Total Request", value: requests, color: "from-sky-500/20", dot: "bg-sky-400" },
    { label: "Total Error", value: errors, color: "from-rose-500/20", dot: "bg-rose-400" },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((s) => (
        <div
          key={s.label}
          className={cn(
            "rounded-3xl border border-white/10 bg-gradient-to-br to-zinc-950 p-6",
            s.color
          )}
        >
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className={cn("h-2 w-2 rounded-full", s.dot)} />
            {s.label}
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums">{s.value}</p>
        </div>
      ))}
    </section>
  );
}

/* ---------------- Library ---------------- */
function Library({
  videos,
  usingFallback,
  current,
  filter,
  favorites,
  onToggleFavorite,
  onSelect,
  onOpenMenu,
}: {
  videos: VideoRow[];
  usingFallback: boolean;
  current: string;
  filter: Filter;
  favorites: string[];
  onToggleFavorite: (url: string) => void;
  onSelect: (v: VideoRow) => void;
  onOpenMenu: () => void;
}) {
  const list = useMemo(() => {
    let arr = [...videos];
    if (filter === "favorit") arr = arr.filter((v) => favorites.includes(v.video_url));
    if (filter === "terbaru") arr.sort((a, b) => stamp(b) - stamp(a));
    return arr;
  }, [videos, filter, favorites]);

  const active = LIBRARY_FILTERS.find((f) => f.id === filter) ?? LIBRARY_FILTERS[0];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Library</h2>
          <p className="text-sm text-zinc-500">
            {active.label} · {list.length} video
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-controls="library-drawer"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          <Icon d={ICONS.grid} className="h-4 w-4" />
          Filter &amp; Aksi
        </button>
      </div>

      {usingFallback && (
        <p className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200/80">
          Tabel “Video” belum berisi data — menampilkan video default dari storage.
        </p>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">
          {filter === "favorit"
            ? "Belum ada video favorit. Tekan ikon hati pada video untuk menandainya."
            : "Belum ada video."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v, i) => {
            const isCurrent = v.video_url === current;
            const isFav = favorites.includes(v.video_url);
            return (
              <div
                key={String(v.id ?? i)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-zinc-950 transition hover:-translate-y-0.5",
                  isCurrent ? "border-violet-400/60" : "border-white/10 hover:border-white/30"
                )}
              >
                <button type="button" onClick={() => onSelect(v)} className="block w-full text-left">
                  <div className="relative aspect-video bg-black">
                    <video
                      src={v.video_url + "#t=0.5"}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                    />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-black">
                        ▶
                      </span>
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="truncate font-medium">{v.title || `Video ${i + 1}`}</p>
                    <p className="text-xs text-zinc-500">
                      {isCurrent ? "Sedang diputar" : "Klik untuk memutar"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(v.video_url)}
                  aria-pressed={isFav}
                  aria-label={isFav ? "Hapus dari favorit" : "Tambah ke favorit"}
                  className={cn(
                    "absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition",
                    isFav
                      ? "border-rose-400/40 bg-rose-500/20 text-rose-300"
                      : "border-white/15 bg-black/50 text-white/80 hover:bg-black/70"
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill={isFav ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={ICONS.heart} />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------- Portofolio ---------------- */
const HASHTAGS = [
  "#FrontendDeveloper",
  "#ReactJS",
  "#TypeScript",
  "#TailwindCSS",
  "#Supabase",
  "#UIDesign",
  "#WebGL",
  "#CreativeCoding",
  "#OpenToWork",
];

/* Membuat file CV sederhana di sisi browser agar tombol unduh benar-benar berfungsi */
function buildCvBlob(): Blob {
  const lines = [
    "CURRICULUM VITAE",
    "========================================",
    "",
    "Nama    : Dimas Nugroho",
    "Peran   : Frontend Developer",
    "Email   : dimas@myverse.dev",
    "Lokasi  : Jakarta, Indonesia",
    "",
    "RINGKASAN",
    "----------------------------------------",
    "Frontend developer yang berfokus pada antarmuka interaktif,",
    "animasi web, dan integrasi data realtime.",
    "",
    "KEAHLIAN",
    "----------------------------------------",
    "React, TypeScript, Tailwind CSS, Supabase, WebGL, Vite",
    "",
    "TAGAR",
    "----------------------------------------",
    HASHTAGS.join(" "),
    "",
    `Dibuat dari halaman MyVerse pada ${new Date().toLocaleString("id-ID")}`,
    "",
  ];
  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
}

function DownloadCvCard() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const ids = timers.current;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  const handleDownload = () => {
    if (state === "loading") return;
    setState("loading");

    /* Spinner tampil sebentar, lalu file benar-benar diunduh */
    const id = window.setTimeout(() => {
      try {
        const url = URL.createObjectURL(buildCvBlob());
        const a = document.createElement("a");
        a.href = url;
        a.download = "CV-Dimas-Nugroho.txt";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch {
        /* unduhan diblokir – tetap lanjut ke state selesai */
      }
      setState("done");
      const reset = window.setTimeout(() => setState("idle"), 2600);
      timers.current.push(reset);
    }, 1400);
    timers.current.push(id);
  };

  const loading = state === "loading";
  const done = state === "done";

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        aria-busy={loading}
        className={cn(
          "group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition",
          done
            ? "border-emerald-400/40 bg-emerald-500/10"
            : "border-white/10 bg-zinc-950 hover:border-white/25 hover:bg-zinc-900/80",
          loading && "cursor-wait"
        )}
      >
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-xl border transition",
            done
              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
              : "border-white/10 bg-white/5 text-white"
          )}
        >
          {loading ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                opacity="0.25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <Icon d={done ? ICONS.check : ICONS.download} className="h-5 w-5" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Unduh CV</span>
          <span className="mt-0.5 block text-sm text-zinc-400">
            {loading
              ? "Menyiapkan berkas…"
              : done
                ? "Berhasil diunduh — cek folder unduhan kamu"
                : "Berkas CV lengkap dalam format teks"}
          </span>
        </span>

        <span
          className={cn(
            "hidden shrink-0 rounded-full border px-3 py-1 text-xs transition sm:block",
            done
              ? "border-emerald-400/40 text-emerald-300"
              : "border-white/15 text-zinc-400 group-hover:text-white"
          )}
        >
          {loading ? "Memproses" : done ? "Selesai" : "Unduh"}
        </span>
      </button>
    </section>
  );
}

function PortfolioPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Background animasi – sama seperti pada halaman Ringkasan */}
      <section className="relative -mx-4 h-[220px] overflow-hidden bg-black sm:-mx-6 sm:h-[260px]">
        <AnimatedWall />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]"
          aria-hidden="true"
        />
        <div className="relative z-[1] flex h-full flex-col justify-end px-4 pb-6 sm:px-6">
          <h2 className="text-2xl font-semibold [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] sm:text-3xl">
            Portofolio
          </h2>
          <p className="mt-1 max-w-lg text-sm text-zinc-300 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
            Sedikit tentang saya, keahlian, dan cara menghubungi.
          </p>
        </div>
      </section>

      {/* Hashtag perkenalan diri */}
      <section>
        <h3 className="mb-3 text-sm uppercase tracking-widest text-zinc-500">Tentang Saya</h3>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
          Halo! Saya Dimas, seorang frontend developer yang senang membangun antarmuka interaktif —
          dari animasi WebGL sampai integrasi data realtime. MyVerse ini salah satu ruang eksperimen
          saya.
        </p>
        <ul className="flex flex-wrap gap-2">
          {HASHTAGS.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
            >
              {tag}
            </li>
          ))}
        </ul>
      </section>

      {/* Kartu unduh CV */}
      <DownloadCvCard />
    </div>
  );
}

/* ---------------- Experience ---------------- */
/** Satu node pada diagram bercabang: tempat kerja beserta perannya. */
type ExperienceNode = {
  /** Nama tempat kerja. */
  workplace: string;
  /** Nama unit atau cabang (bila ada). */
  unit?: string;
  /** Peran yang dijalankan. */
  role: string;
  /** Nama merek untuk teks alternatif logo. */
  brand: string;
  /** Logo (gambar kartu) dari folder assets/experience. */
  logo: string;
};

/**
 * Jalur karier, diurutkan dari yang paling dekat dengan wisuda.
 * Diagram digambar dari bawah ke atas, jadi node pertama tampil paling bawah.
 */
const EXPERIENCE_PATH: ExperienceNode[] = [
  {
    workplace: "Toko Frozen Food",
    unit: "Lakuki Store 2",
    role: "Tim Gudang",
    brand: "Lakuki Frozen",
    logo: "assets/experience/01-lakuki-frozen.png",
  },
  {
    workplace: "Gudang JNT",
    role: "DW",
    brand: "J&T Express",
    logo: "assets/experience/02-jnt-express.png",
  },
  {
    workplace: "PT AKHASA WIRA INTERNATIONAL",
    role: "Loader (muat barang)",
    brand: "Akasha International",
    logo: "assets/experience/03-akasha-wira.png",
  },
  {
    workplace: "Jajo Steak",
    role: "Crew Store",
    brand: "Jajo Steak",
    logo: "assets/experience/04-jajo-steak.png",
  },
  {
    workplace: "PT ABRA BIONERGI NUSANTARA",
    role: "Operator Produksi Briket",
    brand: "ABRA BRIK",
    logo: "assets/experience/05-abra-brik.png",
  },
];

/** Kartu satu tempat kerja: logo sebagai gambar utama + nama + peran. */
function ExperienceCard({ node }: { node: ExperienceNode }) {
  return (
    <article className="group relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-4 transition duration-300 hover:-translate-y-1 hover:border-white/25">
      <div className="flex items-center gap-4">
        <span className="relative block h-16 w-32 shrink-0 overflow-hidden rounded-xl bg-white">
          <img
            src={node.logo}
            alt={`Logo ${node.brand}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-2 h-[calc(100%_-_1rem)] w-[calc(100%_-_1rem)] object-contain"
          />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-zinc-50">{node.workplace}</h3>
          {node.unit ? <p className="mt-0.5 text-xs text-zinc-400">{node.unit}</p> : null}
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300">
            <Icon d={ICONS.briefcase} className="h-3.5 w-3.5" />
            {node.role}
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * Satu level diagram: kartu di kiri atau kanan batang vertikal,
 * dihubungkan oleh ranting horizontal dan titik pertemuan.
 */
function ExperienceLevel({
  node,
  side,
}: {
  node: ExperienceNode;
  side: "left" | "right";
}) {
  const isLeft = side === "left";
  return (
    <div className="grid grid-cols-1 items-center md:grid-cols-[1fr_4rem_1fr]">
      {/* Slot kiri */}
      <div
        className={`relative flex ${
          isLeft ? "justify-center md:justify-end" : "hidden md:flex md:justify-start"
        }`}
      >
        {isLeft ? (
          <>
            <span className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-white/15 md:hidden" />
            <ExperienceCard node={node} />
          </>
        ) : null}
      </div>

      {/* Batang vertikal + ranting */}
      <div className="relative hidden self-stretch md:flex md:justify-center">
        <span
          className={`absolute top-1/2 h-px -translate-y-1/2 bg-white/25 ${
            isLeft ? "left-0 right-1/2" : "left-1/2 right-0"
          }`}
          aria-hidden="true"
        />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/70 bg-zinc-950"
          aria-hidden="true"
        />
      </div>

      {/* Slot kanan */}
      <div
        className={`relative flex ${
          isLeft ? "hidden md:flex md:justify-end" : "justify-center md:justify-start"
        }`}
      >
        {isLeft ? null : (
          <>
            <ExperienceCard node={node} />
            <span className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-white/15 md:hidden" />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Halaman Experience: diagram bercabang yang tumbuh dari bawah ke atas.
 * Akar diagram (wisuda) berada di paling bawah, lalu:ranting naik ke atas.
 */
function ExperiencePage() {
  return (
    <section className="py-2">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Experience</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Perjalanan karier dari titik awal.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Diagram ini tumbuh dari bawah ke atas. Wisuda pada 25 Mei 2026 menjadi titik awal, lalu
          setiap pengalaman kerja membuka ranting baru menuju karier saat ini.
        </p>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col-reverse gap-8">
          {/* Akar diagram: wisuda, berada di paling bawah */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Penghubung dari kartu akar ke batang utama */}
            <span
              className="h-8 w-px bg-gradient-to-b from-white/10 to-cyan-400/60"
              aria-hidden="true"
            />
            <div className="w-full max-w-sm rounded-2xl border border-cyan-400/25 bg-zinc-950 p-5 text-center shadow-[0_0_60px_-20px_rgba(34,211,238,0.55)]">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-cyan-300/40 bg-cyan-400/10 text-cyan-300">
                <Icon d={ICONS.cap} className="h-6 w-6" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-zinc-50">Lulus</h3>
              <p className="mt-1 text-sm font-medium text-cyan-300">25 Mei 2026</p>
              <p className="mt-1 text-xs text-zinc-500">Lulusan baru, titik awal perjalanan</p>
            </div>
            <span className="mt-3 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
              Titik awal
            </span>
          </div>

          {/* Batang utama + ranting, membentang ke atas */}
          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-t from-cyan-400/60 via-white/10 to-violet-400/40 md:block"
              aria-hidden="true"
            />
            <div className="flex flex-col-reverse gap-8">
              {EXPERIENCE_PATH.map((node, index) => (
                <ExperienceLevel
                  key={node.workplace}
                  node={node}
                  side={index % 2 === 0 ? "left" : "right"}
                />
              ))}
            </div>
          </div>

          {/* Puncak diagram */}
          <p className="text-center text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            Awal perjalanan
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Project ---------------- */
type Project = {
  domain: string;
  url: string;
  description: string;
  accent: string;
  /** Tangkapan layar asli dari website project (lihat folder assets/projects). */
  screenshot: string;
};

/**
 * Tangkapan layar asli tiap website project.
 * Gambar disimpan di folder assets/projects dan ditampilkan lewat <img> nyata.
 */
const PROJECTS: Project[] = [
  {
    domain: "boosteryuk.com",
    url: "https://boosteryuk.com",
    description: "Panel layanan SMM untuk pemesanan dan pemantauan order media sosial.",
    accent: "#38bdf8",
    screenshot: "assets/projects/01-boosteryuk.jpg",
  },
  {
    domain: "job-gmail.vercel.app",
    url: "https://job-gmail.vercel.app",
    description: "Aplikasi web pendukung pengelolaan lamaran kerja berbasis email.",
    accent: "#a78bfa",
    screenshot: "assets/projects/02-job-gmail.jpg",
  },
  {
    domain: "bdpsukses.my.id",
    url: "https://bdpsukses.my.id",
    description: "Situs profil layanan bisnis lengkap dengan ketentuan penggunaan.",
    accent: "#34d399",
    screenshot: "assets/projects/03-bdps.jpg",
  },
  {
    domain: "jajosteak.vercel.app",
    url: "https://jajosteak.vercel.app",
    description: "Situs kuliner untuk menampilkan menu steak dan informasi pemesanan.",
    accent: "#fb7185",
    screenshot: "assets/projects/04-jajosteak.jpg",
  },
  {
    domain: "cekidku.my.id",
    url: "https://cekidku.my.id",
    description: "Layanan web untuk pengecekan dan penelusuran data secara cepat.",
    accent: "#22d3ee",
    screenshot: "assets/projects/05-cekidku.jpg",
  },
  {
    domain: "gemasstudio.vercel.app",
    url: "https://gemasstudio.vercel.app",
    description: "Situs studio kreatif yang menampilkan layanan dan karya visual.",
    accent: "#f472b6",
    screenshot: "assets/projects/06-gemasstudio.jpg",
  },
  {
    domain: "mr-toolbox.vercel.app",
    url: "https://mr-toolbox.vercel.app",
    description: "Kumpulan peralatan web praktis dalam satu antarmuka sederhana.",
    accent: "#fbbf24",
    screenshot: "assets/projects/07-mr-toolbox.jpg",
  },
];

/**
 * Pratinjau project memakai tangkapan layar asli website.
 * Gambar dimuat dari folder assets/projects lewat <img> sehingga browser
 * menampilkan bitmap sungguhan, bukan placeholder CSS.
 */
function ProjectPreview({
  domain,
  url,
  accent,
  screenshot,
}: {
  domain: string;
  url: string;
  accent: string;
  screenshot: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="group relative block aspect-[8/5] w-full overflow-hidden border-b border-white/5"
    >
      <img
        src={screenshot}
        alt={`Tangkapan layar website ${domain}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]"
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent opacity-0 transition group-hover:opacity-100"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-0 transition group-hover:opacity-100"
        style={{ background: `${accent}26`, color: accent, boxShadow: `0 0 0 1px ${accent}55` }}
        aria-hidden="true"
      >
        Buka situs
      </span>
    </a>
  );
}

function ProjectsPage() {
  return (
    <section className="py-2">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Project</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Pilihan proyek.</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Kumpulan eksperimen dan produk digital yang menggabungkan fungsi, kejelasan, dan karakter
          visual.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {PROJECTS.map((project) => (
          <article
            key={project.domain}
            className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 transition hover:-translate-y-1 hover:border-white/25"
          >
            <ProjectPreview
              domain={project.domain}
              url={project.url}
              accent={project.accent}
              screenshot={project.screenshot}
            />
            <div className="p-5">
              <h3 className="break-all text-base font-semibold">{project.domain}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{project.description}</p>
            </div>
          </article>
        ))}

        {/* Penanda proyek berikutnya */}
        <article className="grid place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <div>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-white/15 text-zinc-400">
              <Icon d={ICONS.folder} className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-200">Project baru akan segera hadir</p>
            <p className="mt-1 text-xs text-zinc-500">Pantau terus pembaruan berikutnya.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ---------------- Recrute ---------------- */
function RecrutePage() {
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState<RecruteData>({
    company: "",
    email: "",
    message: "",
    address: "",
    date: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyText, setVerifyText] = useState("");
  const verifyOk = verifyText.trim() === "Verifikasi";

  const update = (key: keyof RecruteData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const formValid =
    form.company.trim().length > 0 &&
    emailValid &&
    form.message.trim().length > 0 &&
    form.address.trim().length > 0 &&
    form.date.length > 0;

  const today = new Date().toISOString().slice(0, 10);

  const openVerify = () => {
    if (!accepted || !formValid || sending || sent) return;
    setError(null);
    setVerifyText("");
    setVerifyOpen(true);
  };

  const submit = async () => {
    if (!accepted || !formValid || sending || !verifyOk) return;
    setSending(true);
    setError(null);
    try {
      await sendRecruteEmail(form);
      setVerifyOpen(false);
      setVerifyText("");
      setSent(true);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Gagal mengirim. Silakan coba lagi.";
      setError(errMsg);
      setVerifyOpen(false);
      trackError();
      window.alert(`[Error Pengiriman Resend]:\n\n${errMsg}`);
    } finally {
      setSending(false);
    }
  };

  const interviewLabel = form.date
    ? new Date(`${form.date}T00:00:00`).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  useEffect(() => {
    if (!verifyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) {
        setVerifyOpen(false);
        setVerifyText("");
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [verifyOpen, sending]);

  return (
    <section className="py-2">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Recrute</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Rekrut Developer untuk perusahaan Anda.</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Developer terbuka untuk peluang kerja dan kolaborasi bersama perusahaan. Isi data
          perusahaan, tulis pesan HRD, lalu ajukan jadwal interview yang sesuai.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className="rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <Icon d={ICONS.handshake} className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-xl font-semibold">Terbuka untuk kerja sama perusahaan</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Halaman ini ditujukan bagi perusahaan yang ingin mengundang developer ke proses
            rekrutmen. Sampaikan profil perusahaan, kebutuhan posisi, dan jadwal interview agar
            pembicaraan dapat dimulai secara jelas dan profesional.
          </p>
          <dl className="mt-7 space-y-4 border-t border-white/10 pt-5 text-sm">
            <div className="flex items-start gap-3">
              <Icon d={ICONS.pin} className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div><dt className="text-zinc-500">Model kerja</dt><dd className="mt-0.5 text-zinc-200">Hybrid atau remote sesuai posisi</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <Icon d={ICONS.calendar} className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div><dt className="text-zinc-500">Tahapan</dt><dd className="mt-0.5 text-zinc-200">Seleksi portofolio, diskusi, dan penawaran</dd></div>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Perjanjian Rekrutmen</p>
          <h3 className="mt-2 text-xl font-semibold">Kesepakatan awal perusahaan</h3>
          <ol className="mt-5 space-y-4 text-sm leading-relaxed text-zinc-400">
            <li><span className="mr-2 text-zinc-200">01.</span>Data dan identitas perusahaan yang diberikan adalah benar serta dapat dipertanggungjawabkan.</li>
            <li><span className="mr-2 text-zinc-200">02.</span>Informasi proses seleksi, materi uji, dan pembahasan internal dijaga kerahasiaannya oleh kedua pihak.</li>
            <li><span className="mr-2 text-zinc-200">03.</span>Detail kompensasi, masa percobaan, jam kerja, dan hak karyawan disepakati secara tertulis sebelum tanggal mulai kerja.</li>
            <li><span className="mr-2 text-zinc-200">04.</span>Pengajuan ini adalah undangan perusahaan untuk melanjutkan diskusi dan bukan kontrak kerja final.</li>
          </ol>

          <label className="mt-7 flex cursor-pointer items-start gap-3 border-t border-white/10 pt-5 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-400"
            />
            <span>Saya mewakili perusahaan dan menyetujui ketentuan awal rekrutmen.</span>
          </label>

          {/* Form perusahaan – muncul setelah ceklis disetujui */}
          {accepted && !sent && (
              <form
              className="mt-6 space-y-4 border-t border-white/10 pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                openVerify();
              }}
            >
              <p className="text-sm font-semibold text-white">Isi Data Perusahaan</p>

              <label className="block text-sm">
                <span className="mb-1.5 block text-zinc-400">Nama perusahaan</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="PT Contoh Kreatif"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-zinc-400">Email perusahaan</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="hrd@perusahaan.com"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 flex items-center justify-between text-zinc-400">
                  <span>Pesan HRD</span>
                  <span className={cn("text-xs", form.message.length >= 200 ? "text-rose-300" : "text-zinc-600")}>
                    {form.message.length}/200
                  </span>
                </span>
                <textarea
                  rows={5}
                  maxLength={200}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Tuliskan pesan untuk tim HRD (maksimal 200 karakter)…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-zinc-400">Alamat perusahaan</span>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Jl. Sudirman No. 1, Jakarta"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-zinc-400">Jadwal interview</span>
                <input
                  type="date"
                  value={form.date}
                  min={today}
                  onChange={(e) => update("date", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] focus:border-emerald-400/60"
                />
              </label>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-sm text-rose-200">
                  <span className="mt-0.5 text-rose-400">⚠️</span>
                  <div className="flex-1 leading-relaxed">
                    <p className="font-semibold text-rose-100">Gagal Mengirim Email</p>
                    <p className="mt-0.5 text-xs text-rose-200/90">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-xs text-rose-400 hover:text-rose-200"
                    aria-label="Tutup error"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={!formValid || sending}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                  formValid && !sending
                    ? "bg-white text-black hover:bg-zinc-200"
                    : "cursor-not-allowed bg-white/10 text-zinc-600"
                )}
              >
                Konfirmasi Data Perusahaan
              </button>
            </form>
          )}

          {/* Hasil pengiriman */}
          {/* Modal verifikasi manusia */}
          {verifyOpen && (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="verify-title">
              <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:p-7">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Langkah verifikasi</p>
                    <h4 id="verify-title" className="mt-1 text-lg font-semibold">
                      Ketik &ldquo;Verifikasi&rdquo;
                    </h4>
                    <p className="mt-1 text-sm text-zinc-400">
                      Untuk menyelesaikan tahap ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (sending) return;
                      setVerifyOpen(false);
                      setVerifyText("");
                    }}
                    aria-label="Tutup verifikasi"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <Icon d={ICONS.close} className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={verifyText}
                    onChange={(e) => setVerifyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (verifyOk && !sending) void submit();
                      }
                    }}
                    placeholder='Ketik Verifikasi'
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/60"
                  />
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!verifyOk || sending}
                    aria-label="Kirim data perusahaan"
                    className={cn(
                      "grid h-12 w-12 shrink-0 place-items-center rounded-xl transition",
                      verifyOk && !sending
                        ? "bg-white text-black hover:bg-zinc-200"
                        : "cursor-not-allowed bg-white/10 text-zinc-600"
                    )}
                  >
                    {sending ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <Icon d={ICONS.arrow} className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Huruf besar/kecil harus sama persis: <span className="text-zinc-300">Verifikasi</span>
                </p>
              </div>
            </div>
          )}

          {sent && (
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Icon d={ICONS.check} className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-emerald-200">Berhasil!</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                    Anda telah mengundang Developer untuk sesi Interview pada tanggal{" "}
                    <span className="text-emerald-200">{interviewLabel}</span>. Anda akan menerima
                    Email notifikasi — cek folder spam jika tidak muncul.
                  </p>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

/* ---------------- Drawer item (muncul satu per satu dari kanan) ---------------- */
function DrawerItem({
  open,
  index,
  icon,
  label,
  desc,
  active,
  badge,
  busy,
  onClick,
}: {
  open: boolean;
  index: number;
  icon: string;
  label: string;
  desc?: string;
  active?: boolean;
  badge?: number;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{ transitionDelay: open ? `${90 + index * 45}ms` : "0ms" }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-300 ease-out disabled:opacity-60",
        open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0",
        active ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10 hover:text-white"
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          active ? "bg-black/10" : "bg-white/5"
        )}
      >
        <Icon d={icon} className={cn("h-4 w-4", busy && "animate-spin")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {desc && (
          <span className={cn("block truncate text-xs", active ? "text-black/60" : "text-zinc-500")}>
            {desc}
          </span>
        )}
      </span>
      {badge !== undefined && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs tabular-nums",
            active ? "bg-black/10" : "bg-white/10 text-zinc-300"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ---------------- Side Drawer (meluncur dari sisi kanan) ---------------- */
function SideDrawer({
  open,
  onClose,
  tab,
  filter,
  counts,
  reloading,
  onNavigate,
  onFilter,
  onReload,
}: {
  open: boolean;
  onClose: () => void;
  tab: Tab;
  filter: Filter;
  counts: Record<Filter, number>;
  reloading: boolean;
  onNavigate: (t: Tab) => void;
  onFilter: (f: Filter) => void;
  onReload: () => void;
}) {
  /* Esc untuk menutup + kunci scroll halaman saat drawer terbuka */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  let index = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Panel */}
      <aside
        id="library-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu Library"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[320px] max-w-[88vw] flex-col border-l border-white/10 bg-zinc-950/95 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">MyVerse</p>
            <h2 className="text-lg font-semibold">Menu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <Icon d={ICONS.close} className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div>
            <p className="mb-2 px-3 text-xs uppercase tracking-widest text-zinc-500">Navigasi</p>
            <div className="space-y-1">
              {LIBRARY_DRAWER_NAV.map((m) => (
                <DrawerItem
                  key={m.id}
                  open={open}
                  index={index++}
                  icon={m.icon}
                  label={m.label}
                  active={tab === m.id}
                  onClick={() => onNavigate(m.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-xs uppercase tracking-widest text-zinc-500">Koleksi</p>
            <div className="space-y-1">
              {LIBRARY_FILTERS.map((f) => (
                <DrawerItem
                  key={f.id}
                  open={open}
                  index={index++}
                  icon={f.icon}
                  label={f.label}
                  desc={f.desc}
                  badge={counts[f.id]}
                  active={filter === f.id}
                  onClick={() => onFilter(f.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-xs uppercase tracking-widest text-zinc-500">Aksi</p>
            <div className="space-y-1">
              {DRAWER_ACTIONS.map((a) => (
                <DrawerItem
                  key={a.id}
                  open={open}
                  index={index++}
                  icon={a.icon}
                  label={a.label}
                  desc={reloading ? "Memuat ulang…" : a.desc}
                  busy={reloading}
                  onClick={onReload}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 px-5 py-3 text-xs text-zinc-500">
          Tekan <kbd className="rounded border border-white/15 px-1">Esc</kbd> atau klik di luar
          panel untuk menutup
        </div>
      </aside>
    </>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [filter, setFilter] = useState<Filter>("semua");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [current, setCurrent] = useState<VideoRow | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const requestRef = useRef(0);
  const { favorites, toggleFavorite } = useFavorites();

  /*
   * Browser hanya mengizinkan video bersuara setelah ada interaksi user.
   * Klik pertama di area mana pun pada halaman akan membuka blokir tersebut,
   * lalu video langsung di-unmute tanpa perlu tombol khusus.
   */
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;

      audioUnlockedRef.current = true;
      setAudioUnlocked(true);

      const video = videoRef.current;
      if (!video) return;

      video.muted = false;
      video.volume = 1;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          audioUnlockedRef.current = false;
          setAudioUnlocked(false);
        });
      }
    };

    window.addEventListener("pointerdown", unlockAudio);
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  /* Ambil data video dari Supabase (dipakai saat mount & "Muat Ulang Data") */
  const loadVideos = useCallback(async (manual = false) => {
    const id = ++requestRef.current;
    if (manual) setReloading(true);
    else setLoading(true);
    try {
      const rows = await fetchVideos();
      if (id !== requestRef.current) return;
      setVideos(rows);
      setUsingFallback(false);
      setCurrent((prev) => rows.find((r) => r.video_url === prev?.video_url) ?? rows[0]);
    } catch {
      if (id !== requestRef.current) return;
      const fb: VideoRow = { id: "default", title: "snapgram", video_url: FALLBACK_VIDEO_URL };
      setVideos([fb]);
      setCurrent(fb);
      setUsingFallback(true);
    } finally {
      if (id === requestRef.current) {
        setLoading(false);
        setReloading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleTab = (t: Tab) => {
    setTab(t);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [tab]);

  const handleSelect = (v: VideoRow) => {
    setCurrent(v);
    setTab("ringkasan");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const counts: Record<Filter, number> = {
    semua: videos.length,
    terbaru: videos.length,
    favorit: videos.filter((v) => favorites.includes(v.video_url)).length,
  };

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <SiteHeader tab={tab} onChange={handleTab} />

      {/* Hero hanya tampil di halaman utama */}
      {tab === "ringkasan" && <HeroSection />}

      <div
        className={cn(
          "mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8",
          /* Tanpa hero, konten perlu ruang agar tidak tertutup header tetap */
          tab !== "ringkasan" && "pt-24 sm:pt-28"
        )}
      >

        {tab === "ringkasan" && (
          <>
            <div className="h-px w-full bg-white/10" aria-hidden="true" />
            <VideoPlayer
              src={current?.video_url ?? ""}
              loading={loading || !current}
              audioUnlocked={audioUnlocked}
              videoRef={videoRef}
            />
            <div className="h-px w-full bg-white/10" aria-hidden="true" />
            <StatsGrid />
          </>
        )}

        {tab === "library" && (
          <Library
            videos={videos}
            usingFallback={usingFallback}
            current={current?.video_url ?? ""}
            filter={filter}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onSelect={handleSelect}
            onOpenMenu={() => setDrawerOpen(true)}
          />
        )}

        {tab === "portofolio" && (
          <PortfolioPage />
        )}

        {tab === "experience" && <ExperiencePage />}

        {tab === "project" && <ProjectsPage />}

        {tab === "recrute" && <RecrutePage />}

        <footer className="pt-4 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} MyVerse · Powered by Supabase
        </footer>
      </div>

      <SideDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        tab={tab}
        filter={filter}
        counts={counts}
        reloading={reloading}
        onNavigate={handleTab}
        onFilter={(f) => setFilter(f)}
        onReload={() => void loadVideos(true)}
      />
    </div>
  );
}
