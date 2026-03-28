# Ore's Blog — Complete Guide for Claude

> **READ THIS FIRST.** This file is the single source of truth for how this blog works. It is written for Claude (Cowork/Claude Code) to understand the full architecture, every file, every workflow, and every decision made. If Ore asks you to do anything with this blog, read this file first.

---

## 0. Ore's Vision, Mindset & How He Wants to Work

### Who is Ore

Ore is not a developer. He does not write code, use Terminal, or manage technical infrastructure. He is a thinker, writer, and builder who uses Claude as his technical partner. When Ore has an idea, he describes it in plain language and expects Claude to handle 100% of the execution.

### The Original Request

Ore wanted to build a website that looks and acts like Seth Godin's blog (seths.blog). The key principles:

- **Content-first, minimalist design** — no clutter, no distractions, just the writing
- **Managed entirely through Claude** — Ore communicates what he wants, Claude does the work. Ore never needs to touch code, Terminal, or config files.
- **Built for the long ride** — not a quick hack, but a solid foundation that scales. Ore plans to add datasets, automations, and more features over time. The architecture must be flexible enough to grow without rebuilding.
- **Fast and efficient** — both the site itself (loads instantly) and the workflow (Claude can add a post in seconds). No wasted effort on either side.
- **Local-first** — the site lives on Ore's Mac, managed through Cowork. It will eventually go online via GitHub + Cloudflare Pages, but the local folder is always the source of truth.

### How Ore Wants to Work with Claude

This is critical. Ore's workflow is conversational:

- **"Post this"** — Ore gives Claude text (and optionally a title, category). Claude creates the .md file, builds the site, and if deployed, pushes to GitHub. Ore never sees a file or runs a command.
- **"Edit the post about X"** — Claude finds the post, makes the edit, rebuilds.
- **"Add this data"** — Claude drops the data file in the right place, creates a page for it if needed, rebuilds.
- **"Change the look of Y"** — Claude edits the CSS or template, rebuilds.
- **"Put this online"** — Claude handles Git and deployment.
- **"Show me the site"** — Claude starts the local server or opens the live URL.

Ore does NOT want to be asked technical questions. Don't ask him "which template engine?" or "what port should I use?" — just make the right decision and do it. If a decision truly requires his input (like design preferences or content choices), ask in plain language with visual options when possible.

### What Ore Values

- **Speed** — don't overthink, don't over-explain. Get things done.
- **Quality** — but also don't rush and deliver broken work. Test before saying "done."
- **Simplicity** — keep the architecture simple. If something can be done with fewer moving parts, do it that way.
- **Flexibility** — build foundations that don't lock him in. He will want to add things later that nobody has thought of yet.
- **Honesty** — if something doesn't work or needs a different approach, say so directly. Don't pretend.

### The Long-Term Vision

This blog is the starting point. Ore plans to:

- Publish regularly (Claude handles posting)
- Add datasets and data-driven pages (investments, research, etc.)
- Add automations (scheduled posts, data fetching, etc.)
- Eventually put the site online with a custom domain
- Potentially add more complex features as needs evolve

The architecture was specifically chosen (Eleventy + individual Markdown files + _data folder) to support all of this without needing to rebuild.

### Important: Don't Make Ore Do Technical Work

If something requires Terminal, Git commands, npm installs, or any technical step — Claude should either handle it directly or give Ore the absolute simplest possible instruction (one line to paste, with an explanation of what it does). Never dump a multi-step technical process on Ore without context.

---

## 1. What This Is

A personal blog for Ore, inspired by Seth Godin's blog (seths.blog). Built with Eleventy (11ty), a static site generator. The design uses a charcoal monochrome color scheme with a fixed left sidebar layout.

Ore does NOT touch code. Ore does NOT use Terminal. Ore tells Claude what to do in plain language, and Claude handles all file edits, builds, and deployments.

---

## 2. Tech Stack

