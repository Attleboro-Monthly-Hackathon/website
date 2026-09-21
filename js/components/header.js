import { getSite, interpolate } from "../config.js";
import { loadChrome } from "../content.js";
import { currentRoute } from "../router.js";
import { fillSlot, upgradeOnce } from "../dom.js";

function isCurrent(item, route) {
  if (item.match === "prefix") return route.startsWith(item.route);
  return route === item.route;
}

function navMarkup() {
  const route = currentRoute();
  return getSite()
    .nav.map((item) => {
      if (item.external) {
        return `<a href="${item.href}" rel="noopener noreferrer" target="_blank">${item.label}</a>`;
      }
      const current = isCurrent(item, route);
      return `<a href="${item.href}" ${current ? 'aria-current="page"' : ""}>${item.label}</a>`;
    })
    .join("");
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    if (!upgradeOnce(this)) return;
    this.classList.add("site-header");
    this.render();
    document.addEventListener("spa:navigated", () => this.refresh());
  }

  async render() {
    this.innerHTML = interpolate(await loadChrome("header"));
    fillSlot(this, "nav", navMarkup());

    const toggle = this.querySelector(".nav-toggle");
    const nav = this.querySelector(".site-nav");
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  refresh() {
    const nav = this.querySelector('[data-slot="nav"]') || this.querySelector(".site-nav");
    if (!nav) return;
    nav.innerHTML = navMarkup();
    nav.classList.remove("is-open");
    this.querySelector(".nav-toggle")?.setAttribute("aria-expanded", "false");
  }
}

customElements.define("site-header", SiteHeader);
