/*
 * Hearthstone Box CEF passive observer.
 *
 * Paste this file into the Box page's DevTools Console.
 * It preserves the original callbacks and only observes their arguments.
 */
(function installHsboxObserver() {
  "use strict";

  const callbackNames = [
    "onUpdateArenaRecommend",
    "onUpdateLadderActionRecommend",
    "onUpdateWinrateData",
  ];

  const maxEvents = 100;
  const eventBuffer = Array.isArray(window.__HSBOX_EVENTS)
    ? window.__HSBOX_EVENTS
    : [];

  function parsePayload(value) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  }

  function record(name, args) {
    const event = {
      time: new Date().toISOString(),
      name,
      data: parsePayload(args[0]),
    };

    eventBuffer.push(event);
    while (eventBuffer.length > maxEvents) eventBuffer.shift();
    window.__HSBOX_EVENTS = eventBuffer;
    window.__HSBOX_LAST_EVENT = event;

    console.log("[HSBOX]", name, event.data);
  }

  for (const name of callbackNames) {
    const marker = `__HSBOX_HOOK_${name}`;
    if (window[marker]) continue;

    let original = typeof window[name] === "function" ? window[name] : null;
    const wrapper = function wrappedHsboxCallback(...args) {
      try {
        record(name, args);
      } catch (error) {
        console.warn("[HSBOX] observer error", name, error);
      }

      if (typeof original === "function") {
        return original.apply(this, args);
      }
    };

    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get() {
          return wrapper;
        },
        set(next) {
          original = typeof next === "function" ? next : null;
        },
      });
      window[marker] = true;
      console.log("[HSBOX] hooked", name);
    } catch (error) {
      console.warn("[HSBOX] cannot hook", name, error);
    }
  }

  window.hsboxReadEvents = function hsboxReadEvents() {
    return eventBuffer.slice();
  };

  console.log(
    "[HSBOX] observer ready; read window.__HSBOX_EVENTS or call hsboxReadEvents()",
  );
})();
