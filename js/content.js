import { applyConfigText, siteConfig } from "./config.js";

const htmlCache = new Map();
let catalogPromise;

function interpolateItem(item) {
  const next = { ...item };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string") next[key] = applyConfigText(value);
  }
  return next;
}

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(new URL("../data/content.json", import.meta.url))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load content (${response.status})`);
        }
        return response.json();
      })
      .then((json) => {
        const catalog = {};
        for (const [kind, items] of Object.entries(json)) {
          catalog[kind] = Array.isArray(items) ? items.map(interpolateItem) : items;
        }
        return catalog;
      });
  }
  return catalogPromise;
}

export async function loadContent(relativePath) {
  if (htmlCache.has(relativePath)) return htmlCache.get(relativePath);

  const response = await fetch(new URL(`../content/${relativePath}`, import.meta.url));
  if (!response.ok) {
    throw new Error(`Failed to load ${relativePath} (${response.status})`);
  }

  const html = applyConfigText(await response.text());
  htmlCache.set(relativePath, html);
  return html;
}

export function loadPage(name) {
  return loadContent(`pages/${name}.html`);
}

export function loadChrome(name) {
  return loadContent(`chrome/${name}.html`);
}

export function loadFragment(kind, slug) {
  return loadContent(`${kind}/${slug}.html`);
}

export function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function itemHref(kind, slug) {
  return `#/${kind}/${slug}`;
}

export function itemListMeta(item, collection) {
  if (collection.metaKey === "date" && item.date) return formatDate(item.date);
  return item[collection.metaKey] || item.eyebrow || "";
}

export function itemEyebrow(item, collection) {
  if (collection.eyebrow) return collection.eyebrow;
  if (item.eyebrow) return item.eyebrow;
  return itemListMeta(item, collection);
}

export function findItem(catalog, kind, slug) {
  return (catalog[kind] || []).find((entry) => entry.slug === slug) || null;
}

/** GitHub edit URL for a catalog page’s source file in the website repo. */
export function contentEditUrl(kind, item) {
  const declared = typeof item?.sourcePath === "string" ? item.sourcePath.trim() : "";
  const fallback =
    kind && item?.slug ? `content/${kind}/${String(item.slug).replace(/^\/+|\/+$/g, "")}.html` : "";
  const path = declared || fallback;
  if (!path) return null;
  if (!/\.(md|html?)$/i.test(path)) return null;

  const repo = String(siteConfig.githubWebsiteUrl || "").replace(/\/$/, "");
  const branch = siteConfig.githubBranch || "main";
  if (!repo) return null;

  return `${repo}/edit/${branch}/${path.replace(/^\/+/, "")}`;
}

/** GitHub “create file” URL for a new page in a content category. */
export function contentNewUrl(kind) {
  const folder = String(kind || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!folder || folder.includes("..") || folder.includes("/")) return null;

  const repo = String(siteConfig.githubWebsiteUrl || "").replace(/\/$/, "");
  const branch = siteConfig.githubBranch || "main";
  if (!repo) return null;

  return `${repo}/new/${branch}/content/${folder}?filename=your-page-slug.html`;
}