- **Eleventy (11ty) v3.1.5** — static site generator (Node.js)
- **Nunjucks (.njk)** — template language used for layouts and pages
- **Markdown (.md)** — used for blog post content
- **markdown-it** — Markdown parser (configured with html, linkify, typographer)
- **Luxon** — date formatting library
- **Google Fonts** — Source Sans 3 (headings) + PT Serif (body text)
- **No frameworks** — no React, no Tailwind, no jQuery. Pure HTML/CSS/vanilla JS.

---

## 3. Project Structure (Every File Explained)

```
site/
│
├── .eleventy.js                ← ELEVENTY CONFIG (see Section 4)
├── package.json                ← npm scripts: build, serve, clean
├── package-lock.json           ← Locked dependency versions
├── .gitignore                  ← Excludes node_modules/, _site/, .DS_Store
├── INSTRUCTIONS.md             ← THIS FILE — read before doing anything
│
├── src/                        ← ALL SOURCE FILES LIVE HERE
│   │
│   ├── _data/                  ← GLOBAL DATA (available in all templates)
│   │   └── site.json           ← Site config: title, author, description, about text
│   │                              Access in templates as: {{ site.title }}, {{ site.author }}, etc.
│   │
│   ├── _includes/              ← TEMPLATES (layouts that wrap content)
│   │   ├── base.njk            ← Master layout: <html>, <head>, sidebar, <main>, <script> tags
│   │   │                          Every page uses this. Contains the sidebar with:
│   │   │                          - Site title/branding link
│   │   │                          - Search form (submits to /search/ page)
│   │   │                          - Subscribe form (localStorage, ready for Mailchimp/ConvertKit)
│   │   │                          - Navigation links (Home, Archive, Categories, Search, About, RSS)
│   │   │
│   │   └── post.njk            ← Single post layout (extends base.njk)
│   │                              Renders: post title (h1), content, date (uppercase),
│   │                              category tags, social share icons (FB, Twitter, LinkedIn, copy link),
│   │                              and prev/next post navigation.
│   │                              The prev/next logic iterates collections.posts to find adjacent posts.
│   │
│   ├── posts/                  ← BLOG POSTS (one .md file per post)
│   │   ├── posts.json          ← DEFAULT FRONT MATTER for all posts in this folder:
│   │   │                          { "layout": "post.njk",
│   │   │                            "permalink": "/posts/{{ title | slugify }}/",
│   │   │                            "tags": "posts" }
│   │   │                          This means individual posts do NOT need to specify layout,
│   │   │                          permalink, or tags — only title, date, and categories.
│   │   │
│   │   ├── 2026-03-23-the-gap-between-knowing-and-doing.md
│   │   ├── 2026-03-24-simplicity-is-a-feature.md
│   │   ├── 2026-03-25-small-decisions-compound.md
│   │   ├── 2026-03-26-on-building-things-that-last.md
│   │   └── 2026-03-27-the-first-post.md
│   │
│   ├── assets/                 ← STATIC FILES (copied as-is to _site/)
│   │   ├── css/
│   │   │   └── style.css       ← ALL STYLING (684 lines). See Section 6 for design specs.
│   │   ├── js/
│   │   │   └── app.js          ← CLIENT-SIDE JS: search logic, sidebar search redirect,
│   │   │                          subscribe handler (localStorage), copy-link helper.
│   │   │                          Also reads URL param ?q= to auto-fill search on /search/ page.
│   │   └── images/             ← Place post images here. Reference as /assets/images/filename.jpg
│   │
│   ├── index.njk               ← HOMEPAGE. Uses Eleventy pagination on collections.posts.
│   │                              Shows 10 posts per page, full content (not excerpts).
│   │                              Generates /index.html, /page/2/index.html, etc.
│   │
│   ├── archive.njk             ← ARCHIVE PAGE (/archive/). Groups posts by month/year
│   │                              using the custom "groupByMonth" filter.
│   │
│   ├── categories.njk          ← CATEGORIES INDEX (/categories/). Lists all categories
│   │                              with post counts, linking to individual category pages.
│   │
│   ├── category-pages.njk      ← AUTO-GENERATES one page per category.
│   │                              Uses Eleventy pagination over collections.categories.
│   │                              Output: /categories/ideas/index.html, /categories/building/index.html, etc.
│   │
│   ├── search.njk              ← SEARCH PAGE (/search/). Contains the search input field.
│   │                              Loads /assets/js/search-data.js (generated at build time)
│   │                              which provides window.SEARCH_DATA to the client-side search in app.js.
│   │
│   ├── search-data.njk         ← BUILD-TIME TEMPLATE that generates /assets/js/search-data.js.
│   │                              Outputs a JS file setting window.SEARCH_DATA = [...] with
│   │                              title, url, date, categories, and truncated content for each post.
│   │                              This is NOT an HTML page — it outputs a .js file.
│   │
│   ├── about.njk               ← ABOUT PAGE (/about/). Renders site.about from site.json
│   │                              by splitting on double newlines into paragraphs.
│   │
│   └── feed.njk                ← RSS FEED (/feed.xml). Outputs valid RSS 2.0 XML.
│                                  Includes the 20 most recent posts with full content in CDATA.
│
├── _site/                      ← GENERATED OUTPUT (created by `npm run build`)
│                                  This folder IS the website. Every file here is deployable.
│                                  NEVER edit files in _site/ — they get overwritten on every build.
│
└── node_modules/               ← Dependencies (auto-installed by `npm install`)
                                   Not committed to git. Recreated from package.json.
```

