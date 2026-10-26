"use client";

import * as React from "react";

/**
 * Registers the service worker, which is what lets the browser treat this as
 * an installable app and fire the event the install button waits for.
 *
 * Registration is deliberately late: it waits for load so it never competes
 * with the first paint on a phone on parish wifi.
 */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable service worker costs the install offer and nothing
        // else, so there is no reason to surface it to a volunteer.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
