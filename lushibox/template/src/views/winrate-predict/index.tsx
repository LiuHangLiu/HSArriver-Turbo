import React, { useEffect, useRef, useState } from "react";
import { HsboxClient } from "@hsbox/api";
import { logBoxCallback } from "@/utils/box-observer";
import "./index.scss";
const EMPTY_DATA = {
    myWinRate: 0,
    myPlayer: { name: "", job: "" },
    oppPlayer: { name: "", job: "" },
    turns: [],
};
const COL_WIDTH = 80;
const PADDING = { top: 24, right: 4, bottom: 8, left: 20 };
const Y_LABELS = [0, 25, 50, 75, 100];
function getYLabelTop(pct) {
    return 10 + PADDING.top + (1 - pct / 100) * (222 - PADDING.top - PADDING.bottom);
}
function drawChart(canvas, turns) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx || !turns.length)
        return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const plotLeft = PADDING.left;
    const plotRight = w - PADDING.right;
    const plotTop = PADDING.top;
    const plotBottom = h - PADDING.bottom;
    const plotH = plotBottom - plotTop;
    Y_LABELS.forEach((pct) => {
        const y = plotBottom - (pct / 100) * plotH;
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotLeft, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
    });
    if (turns.length < 2)
        return;
    const points = turns.map((t, i) => ({
        x: PADDING.left + i * COL_WIDTH + COL_WIDTH / 2,
        y: plotBottom - (t.winRate / 100) * plotH,
        rate: t.winRate,
    }));
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.textAlign = "center";
    points.forEach((p) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 12px 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
        ctx.fillText(p.rate + "%", p.x, p.y - 9);
    });
}
export default function WinratePredict() {
    const [data, setData] = useState(EMPTY_DATA);
    const chartRef = useRef(null);
    const scrollRef = useRef(null);
    useEffect(() => {
        window.onUpdateWinrateData = (jsonStr) => {
            try {
                const parsed = JSON.parse(jsonStr);
                logBoxCallback("winrate.predict", parsed);
                setData(parsed);
            }
            catch (e) {
                console.error("[WinratePredict] onUpdateWinrateData parse error:", e);
            }
        };
    }, []);
    useEffect(() => {
        var _a;
        const canvas = chartRef.current;
        if (!canvas)
            return;
        const canvasW = COL_WIDTH * data.turns.length + PADDING.left + PADDING.right;
        canvas.style.width = canvasW + "px";
        canvas.style.height = "222px";
        drawChart(canvas, data.turns);
        (_a = scrollRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" });
    }, [data]);
    const winRateStr = data.myWinRate.toFixed(2) + "%";
    return (React.createElement("div", { className: "winrate-predict-view" },
        React.createElement("div", { className: "popup-overlay" },
            React.createElement("div", { className: "popup-header" },
                React.createElement("span", { className: "title-label" }, "AI\u9884\u4F30\u80DC\u7387"),
                React.createElement("span", { className: "winrate-value" }, winRateStr),
                React.createElement("button", { className: "close-btn", "aria-label": "\u5173\u95ED", onClick: () => HsboxClient.closeWinratePredictWindow() },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", width: "16", height: "16", viewBox: "0 0 16 16" },
                        React.createElement("g", { style: { opacity: 0.6 } },
                            React.createElement("path", { d: "M2 2L14 14M14 2L2 14", stroke: "white", strokeWidth: "2", strokeLinecap: "round" }))))),
            React.createElement("div", { className: "popup-subtitle" },
                React.createElement("div", { className: "player-info" },
                    React.createElement("div", { className: `player-avatar layer-avatar hero hero-${data.myPlayer.job}` }),
                    React.createElement("span", { className: "player-name" }, data.myPlayer.name)),
                React.createElement("span", { className: "vs-text" }, "VS"),
                React.createElement("div", { className: "player-info" },
                    React.createElement("div", { className: `player-avatar layer-avatar hero hero-${data.oppPlayer.job}` }),
                    React.createElement("span", { className: "player-name" }, data.oppPlayer.name))),
            React.createElement("div", { className: "divider" }),
            React.createElement("div", { className: "chart-row" },
                React.createElement("div", { className: "chart-timeline-scroll", ref: scrollRef },
                    React.createElement("div", { className: "chart-timeline-inner" },
                        React.createElement("div", { className: "chart-area" },
                            React.createElement("div", { className: "chart-canvas-wrap" },
                                React.createElement("canvas", { ref: chartRef }))),
                        React.createElement("div", { className: "timeline-area" },
                            React.createElement("div", { className: "timeline-x-axis" }, data.turns.map((t) => (React.createElement("div", { key: t.turnId, className: "timeline-tick" },
                                React.createElement("div", { className: "round-label" },
                                    "\u7B2C",
                                    t.turnId,
                                    "\u56DE\u5408"),
                                React.createElement("div", { className: "time-label" }, t.timestamp))))),
                            React.createElement("div", { className: "events-row" }, data.turns.map((t) => {
                                var _a, _b;
                                return (React.createElement("div", { key: t.turnId, className: "event-slot" }, t.event ? (React.createElement("div", { className: "event-item" },
                                    ((_a = t.event) === null || _a === void 0 ? void 0 : _a.keyCardId)
                                        ? React.createElement("div", { className: "event-icon" },
                                            React.createElement("img", { src: `https://hs2.166.net/hs-card-img/card32x/${(_b = t.event) === null || _b === void 0 ? void 0 : _b.keyCardId}.png` }))
                                        : null,
                                    React.createElement("span", { className: "event-name" }, t.event.type),
                                    React.createElement("span", { className: "event-rate" },
                                        React.createElement("span", { className: "rate-label" }, "\u80DC\u7387"),
                                        t.event.winRateChange >= 0
                                            ? React.createElement("span", { className: "rate-up" },
                                                "\u2191",
                                                Math.abs(t.event.winRateChange).toFixed(2),
                                                "%")
                                            : React.createElement("span", { className: "rate-down" },
                                                "\u2193",
                                                Math.abs(t.event.winRateChange).toFixed(2),
                                                "%")))) : null));
                            }))))),
                React.createElement("div", { className: "y-axis-panel" }, Y_LABELS.map((pct) => (React.createElement("span", { key: pct, className: "y-label", style: { top: getYLabelTop(pct) + "px" } },
                    pct,
                    "%"))))))));
}
