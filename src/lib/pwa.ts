/** Runs in <head> before the app loads, so the browser's install offer (Android / Chrome) is never missed. */
export const INSTALL_CAPTURE_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__tpacInstall=e;window.dispatchEvent(new Event("tpac:installable"))});window.addEventListener("appinstalled",function(){window.__tpacInstall=null});`;
