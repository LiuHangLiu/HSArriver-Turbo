import React, { useEffect, useState, useMemo } from "react";
import Classnames from "classnames";
import Card from "@/components/card";
import { HsboxClient } from "@hsbox/api";
import { loadScript } from "@/utils";
import "./index.scss";
export default function PackResult() {
    const [cardList, setCardList] = useState([]);
    const [showType, setShowType] = useState("list");
    const closeWin = () => {
        HsboxClient.closeInsideBrowser();
    };
    useEffect(() => {
        HsboxClient.resizeInsideBrowser(526, 500);
        loadScript("https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.min.js", () => {
            var _a;
            let allCard = JSON.parse((_a = localStorage.getItem("openPackageList")) !== null && _a !== void 0 ? _a : "[]") || [];
            allCard = allCard.sort((a, b) => {
                return window.HSCARDS[a.id].Rarity === window.HSCARDS[b.id].Rarity
                    ? (+window.HSCARDS[a.id].Cost) - (+window.HSCARDS[b.id].Cost)
                    : (+window.HSCARDS[b.id].Rarity) - (+window.HSCARDS[a.id].Rarity);
            });
            setCardList(allCard);
        });
    }, []);
    const listDom = useMemo(() => {
        return showType === "list"
            ? cardList.map((item, i) => {
                const info = window.HSCARDS[item.id];
                info.num = item.num;
                console.log(info);
                return (React.createElement(Card, { key: i, info: info }));
            })
            : cardList.map((item, i) => {
                return (React.createElement("div", { className: "big-card", style: { backgroundImage: `url(https://hs2.166.net/hs-card-img/card/${item.id}.png` }, key: i },
                    React.createElement("span", null,
                        "x",
                        item.num)));
            });
    }, [cardList, showType]);
    return (React.createElement("div", { className: "open-package-result" },
        React.createElement("div", { className: "top-bar" },
            "\u5F00\u5305\u7ED3\u679C",
            React.createElement("div", { className: "filter" },
                React.createElement("span", { className: Classnames("list", { active: showType === "list" }), onClick: () => setShowType("list") }),
                React.createElement("span", { className: Classnames("detail", { active: showType === "detail" }), onClick: () => setShowType("detail") })),
            React.createElement("div", { className: "close-btn", onClick: closeWin })),
        React.createElement("div", { className: Classnames("content", { large: showType === "detail" }) }, listDom)));
}
