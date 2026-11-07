---
layout: page
title: Chapters
permalink: /chapters/
---

Read the novel in order.

<ol class="chapter-list">
{% assign all_chapters = site.chapters | sort: "number" %}
{% for chapter in all_chapters %}
  <li{% if chapter.draft %} data-draft="true"{% endif %}{% if chapter.hidden %} data-hidden="true"{% endif %}>
    <a href="{{ chapter.url | relative_url }}" data-chapter-url="{{ chapter.url | relative_url }}">
      <span class="num">{{ chapter.number }}</span>
      {{ chapter.title }}
      {% if chapter.draft or chapter.hidden %} <span class="draft-tag">(draft)</span>{% endif %}
    </a>
  </li>
{% endfor %}
</ol>
