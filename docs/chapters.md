---
layout: page
title: Chapters
permalink: /chapters/
---

Read the novel in order. New chapters go in `_chapters/` and show up here automatically.

<ol class="chapter-list">
{% assign sorted = site.chapters | sort: "number" %}
{% for chapter in sorted %}
  <li>
    <a href="{{ chapter.url | relative_url }}">
      <span class="num">{% if chapter.number < 10 %}0{% endif %}{{ chapter.number }}</span>
      {{ chapter.title }}
    </a>
  </li>
{% endfor %}
</ol>