---

## 4. Eleventy Config (.eleventy.js) — What It Does

The config file registers:

**Filters (used in templates):**
- `readableDate` — "March 27, 2026"
- `shortDate` — "Mar 27"
- `upperDate` — "MARCH 27, 2026"
- `monthYear` — "March 2026"
- `isoDate` — ISO 8601 format
- `rssDate` — RFC 2822 format (for RSS)
- `slugify` — converts text to URL-safe slug
- `groupByMonth` — groups an array of posts by month/year (returns [{month, posts}])
- `allCategories` — extracts all unique categories from posts
- `limit` — array slice helper

**Collections:**
- `posts` — all .md files in src/posts/, sorted newest first
- `categories` — unique categories with their posts, sorted alphabetically. Each entry has: name, slug, posts[], count

**Passthrough copy:**
- `src/assets` → `_site/assets` (CSS, JS, images copied as-is)

**Markdown library:**
- markdown-it with html: true, linkify: true, typographer: true

**Directory config:**
- Input: `src/`
- Output: `_site/`
- Includes: `_includes/`
- Data: `_data/`

---

## 5. How to Do Common Tasks

### 5.1 Add a New Post

Create a new file in `src/posts/` with this exact format:

**Filename:** `YYYY-MM-DD-slug-title.md` (the date in the filename is for your organization only — the date in the front matter is what Eleventy uses)

**Content:**
```markdown
---
title: "Your Post Title Here"
date: YYYY-MM-DD
categories: ["Category1", "Category2"]
---

First paragraph of the post.

Second paragraph. Use standard Markdown: **bold**, *italic*, [links](url), > blockquotes, - lists, ## headings, ![images](/assets/images/file.jpg).
```

**Then run:** `npm run build` (from the site/ directory)

The post will automatically appear on: homepage, archive, its category pages, search index, and RSS feed.

### 5.2 Edit an Existing Post

Open the `.md` file in `src/posts/`, make changes, run `npm run build`.

### 5.3 Delete a Post

Delete the `.md` file from `src/posts/`, run `npm run build`.

### 5.4 Change Site Title / Author / Description

Edit `src/_data/site.json`:
```json
{
  "title": "Ore's Blog",
  "author": "Ore",
  "description": "Thoughts, ideas, and things worth sharing.",
  "url": "",
  "about": "First paragraph of about page.\n\nSecond paragraph.\n\nThird paragraph."
}
```
Then `npm run build`.

### 5.5 Update the About Page

