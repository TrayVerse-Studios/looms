---
layout: default
title: Home
---

{% assign visible = site.chapters | where_exp: "item", "item.hidden != true" | where_exp: "item", "item.draft != true" | sort: "number" %}
{% assign first_chapter = visible | first %}

<section class="hero">
  <p class="eyebrow">Helix City · Earth-34</p>
  <h1>Looms</h1>
  <p class="lede">Richard Cox was perfectly ordinary until he was pulled across four realities and returned with ambiguous power. Now he's the Weaver, Helix City's most unlikely hero—and the person least equipped to hold a broken world together.</p>
  <div class="actions">
    <a class="btn" href="#" hidden data-continue>
      Continue <span data-continue-label>reading</span>
    </a>
    {% if first_chapter %}
      <a class="btn" data-start href="{{ first_chapter.url | relative_url }}">Start from the beginning</a>
    {% endif %}
    <a class="btn ghost" href="{{ '/chapters/' | relative_url }}">All chapters</a>
  </div>
</section>

<h2>On this site</h2>
<div class="card-grid">
  <div class="card">
    <h2>Read</h2>
    <p>{{ visible.size }} published chapter{% if visible.size != 1 %}s{% endif %}, from Helix City across the weave.</p>
    <p><a href="{{ '/chapters/' | relative_url }}">Open the chapter list</a></p>
  </div>
  <div class="card">
    <h2>Characters</h2>
    <p>The Weaver, Shadowbolt, Kangae, and the rest of the Helix roster.</p>
    <p><a href="{{ '/characters/' | relative_url }}">Meet the cast</a></p>
  </div>
  <div class="card">
    <h2>About</h2>
    <p>What Looms is.</p>
    <p><a href="{{ '/about/' | relative_url }}">About the project</a></p>
  </div>
</div>
