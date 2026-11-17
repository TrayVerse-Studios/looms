---
layout: page
title: Chapters
permalink: /chapters/
---

Read the novel in order.

<ol class="chapter-list">
{% assign all_chapters = site.chapters | sort: "number" %}
{% for chapter in all_chapters %}
  {% assign rel_date = chapter.release_date | default: site.time | date: "%Y-%m-%d" %}
  {% assign rel_time = chapter.release_time | default: "00:00" %}
  {% assign rel_offset = chapter.timezone_offset | default: 0 %}
  <li{% if chapter.draft %} data-draft="true"{% endif %}{% if chapter.hidden %} data-hidden="true"{% endif %}
      data-release-date="{{ rel_date }}"
      data-release-time="{{ rel_time }}"
      data-timezone-offset="{{ rel_offset }}"
      data-slug="{{ chapter.slug | default: chapter.name | remove: '.md' }}">
    <a href="{{ chapter.url | relative_url }}" data-chapter-url="{{ chapter.url | relative_url }}">
      <span class="num">{{ chapter.number }}</span>
      {{ chapter.title }}
      {% if chapter.draft or chapter.hidden %} <span class="draft-tag">(draft)</span>{% endif %}
      <span class="release-tag" hidden></span>
    </a>
  </li>
{% endfor %}
</ol>
