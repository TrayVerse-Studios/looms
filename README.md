# Looms

Website for my novel

I would like to disclose that this website was coded using AI alongside Jekyll. While tools like Grammarly were used while writing, this story was entirely written by a human.
## Chapter release dates

Chapter files (`docs/_chapters/*.md`) support optional frontmatter fields:

```yaml
release_date: "2026-11-17"   # YYYY-MM-DD (optional)
release_time: "14:30"        # HH:MM 24-hour (optional, defaults to 00:00)
timezone_offset: 0           # hours from UTC, e.g. -5, +1, 0 (default 0)
```

- If `release_date` is omitted, the sync script sets it to the UTC date the chapter was processed.
- Chapters whose release datetime is in the future are automatically treated as drafts: non-admin users cannot see or access them.
- On chapter pages the release time is shown adjusted to the visitor’s local timezone.

### Sync to Supabase

1. Run the SQL in `docs/sql/chapters.sql` in the Supabase SQL editor (creates the `chapters` table).
2. From the repo root:

```bash
npm install @supabase/supabase-js
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/sync-chapters.js
```

The script fills any missing `release_date` / `release_time` / `timezone_offset` in the Markdown files and upserts the computed UTC `release_at` into the `chapters` table.
