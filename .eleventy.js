const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {

  // --- Pass through static assets ---
  eleventyConfig.addPassthroughCopy("src/assets");

  // --- Date filters ---
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLLL d, yyyy");
  });

  eleventyConfig.addFilter("shortDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLL d");
  });

  eleventyConfig.addFilter("upperDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLLL d, yyyy").toUpperCase();
  });

  eleventyConfig.addFilter("monthYear", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("LLLL yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toISO();
  });

  eleventyConfig.addFilter("rssDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toRFC2822();
  });

  // --- Slugify filter ---
  eleventyConfig.addFilter("slugify", (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  });

  // --- Group posts by month/year for archive ---
  eleventyConfig.addFilter("groupByMonth", (posts) => {
    const groups = {};
    posts.forEach(post => {
      const key = DateTime.fromJSDate(post.date, { zone: "utc" }).toFormat("LLLL yyyy");
      if (!groups[key]) groups[key] = [];
      groups[key].push(post);
    });
    return Object.entries(groups).map(([month, posts]) => ({ month, posts }));
  });

  // --- Get all unique categories ---
  eleventyConfig.addFilter("allCategories", (posts) => {
    const catMap = {};
    posts.forEach(post => {
      const cats = post.data.categories || [];
      cats.forEach(c => {
        if (!catMap[c]) catMap[c] = [];
        catMap[c].push(post);
      });
    });
    return Object.entries(catMap).sort((a, b) => a[0].localeCompare(b[0])).map(([name, posts]) => ({ name, posts, count: posts.length }));
  });

  // --- Limit filter ---
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));

  // --- Root path filter (makes file:// protocol work) ---
  eleventyConfig.addFilter("rootPath", (pageUrl) => {
    // Count depth: /posts/my-post/ has depth 2, / has depth 0
    const depth = (pageUrl || "/").replace(/^\/|\/$/g, "").split("/").filter(Boolean).length;
    return depth === 0 ? "." : Array(depth).fill("..").join("/");
  });

  // --- Posts collection (sorted newest first) ---
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date);
  });

  // --- Categories collection ---
  eleventyConfig.addCollection("categories", function (collectionApi) {
    const posts = collectionApi.getFilteredByGlob("src/posts/*.md");
    const catMap = {};
    posts.forEach(post => {
      const cats = post.data.categories || [];
      cats.forEach(c => {
        if (!catMap[c]) catMap[c] = [];
        catMap[c].push(post);
      });
    });
    return Object.entries(catMap).sort((a, b) => a[0].localeCompare(b[0])).map(([name, posts]) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      posts: posts.sort((a, b) => b.date - a.date),
      count: posts.length
    }));
  });

  // --- Search data: generated as a separate template (search-data.njk) to avoid templateContent timing issues ---

  // --- Markdown config ---
  let markdownIt = require("markdown-it");
  let md = markdownIt({ html: true, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  // --- Config ---
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
