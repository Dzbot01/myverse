/*
 * Email dikirim melalui Cloudflare Worker. Browser tidak menerima RESEND_KEY dan
 * tidak menyimpan RESEND_ENDPOINT_TOKEN; kedua secret harus dibaca Worker dari env.
 */
export const WORKER_SEND_ENDPOINT =
  "https://boosteryuk.boosteryukid.workers.dev/api/resend/send";
export const FROM_EMAIL = "MyVerse Developer <hr@cekidku.my.id>";
export const DEVELOPER_EMAIL = "dmsnugroho15@gmail.com";

export type RecruteData = {
  company: string;
  email: string;
  message: string;
  address: string;
  date: string;
};

type WorkerEmail = {
  to: string;
  subject: string;
  html: string;
  kind: "developer-notification" | "company-confirmation";
};

function formatTanggalId(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailShell(title: string, intro: string, content: string): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#0a0a0a;padding:24px;">
    <div style="max-width:540px;margin:0 auto;background:#131316;border:1px solid #26262b;border-radius:16px;padding:28px;color:#f4f4f5;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#34d399;">Recrute · My Verse</p>
      <h1 style="margin:0 0 12px;font-size:20px;">${title}</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;line-height:1.6;">${intro}</p>
      ${content}
    </div>
  </div>`;
}

function dataTable(d: RecruteData): string {
  const rows: [string, string][] = [
    ["Nama perusahaan", d.company],
    ["Email perusahaan", d.email],
    ["Alamat perusahaan", d.address],
    ["Jadwal interview", formatTanggalId(d.date)],
  ];
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows
        .map(
          ([key, value]) => `<tr>
        <td style="padding:8px 0;color:#71717a;white-space:nowrap;vertical-align:top;">${key}</td>
        <td style="padding:8px 0 8px 16px;color:#f4f4f5;">${escapeHtml(value)}</td>
      </tr>`
        )
        .join("")}
    </table>
    <div style="margin-top:20px;background:#0f0f12;border:1px solid #26262b;border-radius:12px;padding:16px;">
      <p style="margin:0 0 6px;font-size:12px;color:#71717a;">Pesan HRD</p>
      <p style="margin:0;font-size:14px;color:#d4d4d8;line-height:1.6;">${escapeHtml(d.message)}</p>
    </div>`;
}

function buildDeveloperHtml(d: RecruteData): string {
  return emailShell(
    "Undangan Interview Baru",
    `<strong style="color:#f4f4f5;">${escapeHtml(d.company)}</strong> ingin merekrut Anda dan telah mengajukan jadwal sesi interview.`,
    `${dataTable(d)}
    <p style="margin:20px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
      Hubungi perusahaan melalui <span style="color:#f4f4f5;">${escapeHtml(d.email)}</span> untuk mengonfirmasi jadwal.
    </p>`
  );
}

function buildCompanyHtml(d: RecruteData): string {
  return emailShell(
    "Undangan Interview Berhasil Dikirim",
    `Berhasil! Anda telah mengundang Developer untuk sesi interview pada <strong style="color:#f4f4f5;">${escapeHtml(formatTanggalId(d.date))}</strong>.`,
    `${dataTable(d)}
    <p style="margin:20px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
      Developer menerima salinan undangan ini di email pribadinya. Simpan email ini sebagai bukti pengajuan jadwal interview.
    </p>`
  );
}

function parseWorkerError(rawText: string): string {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const detail = obj.error ?? obj.message;
      if (typeof detail === "string") return detail;
    }
  } catch {
    /* Respons bukan JSON. */
  }
  return rawText;
}

async function sendOneEmail(email: WorkerEmail, data: RecruteData): Promise<string | undefined> {
  let response: Response;
  try {
    response = await fetch(WORKER_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email.to,
        subject: email.subject,
        html: email.html,
        kind: email.kind,
        data: {
          company: data.company.trim(),
          companyEmail: data.email.trim(),
          message: data.message,
          address: data.address.trim(),
          date: data.date,
          dateLabel: formatTanggalId(data.date),
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Tidak dapat menghubungi Worker untuk ${email.to}: ${message}`);
  }

  const rawText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(
      `Worker gagal mengirim email ke ${email.to} (HTTP ${response.status}): ${parseWorkerError(rawText)}`
    );
  }

  let result: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (parsed && typeof parsed === "object") result = parsed as Record<string, unknown>;
  } catch {
    /* Respons bukan JSON. */
  }

  const message = typeof result.message === "string" ? result.message : "";
  if (/worker active/i.test(message) && !result.id && result.sent !== true) {
    throw new Error(
      "Worker masih membalas ack generik (\"Worker Active\") dan belum mengirim email. " +
        "Handler POST /api/resend/send harus memanggil Resend memakai secret server-side."
    );
  }
  if (result.ok === false) {
    throw new Error(parseWorkerError(rawText) || `Worker gagal mengirim email ke ${email.to}.`);
  }

  return typeof result.id === "string" ? result.id : undefined;
}

/** Mengirim notifikasi ke developer dan konfirmasi terpisah ke perusahaan. */
export async function sendRecruteEmail(
  data: RecruteData
): Promise<{ ok: true; developerId?: string; companyId?: string }> {
  const company = data.company.trim();
  const [developerId, companyId] = await Promise.all([
    sendOneEmail(
      {
        to: DEVELOPER_EMAIL,
        subject: `Undangan Interview dari ${company}`,
        html: buildDeveloperHtml(data),
        kind: "developer-notification",
      },
      data
    ),
    sendOneEmail(
      {
        to: data.email.trim(),
        subject: `Konfirmasi Undangan Interview · ${company}`,
        html: buildCompanyHtml(data),
        kind: "company-confirmation",
      },
      data
    ),
  ]);

  return { ok: true, developerId, companyId };
}