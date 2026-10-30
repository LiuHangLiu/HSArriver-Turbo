import React, { useState, useEffect, useMemo } from "react";
import Wrapper from "@/components/wrapper";
import ActionGroup from "@/components/action-group";
import { loadScript } from "@/utils";
import { logBoxCallback } from "@/utils/box-observer";
export default function AiRecommend() {
    const [recommendActions, setRecommendActions] = useState({ error: "", status: 2, data: [] });
    const [hsReady, setHsReady] = useState(false);
    const onUpdateArenaRecommend = (data) => {
        console.log("展示推送的推荐信息", data);
        const parsed = JSON.parse(data);
        logBoxCallback("arena.recommend", parsed);
        setRecommendActions(parsed);
    };
    const actionsDom = useMemo(() => {
        var _a;
        return ((_a = recommendActions.data) === null || _a === void 0 ? void 0 : _a.length) ? recommendActions.data.map((a, i) => {
            return React.createElement(ActionGroup, { key: i, actionName: a.actionName, card: a.card, index: i, target: a.target, oppTarget: a.oppTarget, targetHero: a.targetHero, oppTargetHero: a.oppTargetHero, subOption: a.subOption, position: a.position, using_disguised: a.using_disguised });
        }) : null;
    }, [recommendActions, hsReady]);
    useEffect(() => {
        window.onUpdateArenaRecommend = onUpdateArenaRecommend;
    }, [onUpdateArenaRecommend]);
    useEffect(() => {
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.min.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.min.js", () => {
            window.HSCARDS["VIR_001"] = { Cost: "?", Rarity: 2, name_cn: "未知卡牌", name_en: "Unknown", Class: 0, CardID: "VIR_001", CardType: 4 };
            setHsReady(true);
        });
    }, []);
    return (React.createElement("div", { className: "ladder-view" },
        React.createElement(Wrapper, { className: "ladder-wrapper", width: 262 },
            React.createElement("ul", { className: "cemetery-mode" },
                React.createElement("li", { className: "active" },
                    React.createElement("span", null, "\u63A8\u8350\u6253\u6CD5"),
                    React.createElement("span", { className: "beta" }),
                    React.createElement("div", { className: "beta-tips" }, "Box\u541B\u8FD8\u5728\u6536\u96C6\u6570\u636E\u63D0\u9AD8\u51C6\u786E\u6027\uFF0C\u6253\u6CD5\u4EC5\u4F9B\u53C2\u8003\u54E6~"))),
            React.createElement("div", { className: "recommend-playstyle-wrapper", style: { height: "704px" } },
                recommendActions.status !== 2
                    ? React.createElement("p", { style: { padding: "10px 10px 0" } }, recommendActions.error)
                    : null,
                actionsDom))));
}
