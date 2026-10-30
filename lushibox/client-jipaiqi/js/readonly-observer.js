/*
 * Read-only HSAng callback observer.
 *
 * This file does not use CDP, does not inspect the DOM, and does not invoke
 * game/UI actions. It wraps the callbacks that HSAng already uses to deliver
 * data to the page and forwards their payloads directly to the caller.
 * Every captured record is forwarded directly to the caller's event sink and,
 * when the HSAng bridge is present, to the Box's ordinary application log via
 * its existing read-only print_log facility. Power.log is never read.
 */
(function () {
    "use strict";

    if (window.__HSARRIVER_READONLY_CAPTURE__) return;
    window.__HSARRIVER_READONLY_CAPTURE__ = true;

    var localCollector = "http://127.0.0.1:8765/event";
    var boxBridgeChannel = "doQuery_hsbox";
    var callbacks = {
        onUpdateArenaRecommend: "arena.recommend",
        onUpdateLadderActionRecommend: "ladder.recommend",
        onUpdateWinrateData: "winrate.predict",
        fReplaceCard: "tracker.cards",
        // Legacy JiPai_warflag page used by the currently installed HSAng.
        fShowActionRecommend: "standard.recommend",
        fShowBattlePredict: "standard.winrate",
        fAddCard: "tracker.add_card",
        fDelCard: "tracker.del_card",
        fDelAllCard: "tracker.del_all_cards",
        fKnownCard: "tracker.known_card",
        fWasterCard: "tracker.waste_card",
        fShowMyCardNum: "tracker.my_card_count",
        fShowOtherCardNum: "tracker.other_card_count",
        fShowRoundTimer: "tracker.round_timer",
    };

    function decode(payload) {
        if (typeof payload !== "string") return payload;
        try { return JSON.parse(payload); } catch (_) { return payload; }
    }

    function emit(type, payload) {
        var line;
        var value = arguments.length > 2
            ? Array.prototype.slice.call(arguments, 1)
            : payload;
        try {
            line = JSON.stringify({
                source: "hsarriver-readonly",
                type: type,
                time: new Date().toISOString(),
                data: decode(value),
            });
            console.log("[HSArriver readonly]", line);
        } catch (_) {
            return;
        }

        // Keep a second, local-to-the-Box observation path. This only asks
        // the existing host bridge to append text to its application log; it
        // does not request game data, alter UI state, or invoke a game action.
        // The standalone reader deliberately ignores Power.log.
        try {
            var app = window.app;
            if (app && typeof app.sendMessage === "function") {
                app.sendMessage(boxBridgeChannel, [JSON.stringify({
                    callback: "hsarriver_log_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
                    method: "print_log",
                    param: line,
                })]);
            }
        } catch (_) {}

        // Direct, read-only transport. The receiver is your own process; no
        // game action or UI action is involved.
        try {
            var event = JSON.parse(line);
            if (typeof window.__HSARRIVER_EVENT_HANDLER__ === "function") {
                window.__HSARRIVER_EVENT_HANDLER__(event);
            }
            if (typeof window.CustomEvent === "function" &&
                typeof window.dispatchEvent === "function") {
                window.dispatchEvent(new CustomEvent("hsarriver:event", {
                    detail: event,
                }));
            }
            if (typeof window.postMessage === "function") {
                window.postMessage(event, "*");
            }
            if (typeof window.fetch === "function") {
                window.fetch(localCollector, {
                    method: "POST",
                    mode: "cors",
                    cache: "no-store",
                    headers: { "Content-Type": "application/json" },
                    body: line,
                }).catch(function () {});
            }
        } catch (_) {}
    }

    function wrapCallback(name, handler) {
        if (typeof handler !== "function") return handler;
        if (handler.__HSARRIVER_READONLY_WRAPPED__) return handler;
        var wrapped = function () {
            emit.apply(null, [callbacks[name]].concat(Array.prototype.slice.call(arguments)));
            return handler.apply(this, arguments);
        };
        try {
            Object.defineProperty(wrapped, "__HSARRIVER_READONLY_WRAPPED__", {
                value: true,
                configurable: false,
            });
        } catch (_) {}
        return wrapped;
    }

    function isPredictUrl(url) {
        return /\/hs\/predict\//i.test(String(url || "")) ||
            /rec\.winrate/i.test(String(url || ""));
    }

    function installFetchObserver() {
        if (typeof window.fetch !== "function" || window.fetch.__HSARRIVER_READONLY_WRAPPED__) {
            return;
        }
        var original = window.fetch;
        var wrapped = function (input) {
            var url = typeof input === "string" ? input : input && input.url;
            var response = original.apply(this, arguments);
            return response.then(function (res) {
                if (isPredictUrl(url) && res && typeof res.clone === "function") {
                    res.clone().text().then(function (text) {
                        emit("network.predict", {
                            url: String(url),
                            status: res.status,
                            data: decode(text),
                        });
                    }).catch(function () {});
                }
                return res;
            });
        };
        try {
            Object.defineProperty(wrapped, "__HSARRIVER_READONLY_WRAPPED__", {
                value: true,
                configurable: false,
            });
        } catch (_) {}
        window.fetch = wrapped;
    }

    function installXhrObserver() {
        if (!window.XMLHttpRequest ||
            window.XMLHttpRequest.prototype.__HSARRIVER_READONLY_WRAPPED__) return;
        var proto = window.XMLHttpRequest.prototype;
        var open = proto.open;
        var send = proto.send;
        proto.open = function (method, url) {
            this.__HSARRIVER_READONLY_URL__ = String(url || "");
            return open.apply(this, arguments);
        };
        proto.send = function () {
            var xhr = this;
            if (isPredictUrl(xhr.__HSARRIVER_READONLY_URL__)) {
                xhr.addEventListener("load", function () {
                    try {
                        emit("network.predict", {
                            url: xhr.__HSARRIVER_READONLY_URL__,
                            status: xhr.status,
                            data: decode(xhr.responseText),
                        });
                    } catch (_) {}
                });
            }
            return send.apply(this, arguments);
        };
        try {
            Object.defineProperty(proto, "__HSARRIVER_READONLY_WRAPPED__", {
                value: true,
                configurable: false,
            });
        } catch (_) {}
    }

    Object.keys(callbacks).forEach(function (name) {
        var current;
        try { current = window[name]; } catch (_) { current = undefined; }
        current = wrapCallback(name, current);
        Object.defineProperty(window, name, {
            configurable: true,
            enumerable: true,
            get: function () { return current; },
            set: function (handler) {
                current = wrapCallback(name, handler);
            },
        });
    });
    installFetchObserver();
    installXhrObserver();

    // This marker proves that this exact page loaded the observer. It is
    // intentionally emitted before any game/recommendation callback exists.
    emit("observer.boot", {
        href: String(window.location && window.location.href || ""),
        readyState: String(document.readyState || ""),
    });
})();
