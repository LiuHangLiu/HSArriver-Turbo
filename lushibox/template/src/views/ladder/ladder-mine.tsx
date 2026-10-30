import React, { useEffect, useCallback, useState } from "react";
import Classnames from "classnames";
import "./index.scss";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import CardDeck from "../card-deck";
import CardMudi from "../card-mudi";
import { STORE } from "@/stores";
import { useSnapshot } from "valtio";
import { loadScript } from "@/utils";
import { HsboxClient } from "@hsbox/api";
export default function LadderMine() {
    const [targetTab, setTargetTab] = useState("ladderDeck");
    const { myDeviceId, myBtag, myUrs } = useSnapshot(STORE);
    const [isShowLadderDeck, setIsShowLadderDeck] = useState(true);
    const [isShowLadderMudi, setIsShowLadderMudi] = useState(true);
    const changeTab = useCallback((tab) => {
        setTargetTab(tab);
    }, [myBtag, myUrs, myDeviceId]);
    useEffect(() => {
        window.onShowChildModule = (module, flag) => {
            if (module === "ladderDeck") {
                setIsShowLadderDeck(flag);
            }
            if (module === "ladderMudi") {
                setIsShowLadderMudi(flag);
            }
        };
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.js", () => {
            if (!window.HSCARDS)
                return;
            window.HSCARDS["VIR_001"] = { Cost: "?", Rarity: 2, name_cn: "未知卡牌", name_en: "Unknown", Class: 0, CardID: "VIR_001", CardType: 4 };
            HsboxClient.JsLoaded().catch(console.log);
        });
    }, []);
    useEffect(() => {
        if (targetTab === "ladderDeck" && !isShowLadderDeck) {
            setTargetTab("ladderMudi");
        }
        if (targetTab === "ladderMudi" && !isShowLadderMudi) {
            setTargetTab("ladderDeck");
        }
    }, [targetTab, isShowLadderDeck, isShowLadderMudi]);
    return (React.createElement("div", { className: "ladder-view" },
        React.createElement(Wrapper, { className: "ladder-wrapper", width: 262 },
            React.createElement(Title, { text: "记牌器" }),
            React.createElement("nav", { className: "ladder-nav" },
                React.createElement("a", { className: Classnames("ladder-nav-item flex-ct-x", { active: targetTab === "ladderDeck", hidden: !isShowLadderDeck }), onClick: () => changeTab("ladderDeck") },
                    "\u724C\u5E93",
                    React.createElement("i", null)),
                React.createElement("a", { className: Classnames("ladder-nav-item flex-ct-x", { active: targetTab === "ladderMudi", hidden: !isShowLadderMudi }), onClick: () => changeTab("ladderMudi") },
                    "\u575F\u573A",
                    React.createElement("i", null))),
            React.createElement("div", { className: Classnames("ladder-content", targetTab !== "ladderDeck" ? "hidden" : "") },
                React.createElement(CardDeck, null)),
            React.createElement("div", { className: targetTab !== "ladderMudi" ? "hidden" : "" },
                React.createElement(CardMudi, { targetTab: 0 })))));
}
