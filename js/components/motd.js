import { getSite, interpolate } from "../config.js";
import { loadChrome } from "../content.js";
import { fillSlot, upgradeOnce } from "../dom.js";

function isExternalHref(href) {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

class SiteMotd extends HTMLElement {
  async connectedCallback() {
    if (!upgradeOnce(this)) return;

    const motd = getSite().motd;
    const text = typeof motd?.text === "string" ? motd.text.trim() : "";
    if (!motd?.enabled || !text) {
      this.setAttribute("hidden", "");
      return;
    }

    this.classList.add("site-motd");
    this.setAttribute("role", "status");
    this.innerHTML = interpolate(await loadChrome("motd"), {
      text,
      linkLabel: motd.linkLabel || "Learn more",
    });

    const href = typeof motd.href === "string" ? motd.href.trim() : "";
    if (!href) {
      fillSlot(this, "link", "");
      return;
    }

    const link = this.querySelector('[data-slot="link"]');
    if (!link) return;
    link.href = href;
    if (isExternalHref(href)) {
      link.rel = "noopener noreferrer";
      link.target = "_blank";
    }
  }
}

customElements.define("site-motd", SiteMotd);
