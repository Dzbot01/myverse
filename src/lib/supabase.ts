import { createClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

export const SUPABASE_URL = "https://zcxtbtleeeaeqeryiwea.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_5rQxfGd82O_EooSxxBkcRw_S5ATDox0";
export const FALLBACK_VIDEO_URL =
  "https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/snapgram.io_n0zef2jmjd8k.mp4";

/* ---------- Simple request/error tracker ---------- */
type Stats = { requests: number; errors: number };
let stats: Stats = { requests: 0, errors: 0 };
const listeners = new Set<() => void>();

function bump(key: keyof Stats) {
  stats = { ...stats, [key]: stats[key] + 1 };
  listeners.forEach((l) => l());
}

export function trackRequest() {
  bump("requests");
}
export function trackError() {
  bump("errors");
}

export function useStats(): Stats {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => stats
  );
}

/* Every call that goes through supabase-js is counted here */
const trackedFetch: typeof fetch = async (input, init) => {
  trackRequest();
  try {
    const res = await fetch(input, init);
    if (!res.ok) trackError();
    return res;
  } catch (e) {
    trackError();
    throw e;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: trackedFetch },
});

export type VideoRow = {
  id?: number | string;
  title?: string | null;
  created_at?: string | null;
  video_url: string;
  [key: string]: unknown;
};

export async function fetchVideos(): Promise<VideoRow[]> {
  // Coba ambil kolom video_url dari tabel Video.
  // Jika tabel tidak ada / kolom berbeda / data kosong → throw supaya fallback aktif.
  const { data, error } = await supabase
    .from("Video")
    .select("*")
    .limit(50);

  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) throw new Error("empty");

  // Terima kolom apa pun yang mengandung URL video (video_url, url, src, link)
  const urlKeys = ["video_url", "url", "src", "link"];
  const mapped: VideoRow[] = [];
  for (const row of rows) {
    let url = "";
    for (const key of urlKeys) {
      const val = row[key];
      if (typeof val === "string" && val.trim()) {
        url = val.trim();
        break;
      }
    }
    if (url) {
      mapped.push({
        id: (row.id as number | string | undefined) ?? mapped.length,
        title: typeof row.title === "string" ? row.title : null,
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        video_url: url,
      });
    }
  }

  if (!mapped.length) throw new Error("no video_url found");
  return mapped;
}
