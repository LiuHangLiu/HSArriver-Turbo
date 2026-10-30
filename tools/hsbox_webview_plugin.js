/*
 * HSArriver read-only WebView plugin
 *
 * Purpose:
 *   - Observe the callbacks used by the Hearthstone Box pages.
 *   - Observe the existing window.app bridge without replacing page behavior.
 *   - Expose a small read-only API for a CDP injector or a test page.
 *
 * This is deliberately a WebView plugin, not a native hsaplugins DLL.  The
 * installed Box contains no public native plugin SDK/header that defines the
 * DLL ABI.  The script therefore uses the interface already present in the
 * page source:
 *   window.onUpdateArenaRecommend
 *   window.onUpdateLadderActionRecommend
 *   window.onUpdateWinrateData
 *   window.fReplaceCard(list, top, bottom, hand, remain, handAmount)
 *   window.app.sendMessage / window.app.setMessageCallback
 */
(function installHsArriverPlugin(global) {
  "use strict";

  if (global.__HSARRIVER_PLUGIN__) return;

  const CALLBACK_SPECS = {
    onUpdateArenaRecommend: { type: "recommendation.arena" },
    onUpdateLadderActionRecommend: { type: "recommendation.ladder" },
    onUpdateWinrateData: { type: "winrate.snapshot" },
    // This is the card-deck page's actual data boundary. The host supplies
    // the raw card ids, so no screenshot/OCR is involved.
    fReplaceCard: {
      type: "hand.snapshot",
      normalize: function normalizeHand(args) {
        return {
          deckTop: Array.isArray(args[1]) ? args[1] : [],
          hand: Array.isArray(args[3]) ? args[3] : [],
          deckBottom: Array.isArray(args[2]) ? args[2] : [],
          remaining: args[4] == null ? null : args[4],
          handAmount: args[5] == null
            ? (Array.isArray(args[3]) ? args[3].length : 0)
            : args[5],
        };
      },
    },
  };
  const CALLBACKS = Object.keys(CALLBACK_SPECS);
  const CHANNEL = "doQuery_hsbox";
  const MAX_EVENTS = 300;
  const READ_ONLY_METHODS = new Set([
    "get_current_battle_info",
    "get_all_collection_card",
    "get_all_collection_deck",
    "get_deck",
    "get_collection_manager_info",
  ]);
  const OUTPUT_TYPES = new Set([
    "recommendation.arena",
    "recommendation.ladder",
    "winrate.snapshot",
    "hand.snapshot",
  ]);
  const state = {
    version: "0.1.0",
    events: [],
    listeners: [],
    pending: new Map(),
    app: null,
    appBridgeReady: false,
    originalSendMessage: null,
    originalSetMessageCallback: null,
  };

  function now() {
    return new Date().toISOString();
  }

  function parsePayload(value) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  }

  function safeJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return String(value);
    }
  }

  function notify(event) {
    for (const listener of state.listeners.slice()) {
      try {
        listener(event);
      } catch (error) {
        console.warn("[HSArriverPlugin] listener failed", error);
      }
    }

    // Optional local collector. Failure is intentionally ignored so the page
    // continues to work when no collector is running.
    if (OUTPUT_TYPES.has(event.type) && typeof global.fetch === "function") {
      try {
        global.fetch("http://127.0.0.1:8765/event", {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }).catch(() => {});
      } catch (_) {}
    }
  }

  function record(type, data, extra) {
    const event = Object.assign({
      time: now(),
      type,
      data: safeJson(data),
    }, extra || {});

    state.events.push(event);
    while (state.events.length > MAX_EVENTS) state.events.shift();
    global.__HSARRIVER_LAST_EVENT__ = event;
    notify(event);
    console.log("[HSArriverPlugin]", type, event.data);
    return event;
  }

  function installCallbackObserver(name) {
    const marker = "__HSARRIVER_HOOK_" + name;
    if (global[marker]) return true;

    const spec = CALLBACK_SPECS[name];
    let original = typeof global[name] === "function" ? global[name] : null;
    const wrapper = function hsArriverCallbackWrapper() {
      const args = Array.prototype.slice.call(arguments);
      const data = typeof spec.normalize === "function"
        ? spec.normalize(args)
        : parsePayload(args[0]);
      record(spec.type, data, {
        callback: name,
      });
      if (typeof original === "function") {
        return original.apply(this, args);
      }
      return undefined;
    };

    try {
      Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        get: function getCallback() {
          return wrapper;
        },
        set: function setCallback(next) {
          original = typeof next === "function" ? next : null;
        },
      });
      global[marker] = true;
      return true;
    } catch (error) {
      console.warn("[HSArriverPlugin] callback hook failed", name, error);
      return false;
    }
  }

  function resolveBridgeMessage(args) {
    // The page source consumes the bridge callback as JSON.parse(args[1][0]).
    const raw = args && args.length > 1 && Array.isArray(args[1])
      ? args[1][0]
      : null;
    if (raw == null) return null;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return { raw: String(raw) };
    }
  }

  function handleBridgeResponse(args) {
    const message = resolveBridgeMessage(args);
    if (!message) return;

    record("bridge.response", message, { channel: CHANNEL });
    if (!message.callback) return;

    const pending = state.pending.get(message.callback);
    if (!pending) return;
    state.pending.delete(message.callback);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  function installAppObserver() {
    const app = global.app;
    if (!app || typeof app.sendMessage !== "function") return false;
    if (app.__HSARRIVER_WRAPPED__) return !!state.appBridgeReady;

    const originalSend = app.sendMessage;
    const originalSet = typeof app.setMessageCallback === "function"
      ? app.setMessageCallback
      : null;
    state.app = app;
    state.originalSendMessage = originalSend;
    state.originalSetMessageCallback = originalSet;

    try {
      app.sendMessage = function hsArriverSendMessage() {
        const args = Array.prototype.slice.call(arguments);
        const channel = args[0];
        const payload = args[1];
        record("bridge.request", {
          channel: channel,
          payload: parsePayload(Array.isArray(payload) ? payload[0] : payload),
        });
        return originalSend.apply(this, args);
      };
    } catch (error) {
      console.warn("[HSArriverPlugin] app.sendMessage is not writable", error);
      return false;
    }

    if (originalSet) {
      app.setMessageCallback = function hsArriverSetMessageCallback(channel, callback) {
        if (channel !== CHANNEL || typeof callback !== "function") {
          return originalSet.apply(this, arguments);
        }

        // Keep the page callback and the plugin observer in the same dispatcher.
        // This is the important non-invasive part: the original callback is
        // called first, with its original arguments and `this` value.
        const dispatcher = function hsArriverBridgeDispatcher() {
          const args = Array.prototype.slice.call(arguments);
          handleBridgeResponse(args);
          return callback.apply(this, args);
        };
        state.appBridgeReady = true;
        return originalSet.call(this, channel, dispatcher);
      };
    }

    Object.defineProperty(app, "__HSARRIVER_WRAPPED__", {
      configurable: false,
      enumerable: false,
      value: true,
    });
    return true;
  }

  function watchLateAppObject() {
    if (global.app || Object.prototype.hasOwnProperty.call(global, "__HSARRIVER_APP_WATCH__")) {
      return;
    }
    try {
      let appValue;
      Object.defineProperty(global, "app", {
        configurable: true,
        enumerable: true,
        get: function getApp() {
          return appValue;
        },
        set: function setApp(next) {
          appValue = next;
          installAppObserver();
        },
      });
      Object.defineProperty(global, "__HSARRIVER_APP_WATCH__", {
        configurable: false,
        enumerable: false,
        value: true,
      });
    } catch (error) {
      // Some hosts expose a non-configurable native `app` object. In that
      // case callback observation still remains available.
      console.warn("[HSArriverPlugin] cannot watch late window.app", error);
    }
  }

  function request(method, param, timeoutMs) {
    if (!READ_ONLY_METHODS.has(method)) {
      return Promise.reject(new Error("read-only plugin blocked method: " + method));
    }
    if (!state.app || typeof state.app.sendMessage !== "function") {
      return Promise.reject(new Error("window.app bridge is not available"));
    }
    if (!state.appBridgeReady) {
      return Promise.reject(new Error(
        "bridge callback is not ready; inject this plugin before the page initializes",
      ));
    }

    const callback = "hsarriver_" + Date.now() + "_" +
      Math.floor(Math.random() * 1000000);
    const message = { callback, method, param: param == null ? undefined : param };
    const waitMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : 8000;

    return new Promise(function(resolve, reject) {
      const timer = setTimeout(function() {
        state.pending.delete(callback);
        reject(new Error("bridge request timed out: " + method));
      }, waitMs);
      state.pending.set(callback, { resolve, reject, timer });
      state.app.sendMessage(CHANNEL, [JSON.stringify(message)]);
    });
  }

  function readEvents() {
    return state.events.slice();
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("listener must be a function");
    }
    state.listeners.push(listener);
    return function unsubscribe() {
      const index = state.listeners.indexOf(listener);
      if (index >= 0) state.listeners.splice(index, 1);
    };
  }

  CALLBACKS.forEach(installCallbackObserver);
  if (!installAppObserver()) watchLateAppObject();

  global.HSArriverPlugin = Object.freeze({
    version: state.version,
    readEvents,
    clear: function clear() {
      state.events.length = 0;
      delete global.__HSARRIVER_LAST_EVENT__;
    },
    subscribe,
    request,
    status: function status() {
      return {
        version: state.version,
        appBridge: !!state.app,
        appBridgeReady: state.appBridgeReady,
        callbacks: CALLBACKS.reduce(function(result, name) {
          result[name] = !!global["__HSARRIVER_HOOK_" + name];
          return result;
        }, {}),
        events: state.events.length,
      };
    },
  });
  global.__HSARRIVER_PLUGIN__ = true;
  global.__HSARRIVER_EVENTS__ = state.events;
  console.log("[HSArriverPlugin] installed", global.HSArriverPlugin.status());
})(window);
