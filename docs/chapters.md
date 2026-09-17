---
layout: page
title: Chapters
permalink: /chapters/
---

Read the novel in order.

<ol class="chapter-list">
{% assign visible = site.chapters | where_exp: "item", "item.hidden != true" | where_exp: "item", "item.draft != true" | sort: "number" %}
{% for chapter in visible %}
  <li>
    <a href="{{ chapter.url | relative_url }}" data-chapter-url="{{ chapter.url | relative_url }}">
      <span class="num">{{ chapter.number }}</span>
      {{ chapter.title }}
    </a>
  </li>
{% endfor %}
</ol>
