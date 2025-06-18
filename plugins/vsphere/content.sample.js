// TODO: Convex auth token support

function getFieldValue(selector) {
  const el = document.querySelector(selector);
  return el?.textContent?.trim() || "";
}

function injectStylesheet() {
  const style = document.createElement("style");
  style.id = "hypershelf-vsphere-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400..800&display=swap');

    #hypershelf-vsphere-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      font-size: 0.7rem;
      font-weight: 500;
      transition: all 0.15s ease-in-out;
      pointer-events: auto;
      opacity: 1;
      outline: none;
      background-color: oklch(14% 0.003 285);
      color: oklch(99.7% 0.005 130);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      padding: 0 0.75rem;
      height: 1.8rem;
      gap: 0.25rem;
      border: none;
      position: absolute;
      top: 0.5rem;
      right: 1.5rem;
    }

    #hypershelf-vsphere-button:hover {
      background-color: oklch(20% 0.003 285);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    #hypershelf-vsphere-button:focus-visible {
      border-color: oklch(85% 0.22 130);
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.5);
    }

    #hypershelf-vsphere-iframe {
      width: 100%;
      height: 100px;
      border: 2px solid oklch(85% 0.22 130);
      border-radius: 16px;
      margin-bottom: 16px;
      transition: height 0.3s ease-in-out;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      background-color: oklch(14% 0.003 285);
    }
  `;
  document.head.appendChild(style);
}

function injectButton(src) {
  const target = document.querySelector('vsc-object-titlebar');
  if (!target) return;
  const existingButton = document.querySelector("#hypershelf-vsphere-button");
  if (existingButton) existingButton.remove();
  const button = document.createElement("button");
  button.id = "hypershelf-vsphere-button";
  button.innerHTML = `Open in <span style="font-family: 'Syne', sans-serif; font-weight: 800; font-size: 0.6rem; position: relative">Hypershelf <div style="position: absolute; bottom: 4px; left: 0; width: 14px; height: 2px; background-color: oklch(85% 0.22 130);"></div></span>`;
  button.addEventListener("click", () => {
    window.open(`$HYPERSHELF_HOST$${src}`, "_blank");
  });
  target.style.position = "relative";
  target.appendChild(button);
  return button;
}

function createIframe(dns) {
  const iframe = document.createElement("iframe");
  iframe.src = `$HYPERSHELF_HOST$/integrations/vsphere/?dns=${encodeURIComponent(dns)}`;
  iframe.id = "hypershelf-vsphere-iframe";
  window.addEventListener("message", (event) => {
    if (event.data.type === "HYPERSHELF") {
      const { action, data } = event.data;
      if (action === "UPDATE_HEIGHT") {
        iframe.style.height = `${data.height}px`;
      } else if (action === "ASSET_FOUND") {
        injectButton(data.href);
      }
    }
  });
  return iframe;
}

function injectIframe() {
  const target = document.querySelector('div[portlet-id="vsphere.core.vm.summary.annotationsNotesView"]');
  if (!target) return;

  const existing = document.querySelector('#hypershelf-vsphere-iframe');
  if (existing) return;

  const dns = getFieldValue('span[data-test-id="DNS Name:"]');

  const iframe = createIframe(dns);
  target.insertAdjacentElement('beforebegin', iframe);

  const observer = new MutationObserver(() => {
    const newDns = getFieldValue('span[data-test-id="DNS Name:"]');
    const url = `$HYPERSHELF_HOST$/integrations/vsphere/?dns=${encodeURIComponent(newDns)}`;
    if (iframe.src !== url) {
      iframe.src = url;
    }
  });

  const dnsEl = document.querySelector('span[data-test-id="DNS Name:"]');
  if (dnsEl) observer.observe(dnsEl, { childList: true, subtree: true });
}

injectStylesheet();

const interval = setInterval(() => {
  if (
    document.querySelector('div[portlet-id="vsphere.core.vm.summary.annotationsNotesView"]') &&
    document.querySelector('span[data-test-id="DNS Name:"]') &&
    !document.querySelector('#hypershelf-vsphere-iframe')
  ) {
    injectIframe();
  }
}, 200);
