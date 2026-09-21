import { setMetaDescription, setPageTitle } from "./assets.js";
import { bindConfig, getCollections, getPage, interpolate, siteConfig } from "./config.js";
import {
  contentEditUrl,
  contentNewUrl,
  findItem,
  itemEyebrow,
  loadCatalog,
  loadFragment,
  loadPage,
} from "./content.js";
import { fillSlot, pruneOptional } from "./dom.js";

let renderGeneration = 0;

function contribLink(url, label) {
  if (!url || !label) return "";
  return `<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>`;
}

function newPageLink(kind) {
  const collection = getCollections()[kind];
  const label = collection?.newPageLabel || siteConfig.newPageLabel || "Start a new page";
  return contribLink(contentNewUrl(kind), label);
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function kindsPattern() {
  return Object.keys(getCollections()).map(escapeRe).join("|");
}

function mainEl() {
  return document.getElementById("main");
}

export function currentRoute() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw || raw === "calendar") return raw === "calendar" ? "/calendar" : "/";
  return raw.startsWith("/") ? raw.replace(/\/$/, "") || "/" : `/${raw}`;
}

export function parseRoute(route = currentRoute()) {
  if (route === "/" || route === "") return { name: "home" };
  if (route === "/calendar") return { name: "home", scroll: "calendar" };

  const match = route.match(new RegExp(`^/(${kindsPattern()})(?:/([^/]+))?$`));
  if (!match) return { name: "not-found" };

  const kind = match[1];
  const slug = match[2] || null;
  return slug ? { name: "doc", kind, slug } : { name: "index", kind };
}

export function toHash(href) {
  if (!href) return null;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (href === "#main" || href.startsWith("#main?")) return null;

  if (href === "#calendar" || href === "/#calendar") return "#/calendar";
  if (href.startsWith("#/")) return href;
  if (href === "#" || href === "#/") return "#/";

  try {
    const url = new URL(href, window.location.origin);
    const path = url.pathname.replace(/\/index\.html$/, "/");
    if (url.origin !== window.location.origin) return null;

    if (path === "/" || path === "" || path.endsWith("/index.html")) {
      if (url.hash === "#calendar") return "#/calendar";
      if (url.hash.startsWith("#/")) return url.hash;
      return "#/";
    }

    const match = path.match(new RegExp(`/(${kindsPattern()})(?:/([^/]+?)(?:\\.html)?)?/?$`));
    if (match) {
      const slug = match[2] && match[2] !== "index" ? `/${match[2]}` : "";
      return `#/${match[1]}${slug}`;
    }
  } catch {
    return null;
  }

  return null;
}

export function navigate(hash, { replace = false } = {}) {
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (replace) {
    history.replaceState(null, "", next);
  } else if (window.location.hash !== next) {
    window.location.hash = next;
    return;
  }
  renderRoute();
}

async function renderHome(scrollId) {
  const page = getPage("home");
  mainEl().innerHTML = await loadPage("home");
  setPageTitle(scrollId === "calendar" ? page.calendarTitle : null);
  setMetaDescription(page.description);
  return scrollId;
}

async function renderIndex(kind) {
  const copy = getPage(kind);
  const main = mainEl();
  if (!copy?.kind) {
    await renderNotFound();
    return;
  }
  setPageTitle(copy.title);
  setMetaDescription(copy.description);
  main.innerHTML = interpolate(await loadPage("listing"), copy);
  fillSlot(main, "new-page", newPageLink(kind));
}

async function renderDoc(kind, slug) {
  const collection = getCollections()[kind];
  const main = mainEl();
  if (!collection) {
    await renderNotFound();
    return;
  }

  main.innerHTML = `<p class="empty-state wrap">${siteConfig.loading}</p>`;

  const catalog = await loadCatalog();
  const item = findItem(catalog, kind, slug);
  if (!item) {
    await renderNotFound();
    return;
  }

  const [body, shell, bannerTpl] = await Promise.all([
    loadFragment(kind, slug),
    loadPage("doc"),
    loadPage("doc-banner"),
  ]);

  setPageTitle(item.title);
  setMetaDescription(item.summary);

  main.innerHTML = interpolate(shell, {
    wrapClass: collection.wrapClass || "wrap",
    eyebrow: itemEyebrow(item, collection),
    title: item.title,
    lede: item.lede || item.summary || "",
    backHref: collection.path,
    backLabel: collection.backLabel,
  });
  pruneOptional(main);

  const bannerHtml =
    item.theme || item.bannerTitle || item.bannerText
      ? interpolate(bannerTpl, {
          theme: item.theme || "",
          bannerTitle: item.bannerTitle || "",
          bannerText: item.bannerText || "",
        })
      : "";
  const banner = fillSlot(main, "banner", bannerHtml);
  if (banner) {
    pruneOptional(banner);
    if (!banner.textContent.trim()) banner.remove();
  }
  fillSlot(main, "body", body);
  fillSlot(
    main,
    "fix-typo",
    (() => {
      const editUrl = contentEditUrl(kind, item);
      if (!editUrl) return "";
      const label = siteConfig.fixTypoLabel || "Fix a typo";
      return contribLink(editUrl, label);
    })()
  );
  fillSlot(main, "new-page", newPageLink(kind));
}

async function renderNotFound() {
  const page = getPage("notFound");
  setPageTitle(page.title);
  setMetaDescription(page.description);
  mainEl().innerHTML = await loadPage("not-found");
}

export async function renderRoute() {
  const gen = ++renderGeneration;
  const parsed = parseRoute();
  const main = mainEl();
  if (!main) return;

  let scrollId = null;
  try {
    if (parsed.name === "home") {
      scrollId = await renderHome(parsed.scroll);
    } else if (parsed.name === "index") {
      await renderIndex(parsed.kind);
    } else if (parsed.name === "doc") {
      await renderDoc(parsed.kind, parsed.slug);
    } else {
      await renderNotFound();
    }
  } catch (error) {
    console.error(error);
    if (gen !== renderGeneration) return;
    main.innerHTML = `<p class="empty-state wrap">${siteConfig.loadError}</p>`;
  }

  if (gen !== renderGeneration) return;

  bindConfig(main);

  document.dispatchEvent(
    new CustomEvent("spa:navigated", { detail: { route: currentRoute(), parsed } })
  );

  if (scrollId) {
    document.getElementById(scrollId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}

export function absorbLegacyPath() {
  const path = window.location.pathname.replace(/\/index\.html$/, "/");
  const match = path.match(new RegExp(`/(${kindsPattern()})(?:/([^/]+?)(?:\\.html)?)?/?$`));
  if (!match) return false;
  const slug = match[2] && match[2] !== "index" ? `/${match[2]}` : "";
  window.location.replace(`${window.location.origin}/#/${match[1]}${slug}`);
  return true;
}

export function interceptNavigation() {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    const hash = toHash(link.getAttribute("href"));
    if (!hash) return;
    event.preventDefault();
    navigate(hash);
  });

  window.addEventListener("hashchange", () => {
    renderRoute();
  });
}
