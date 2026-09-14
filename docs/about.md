---
layout: page
title: About
permalink: /about/
---

*Looms* is an original superhero novel by TrayVerse. It follows Richard Cox — later the Weaver — after a failed multiverse experiment strands him between worlds and ties his life to Helix City.

Guest appearances from other stories (including Danville and Central City) are used as part of Richard's origin. Those characters belong to their original owners.

## This website

The site is a **Jekyll** project published with **GitHub Pages** from the `docs/` folder of [TrayVerse-Studios/looms](https://github.com/TrayVerse-Studios/looms).

- Home, chapter list, character guide, and about page
- One Markdown file per chapter in `_chapters/`
- Custom layout with previous / next links
- `baseurl: /looms` so project Pages URLs resolve correctly

## Local preview

```bash
cd docs
bundle install
bundle exec jekyll serve
```

Then open `http://127.0.0.1:4000/looms/`.

## Add a chapter

Create `docs/_chapters/11-your-slug.md`:

```yaml
---
layout: chapter
title: "Chapter 11 — Your Title"
number: 11
permalink: /chapters/11-your-slug/
font: narrator
---
```

Write the chapter under that block, commit, and push to `main`.

`font` is optional. It changes only the chapter body text. Leave it off to use the site default in `_config.yml` (`chapter_font`).

Allowed values: `source-serif`, `narrator`, `remnant`, `cunarrator`, `comicnarrator`, `timelanguage`.