Edit the `"about"` field in `src/_data/site.json`. Use `\n\n` for paragraph breaks. Then `npm run build`.

### 5.6 Add a New Data File (for future datasets, tables, etc.)

Drop a `.json` file in `src/_data/`. Example: `src/_data/investments.json`

It becomes available in any template as `{{ investments }}`. Create a new `.njk` page in `src/` to display it:

```njk
---
layout: base.njk
pageTitle: Investments
permalink: /investments/
---
<h1 class="page-title">Investments</h1>
{% for item in investments %}
  <p>{{ item.name }}: {{ item.value }}</p>
{% endfor %}
```

Then `npm run build`.

### 5.7 Add Images to a Post

Place the image in `src/assets/images/`. Reference in post Markdown as:
```markdown
![Alt text](/assets/images/your-image.jpg)
```

### 5.8 Preview the Site Locally

Run `npm run serve` — opens a local server at http://localhost:8080 with live reload.

### 5.9 Build for Deployment

Run `npm run build` — generates everything into `_site/`.

---

## 6. Design Specifications

The design faithfully recreates Seth Godin's blog layout with a charcoal monochrome color scheme.

### Layout
- **Sidebar:** Fixed left, 320px wide. Contains branding, search, subscribe, navigation.
- **Content area:** Right side, `margin-left: 320px`, `padding: 35px 120px 60px`, max-width 900px.
- **Top accent bar:** 4px charcoal (#2a2a2a) bar fixed at top of viewport via `body::before`.
- **Responsive:** At ≤960px, sidebar becomes relative (stacks on top). Content gets full width.

### Typography
- **Headings (post titles, section titles, sidebar labels):** `'Source Sans 3', sans-serif`, weight 900
- **Post titles on homepage:** 35.2px
- **Post titles on single page:** 38px
- **Body text:** `'PT Serif', Georgia, serif`, 17.6px, line-height 1.55
- **Body text color:** `#2c3e50`
- **Date stamps:** Source Sans 3, 12.8px, weight 600, uppercase, color #000
- **Sidebar headings:** Source Sans 3, 16px, weight 900, color #000
- **Sidebar nav links:** PT Serif, 14px

### Colors
- **Background:** #fff
- **Body text:** #2c3e50
- **Headings:** #000
- **Accent (buttons, top bar, pagination active):** #2a2a2a
- **Button text:** #fff
- **Button hover:** #444
- **Post separator:** 1px solid #eee
- **Search highlight:** rgba(0, 0, 0, 0.08)

### Fonts Loading
Google Fonts loaded via CSS `@import`:
```
https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Source+Sans+3:wght@400;600;700;900&display=swap
```
Falls back to Georgia (body) and system sans-serif (headings) when offline.

---

## 7. Features

| Feature | Implementation |
|---------|---------------|
| **Homepage** | Paginated (10 posts/page), full content display, auto-pagination links |
| **Single post** | Own URL (/posts/slug/), prev/next navigation, share icons, category tags |
| **Archive** | Posts grouped by month/year via groupByMonth filter |
| **Categories** | Index page lists all categories. Each category gets its own page auto-generated by category-pages.njk |
| **Search** | Client-side full-text search. Index generated at build time (search-data.njk → search-data.js). Debounced input, highlights matches. |
| **RSS** | Valid RSS 2.0 at /feed.xml. Auto-generated. Includes 20 most recent posts with full content. |
| **Subscribe** | Email form in sidebar. Currently stores to localStorage. Ready to connect to Mailchimp/ConvertKit by changing the form action. |
| **Share** | SVG icons for Facebook, Twitter, LinkedIn, and copy-link on every post. |
| **Responsive** | Sidebar collapses to top at ≤960px. Further adjustments at ≤600px. |

---

## 8. Deployment (Not Yet Set Up)

The plan is to deploy via **Cloudflare Pages** or **GitHub Pages**:

1. Push the repo to GitHub
2. Connect to Cloudflare Pages (or set up GitHub Actions)
3. Build command: `npm run build`
4. Output directory: `_site`
5. The `site.url` field in `src/_data/site.json` should be updated to the live URL once deployed

After deployment, Claude's workflow becomes: edit files → `npm run build` → `git add . && git commit -m "message" && git push` → site auto-deploys.

---

## 9. First-Time Setup on a New Mac

**Prerequisites:** Node.js must be installed. Download from https://nodejs.org (LTS version).

**Steps:**
1. Copy the `site` folder to the Mac (or `git clone` the repo)
2. Open Terminal
3. `cd` into the site folder (e.g., `cd ~/Desktop/site`)
4. Run `npm install` (installs dependencies from package.json — takes ~30 seconds)
5. Run `npm run serve` to preview at http://localhost:8080
6. Or run `npm run build` to just generate the _site/ output

**For Claude access via Cowork:**
- Ore needs to grant Claude access to the `site` folder
- macOS may require enabling folder access in System Settings → Privacy & Security → Files and Folders (or Full Disk Access) for Claude/Cowork
- Once connected, Claude can read/write all files in the project

---

## 10. Important Rules for Claude

1. **NEVER edit files in `_site/`.** They are auto-generated and overwritten on every build.
2. **ALWAYS run `npm run build` after making changes** to any file in `src/`.
3. **Post filenames** should follow the pattern `YYYY-MM-DD-slug.md` for consistency.
4. **Front matter is YAML** between `---` markers. Title must be in quotes. Date is YYYY-MM-DD. Categories is a JSON array.
5. **The posts.json in src/posts/** provides default layout, permalink, and tags. Do NOT duplicate these in individual post front matter.
6. **site.json** is the single config file. Title, author, description, and about text all live there.
7. **To add a new page type**, create a `.njk` file in `src/` with `layout: base.njk` in front matter.
8. **To add a new dataset**, drop a `.json` in `src/_data/` and create a template to display it.
9. **To change the design**, edit `src/assets/css/style.css`. The charcoal accent color is `#2a2a2a` throughout.
10. **The search index** is regenerated on every build via `src/search-data.njk`. No manual update needed.
11. **Images** go in `src/assets/images/` and are referenced as `/assets/images/filename.jpg` in posts.
12. **To connect email signup to a real service**, modify the `<form>` in `src/_includes/base.njk` and the `handleSubscribe` function in `src/assets/js/app.js`.

---

## 11. Quick Reference — Claude Cheat Sheet

```bash
# Preview site locally
cd ~/Desktop/site && npm run serve
# → opens at http://localhost:8080

# Build site (generates _site/)
npm run build

# Clean build (delete _site/ first)
npm run clean && npm run build

# After editing, commit and push
git add -A && git commit -m "Add new post: title" && git push
```

**Add a post:**
```bash
# Create file: src/posts/YYYY-MM-DD-slug.md
# Front matter: title, date, categories
# Content: Markdown
# Then: npm run build
```

**Edit site config:**
```bash
# Edit: src/_data/site.json
# Then: npm run build
```

**Edit design:**
```bash
# Edit: src/assets/css/style.css
# Then: npm run build
```

**Edit sidebar/layout:**
```bash
# Edit: src/_includes/base.njk
# Then: npm run build
```

---

## 12. Design History & User Preferences

- Ore wanted a blog that looks and acts like seths.blog
- Seth's blog uses: PT Serif (body), Source Sans Pro (headings), fixed left sidebar (320px), content right, yellow accent (rgb(255, 185, 0))
- Ore did NOT want yellow/orange colors. Also rejected: deep blue, forest green, coral, electric violet, hot magenta, vivid teal, indigo gradient
- Ore chose: **Charcoal monochrome (#2a2a2a)** — pure black/white/gray, no color accent
- Ore prefers bold & modern aesthetic direction
- Ore may revisit colors later — possibly Manchester United inspired (deep red #da020e, black, white, gold) but decided to keep it simple for now
- The design should always stay minimalist and content-focused
