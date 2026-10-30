var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { HsboxClient } from "@hsbox/api";
import "./assets/css/reset.css";
import "./index.scss";
import { SetStore } from "./stores";
import Home from "./views/home";
import LadderMine from "./views/ladder/ladder-mine";
import LadderOpp from "./views/ladder/ladder-opp";
import LadderOb from "./views/ladder/ladder-ob";
import Analysis from "./views/analysis";
import Environment from "./views/environment";
import ArenaHeros from "./views/arena-heros";
import Record from "./views/record";
import Collect from "./views/collect";
import Arena from "./views/arena";
import Fold from "./views/fold";
import Cardpack from "./views/cardpack";
import PackResult from "./views/pack-result";
import VideoCemetery from "./views/cemetery/video-cemetery";
import Ceframe from "./views/ceframe";
import AiRecommend from "./views/ai-recommend";
import WinratePredict from "./views/winrate-predict";
import * as Sentry from "@sentry/react";
import { loadJSON } from "@/utils";
Sentry.init({
    dsn: "https://cd4cb4155c2d13d224a726fe14e0875a@sentry.aj.netease.com/6",
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
function Router() {
    const navigate = useNavigate();
    const onBackPannel = useCallback(() => navigate(-1), [navigate]);
    const onLoad = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        loadJSON(RUN_ENV === "prod"
            ? "https://lushi-app.gameyw.netease.com/json/configConstant.json"
            : "//lushi-test.gameyw.netease.com/configConstant.json").then((res) => {
            SetStore("copyDeckTip", res === null || res === void 0 ? void 0 : res.CopyDeckTip);
        });
        const btag = yield HsboxClient.getBtag();
        const urs = yield HsboxClient.getUrs();
        const deviceid = yield HsboxClient.getDeviceId();
        const { category } = yield HsboxClient.getVersion();
        const sid = yield HsboxClient.getSid();
        SetStore("myBtag", btag);
        SetStore("myUrs", urs);
        SetStore("myDeviceId", deviceid);
        SetStore("dataSource", category !== null && category !== void 0 ? category : "hsang");
        SetStore("mySid", sid);
    }), []);
    useEffect(() => {
        const extraWidth = 220;
        HsboxClient.initExpandPanel(extraWidth, 0);
        SetStore("extraWidth", extraWidth);
        window.setExpandPanelWebviewInfo = (isEnabled, isLeftAreaEnabled, isTopAreaEnabled, isRightAreaEnabled, isBottomAreaEnabled, horizontalDirection, verticalDirection) => {
            SetStore("expandPanelEnabled", isEnabled);
            SetStore("isLeftAreaEnabled", isLeftAreaEnabled);
            SetStore("isTopAreaEnabled", isTopAreaEnabled);
            SetStore("isRightAreaEnabled", isRightAreaEnabled);
            SetStore("isBottomAreaEnabled", isBottomAreaEnabled);
            SetStore("horizontal", horizontalDirection);
            SetStore("vertical", verticalDirection);
        };
        onLoad();
    }, []);
    useEffect(() => {
        window.onBackPannel = onBackPannel;
    }, [
        onBackPannel
    ]);
    useEffect(() => {
        window.fSetCheckOppEnable = (val) => {
            SetStore("checkOppEnable", val);
        };
    }, []);
    return (React.createElement(Routes, null,
        React.createElement(Route, { element: React.createElement(Home, null), path: "/" }),
        React.createElement(Route, { element: React.createElement(Home, null), path: "/home" }),
        React.createElement(Route, { element: React.createElement(LadderMine, null), path: "/ladder" }),
        React.createElement(Route, { element: React.createElement(LadderOpp, null), path: "/ladder-opp" }),
        React.createElement(Route, { element: React.createElement(LadderOb, null), path: "/ladder-ob" }),
        React.createElement(Route, { element: React.createElement(VideoCemetery, null), path: "/video-cemetery" }),
        React.createElement(Route, { element: React.createElement(Analysis, null), path: "/analysis" }),
        React.createElement(Route, { element: React.createElement(Environment, null), path: "/environment" }),
        React.createElement(Route, { element: React.createElement(ArenaHeros, null), path: "/arena-heros" }),
        React.createElement(Route, { element: React.createElement(Record, null), path: "/record" }),
        React.createElement(Route, { element: React.createElement(Collect, null), path: "/collect" }),
        React.createElement(Route, { element: React.createElement(Arena, null), path: "/arena" }),
        React.createElement(Route, { element: React.createElement(Fold, null), path: "/fold" }),
        React.createElement(Route, { element: React.createElement(Cardpack, null), path: "/cardpack" }),
        React.createElement(Route, { element: React.createElement(PackResult, null), path: "/pack-result" }),
        React.createElement(Route, { element: React.createElement(Ceframe, null), path: "/ceframe" }),
        React.createElement(Route, { element: React.createElement(AiRecommend, null), path: "/ai-recommend" }),
        React.createElement(Route, { element: React.createElement(WinratePredict, null), path: "/winrate-predict" })));
}
const ROUTER_BASENAME = RUN_ENV === "dev" ? "" : "/client-jipaiqi";
function App() {
    return (React.createElement("div", { className: "main-page center" },
        React.createElement(BrowserRouter, { basename: ROUTER_BASENAME },
            React.createElement(Router, null))));
}
function loadFont(id, name) {
    return __awaiter(this, void 0, void 0, function* () {
        const fontStr = yield HsboxClient.GetResource(id);
        const decodedString = safeAtob(fontStr);
        if (!decodedString)
            return;
        const bytes = new Uint8Array(decodedString.length);
        for (var i = 0; i < (decodedString === null || decodedString === void 0 ? void 0 : decodedString.length); i++) {
            bytes[i] = decodedString === null || decodedString === void 0 ? void 0 : decodedString.charCodeAt(i);
        }
        const font = new FontFace(name, bytes.buffer);
        font.load().then(() => {
            document.fonts.add(font);
            console.log(name + "字体加载成功");
        }).catch(() => console.error("字体加载失败"));
    });
}
;
function safeAtob(str) {
    try {
        return atob(str);
    }
    catch (e) {
        console.error('Base64 解码失败:', e);
        return null;
    }
}
console.log("应用构建环境：", process.env.NODE_ENV);
console.log("应用运行环境：", RUN_ENV);
HsboxClient.ready();
loadFont("/font/HarmonyOS_Sans_SC_Medium.ttf", "Hs_Medium");
loadFont("/font/HarmonyOS_Sans_SC_Bold.ttf", "Hs_Bold");
const container = document.getElementById("root");
!!container && createRoot(container).render(React.createElement(App, null));
