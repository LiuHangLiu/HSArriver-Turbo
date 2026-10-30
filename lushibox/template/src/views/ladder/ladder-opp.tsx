import React, { useEffect, useCallback, useState, useMemo } from "react";
import Classnames from "classnames";
import "./index.scss";
import Wrapper from "@/components/wrapper";
import CardDeck from "../card-deck";
import CardMudi from "../card-mudi";
import OppList from "./opp-list";
import Recommend from "./recommend";
import { STORE, SetStore } from "@/stores";
import { useSnapshot } from "valtio";
import { loadScript } from "@/utils";
import { HsboxClient } from "@hsbox/api";
export default function LadderOpp() {
    const { isShowLadderCemetery, isShowLadderRecommend, myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const [mode, setMode] = useState("mudi");
    const tabs = useMemo(() => [
        {
            key: "mudi",
            show: isShowLadderCemetery,
            title: "对手记牌器",
            view: React.createElement(OppDetail, null)
        },
        {
            key: "recommend",
            show: isShowLadderRecommend,
            title: (React.createElement(React.Fragment, null,
                React.createElement("span", null, "\u63A8\u8350\u6253\u6CD5"),
                React.createElement("span", { className: "beta" }),
                React.createElement("div", { className: "beta-tips" }, "Box\u541B\u8FD8\u5728\u6536\u96C6\u6570\u636E\u63D0\u9AD8\u51C6\u786E\u6027\uFF0C\u6253\u6CD5\u4EC5\u4F9B\u53C2\u8003\u54E6~"))),
            view: React.createElement(Recommend, null)
        }
    ], [isShowLadderCemetery, isShowLadderRecommend]);
    useEffect(() => {
        window.onShowModule = (module, flag) => {
            if (module === "ladderRecommend")
                SetStore("isShowLadderRecommend", flag);
            if (module === "ladderCemetery")
                SetStore("isShowLadderCemetery", flag);
        };
        window.onSwitchModule = (module) => {
            if (module === "ladderRecommend")
                setMode("recommend");
            if (module === "ladderCemetery")
                setMode("mudi");
        };
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.js", () => {
            if (!window.HSCARDS)
                return;
            window.HSCARDS["VIR_001"] = { Cost: "?", Rarity: 2, name_cn: "未知卡牌", name_en: "Unknown", Class: 0, CardID: "VIR_001", CardType: 4 };
            HsboxClient.JsLoaded().catch(console.log);
        });
    }, []);
    useEffect(() => {
        if (isShowLadderCemetery && !isShowLadderRecommend) {
            setMode("mudi");
        }
        else if (!isShowLadderCemetery && isShowLadderRecommend) {
            setMode("recommend");
        }
    }, [isShowLadderCemetery, isShowLadderRecommend]);
    return (React.createElement("div", { className: "ladder-view" },
        React.createElement(Wrapper, { className: "ladder-wrapper", width: 262 },
            React.createElement("ul", { className: "cemetery-mode" }, tabs.map((v, i) => {
                return (React.createElement("li", { key: i, className: Classnames({ active: mode === v.key, hidden: !v.show }), onClick: () => { setMode(v.key); } }, v.title));
            })),
            tabs.map((v, i) => {
                return (React.createElement("div", { key: i, className: Classnames({ hidden: mode !== v.key }), style: { height: "100%" } }, v.view));
            }))));
}
function OppDetail() {
    const [targetTab, setTargetTab] = useState("ladderDeck");
    const [showOpp, setShowOpp] = useState(false);
    const [isShowLadderDeck, setIsShowLadderDeck] = useState(true);
    const [isShowLadderMudi, setIsShowLadderMudi] = useState(true);
    const [isShowLadderPredict, setIsShowLadderPredict] = useState(true);
    const changeTab = useCallback((tab) => {
        setTargetTab(tab);
    }, []);
    useEffect(() => {
        window.onShowChildModule = (module, flag) => {
            if (module === "ladderDeck") {
                setIsShowLadderDeck(flag);
            }
            if (module === "ladderMudi") {
                setIsShowLadderMudi(flag);
            }
            if (module === "ladderPredict") {
                setIsShowLadderPredict(flag);
            }
        };
    }, []);
    useEffect(() => {
        if (targetTab === "ladderDeck" && !isShowLadderDeck) {
            if (isShowLadderMudi) {
                setTargetTab("ladderMudi");
            }
            else if (isShowLadderPredict) {
                setTargetTab("ladderPredict");
            }
        }
        if (targetTab === "ladderMudi" && !isShowLadderMudi) {
            if (isShowLadderDeck) {
                setTargetTab("ladderDeck");
            }
            else if (isShowLadderPredict) {
                setTargetTab("ladderPredict");
            }
        }
        if (targetTab === "ladderPredict" && !isShowLadderPredict) {
            if (isShowLadderDeck) {
                setTargetTab("ladderDeck");
            }
            else if (isShowLadderMudi) {
                setTargetTab("ladderMudi");
            }
        }
    }, [targetTab, isShowLadderDeck, isShowLadderPredict, isShowLadderMudi]);
    return (React.createElement(React.Fragment, null,
        React.createElement("nav", { className: "ladder-nav" },
            React.createElement("a", { className: Classnames("ladder-nav-item flex-ct-x", { active: targetTab === "ladderDeck", hidden: !isShowLadderDeck }), onClick: () => changeTab("ladderDeck") },
                "\u724C\u5E93",
                React.createElement("i", null)),
            React.createElement("a", { className: Classnames("ladder-nav-item flex-ct-x", { active: targetTab === "ladderMudi", hidden: !isShowLadderMudi }), onClick: () => changeTab("ladderMudi") },
                "\u575F\u573A",
                React.createElement("i", null)),
            React.createElement("a", { className: Classnames("ladder-nav-item flex-ct-x", { active: targetTab === "ladderPredict", hidden: !isShowLadderPredict }), onClick: () => { changeTab("ladderPredict"); setShowOpp(true); } },
                "\u5BF9\u624B",
                React.createElement("i", null))),
        React.createElement("div", { className: Classnames("ladder-content", targetTab !== "ladderDeck" ? "hidden" : "") },
            React.createElement(CardDeck, null)),
        React.createElement("div", { className: targetTab !== "ladderMudi" ? "hidden" : "" },
            React.createElement(CardMudi, { targetTab: 1 })),
        React.createElement("div", { className: targetTab !== "ladderPredict" ? "hidden" : "" }, showOpp ? React.createElement(OppList, null) : null)));
}
