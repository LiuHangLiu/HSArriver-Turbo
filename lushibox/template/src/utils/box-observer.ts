import { HsboxClient } from "@hsbox/api";

/**
 * Forward data already delivered by HSAng directly to the caller's receiver.
 * This is intentionally read-only: it does not request recommendations,
 * change game state, or call any UI/control method. It may use the existing
 * HSAng printLog bridge to append the captured record to the ordinary Box
 * application log; Power.log is never read.
 */
export function logBoxCallback(type: string, payload: unknown) {
    if (typeof window !== "undefined" && (window as any).__HSARRIVER_READONLY_CAPTURE__) {
        return;
    }
    const record = {
        source: "hsarriver-readonly",
        type,
        time: new Date().toISOString(),
        data: payload,
    };
    const line = JSON.stringify(record);
    console.log("[HSArriver readonly]", line);
    try {
        void HsboxClient.printLog(line).catch(() => undefined);
    }
    catch (_) {
        // The standalone page may not expose the host bridge.
    }
    try {
        const event = JSON.parse(line);
        const handler = (window as any).__HSARRIVER_EVENT_HANDLER__;
        if (typeof handler === "function") handler(event);
        window.dispatchEvent(new CustomEvent("hsarriver:event", { detail: event }));
        void fetch("http://127.0.0.1:8765/event", {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: line,
        }).catch(() => undefined);
    }
    catch (error) {
        console.warn("[HSArriver readonly] direct transport unavailable", error);
    }
}
