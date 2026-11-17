#!/usr/bin/env node
/**
 * Looms — sync chapter release dates from frontmatter into Supabase.
 *
 * Only processes chapters that are NOT marked draft: true or hidden: true.
 * For those chapters, if release_date / release_time / timezone_offset are missing,
 * they are filled with the local date, time, and timezone offset of the machine
 * running this script (not UTC midnight).
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/sync-chapters.js
 *
 * Requires: npm install @supabase/supabase-js
 * The service role key bypasses RLS. Never commit it.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const CHAPTERS_DIR = path.join(process.cwd(), 'docs/_chapters');

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  return { raw: match[1], rest: content.slice(match[0].length) };
}

function getScalar(raw, key) {
  const re = new RegExp("^" + key + ":\\s*(.+)$", "m");
  const m = raw.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function hasKey(raw, key) {
  return new RegExp("^" + key + ":", "m").test(raw);
}

function isTruthy(raw, key) {
  const v = getScalar(raw, key);
  return v === "true" || v === "True" || v === "yes";
}

function toUTC(dateStr, timeStr, offsetHours) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const offset = Number(offsetHours) || 0;
  const utcMs = Date.UTC(y, m - 1, d, hh || 0, mm || 0) - (offset * 3600 * 1000);
  return new Date(utcMs).toISOString();
}

function getNumber(raw) {
  const v = getScalar(raw, "number");
  return v ? parseInt(v, 10) : null;
}

function getTitle(raw) {
  return getScalar(raw, "title") || "";
}

/** Local date, time, and timezone offset (hours east of UTC) of the runner. */
function runnerNow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  // getTimezoneOffset() is minutes west of UTC; negate and convert to hours.
  const offsetHours = -now.getTimezoneOffset() / 60;
  return {
    date: `${y}-${m}-${d}`,
    time: `${hh}:${mm}`,
    offset: offsetHours
  };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const files = fs.readdirSync(CHAPTERS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("2026-"));

  const now = runnerNow();
  console.log(`Runner local time: ${now.date} ${now.time} (UTC${now.offset >= 0 ? "+" : ""}${now.offset})`);

  const upserts = [];

  for (const file of files) {
    const full = path.join(CHAPTERS_DIR, file);
    let content = fs.readFileSync(full, "utf8");
    const fm = extractFrontmatter(content);
    if (!fm) {
      console.warn("No frontmatter in", file);
      continue;
    }

    const rawOriginal = fm.raw;

    // Skip drafts and hidden chapters entirely
    if (isTruthy(rawOriginal, "draft") || isTruthy(rawOriginal, "hidden")) {
      console.log("Skipping draft/hidden:", file);
      continue;
    }

    let raw = rawOriginal;
    let changed = false;

    if (!hasKey(raw, "release_date")) {
      raw += `\nrelease_date: "${now.date}"`;
      changed = true;
    }
    if (!hasKey(raw, "release_time")) {
      raw += `\nrelease_time: "${now.time}"`;
      changed = true;
    }
    if (!hasKey(raw, "timezone_offset")) {
      // Preserve integer or simple decimal
      const off = Number.isInteger(now.offset) ? String(now.offset) : String(now.offset);
      raw += `\ntimezone_offset: ${off}`;
      changed = true;
    }

    if (changed) {
      const newContent = "---\n" + raw + "\n---\n" + fm.rest;
      fs.writeFileSync(full, newContent, "utf8");
      console.log("Filled missing release fields for", file);
    }

    const dateStr = getScalar(raw, "release_date") || now.date;
    const timeStr = getScalar(raw, "release_time") || now.time;
    const offset = Number(getScalar(raw, "timezone_offset") || now.offset);
    const release_at = toUTC(dateStr, timeStr, offset);

    upserts.push({
      slug: file.replace(/\.md$/, ""),
      number: getNumber(raw),
      title: getTitle(raw) || file,
      release_at,
      timezone_offset: offset,
      release_date: dateStr,
      release_time: timeStr
    });
  }

  if (!upserts.length) {
    console.log("No non-draft/non-hidden chapters to sync");
    return;
  }

  const { error } = await supabase.from("chapters").upsert(upserts, { onConflict: "slug" });
  if (error) {
    console.error("Upsert error:", error.message || error);
    process.exit(1);
  }
  console.log("Successfully synced", upserts.length, "chapters.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
