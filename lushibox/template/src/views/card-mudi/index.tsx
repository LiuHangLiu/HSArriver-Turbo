import React, { useEffect, useCallback, useState, useMemo, createRef } from "react";
import Classnames from "classnames";
import "./index.scss";
import Card from "@/components/card";
import { EFFECT_CONFIG } from "@/utils";
export default function CardMudi({ targetTab = 0 }) {
    const [showMechanic, setShowMechanic] = useState(false);
    const [usedCard, setUsedCard] = useState([]);
    const [sort, setSort] = useState(0);
    const [onlyGroup, setOnlyGroup] = useState(true);
    const [selectedEffect, setSelectedEffect] = useState(null);
    const updateUsedCard = useCallback((mudilist) => {
        if (!window.HSCARDS)
            return;
        if (!window.HSCARDS["VIR_001"]) {
            window.HSCARDS["VIR_001"] = { Cost: "?", Rarity: 2, name_cn: "未知卡牌", name_en: "Unknown", Class: 0, CardID: "VIR_001", CardType: 4 };
        }
        if (mudilist) {
            const mudiTemp = [];
            mudilist.forEach((initItem) => {
                var _a, _b, _c, _d, _e, _f, _g;
                const item = initItem.includes(":") ? initItem.split(":")[0] : initItem;
                const isYsk = initItem.includes(":") ? (_a = initItem.split(":")) === null || _a === void 0 ? void 0 : _a[1] : false;
                const isQp = initItem.includes(":") ? (_b = initItem.split(":")) === null || _b === void 0 ? void 0 : _b[2] : false;
                const realId = item.includes(".") ? item.split(".")[0] : item;
                const OriginId = item.includes(".") && ((_c = item.split(".")) === null || _c === void 0 ? void 0 : _c.length) > 2 && item.split(".")[0] === "VIR_001" ? item.split(".")[2] : "";
                const OriginName = (_e = (_d = window.HSCARDS) === null || _d === void 0 ? void 0 : _d[OriginId]) === null || _e === void 0 ? void 0 : _e.name_cn;
                const SpecialCardID = item.includes(".") ? item : undefined;
                const nodeRef = createRef();
                mudiTemp.push(Object.assign(Object.assign({}, ((_g = (_f = window.HSCARDS) === null || _f === void 0 ? void 0 : _f[realId]) !== null && _g !== void 0 ? _g : {})), { num: 1, nodeRef, SpecialCardID, OriginName, ysk: +isYsk, qp: +isQp }));
            });
            setUsedCard(mudiTemp);
        }
    }, []);
    useEffect(() => {
        window.fUpdateUsedCard = updateUsedCard;
    }, [updateUsedCard]);
    const filteredByGroup = useMemo(() => {
        var _a;
        return (_a = usedCard === null || usedCard === void 0 ? void 0 : usedCard.filter((v) => onlyGroup ? !(v === null || v === void 0 ? void 0 : v.ysk) : v === null || v === void 0 ? void 0 : v.ysk)) !== null && _a !== void 0 ? _a : [];
    }, [usedCard, onlyGroup]);
    const visibleEffects = useMemo(() => {
        return Object.entries(EFFECT_CONFIG)
            .map(([key, v]) => ({
            key,
            enCN: v.enCN,
            enUS: v.enUS,
            n: filteredByGroup.filter((c) => c === null || c === void 0 ? void 0 : c[key]).length
        }))
            .filter(e => e.n > 0);
    }, [filteredByGroup]);
    const finalList = useMemo(() => {
        const arr = filteredByGroup.filter((c) => !selectedEffect || (c === null || c === void 0 ? void 0 : c[selectedEffect]));
        return arr.slice().sort((a, b) => sort ? (a.Cost - b.Cost) : 1);
    }, [filteredByGroup, selectedEffect, sort]);
    const mudiHeight = useMemo(() => {
        const N = visibleEffects.length;
        if (N === 0 || !showMechanic)
            return 0;
        const rows = Math.ceil(N / 3);
        return 38 * rows + 14;
    }, [visibleEffects, showMechanic]);
    console.log(usedCard);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: { height: `calc(100% - 140px)` } },
            React.createElement("div", { className: "mudi-p-text" },
                React.createElement("div", { style: { display: "flex" } },
                    "\u724C\u6570\uFF1A", usedCard === null || usedCard === void 0 ? void 0 :
                    usedCard.length,
                    React.createElement("span", { className: "mudi-only-switch", onClick: () => { setOnlyGroup(!onlyGroup); setSelectedEffect(null); } },
                        React.createElement("i", { className: "mudi-only-group" }),
                        React.createElement("span", null, onlyGroup ? "仅卡组卡" : "仅衍生卡"))),
                React.createElement("ul", null,
                    React.createElement("i", { className: "mudi-sort" }),
                    React.createElement("li", { className: sort === 0 ? "active" : "", onClick: () => setSort(0) }, "\u51FA\u724C"),
                    React.createElement("i", { className: "mudi-line" }),
                    React.createElement("li", { className: sort === 1 ? "active" : "", onClick: () => setSort(1) }, "\u6CD5\u529B"))),
            React.createElement("ul", { className: Classnames("mudi-mechanic", { active: showMechanic }), style: {
                    height: `${mudiHeight}px`,
                    paddingTop: mudiHeight ? 6 : 0,
                    paddingBottom: mudiHeight ? 6 : 0
                } }, visibleEffects.map(e => (React.createElement("li", { key: e.key, className: Classnames("mudi-mechanic-item", { active: selectedEffect === e.key }), onClick: () => setSelectedEffect(prev => prev === e.key ? null : e.key) }, e.enCN)))),
            visibleEffects.length > 0 && (React.createElement("div", { className: "mudi-extend-area", onClick: () => setShowMechanic(!showMechanic) },
                showMechanic ? "收起" : "展开查看类型筛选",
                React.createElement("i", { className: Classnames("mudi-arrow", { active: showMechanic }) }))),
            React.createElement("div", { className: "ladder-main-wrap", style: { height: `${600 - mudiHeight}px` } }, finalList.map((item, i) => {
                return React.createElement(Card, { info: item, key: i });
            })))));
}
