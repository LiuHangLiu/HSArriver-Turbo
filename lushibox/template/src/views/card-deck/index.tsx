import React, { useEffect, useCallback, useState, Fragment, createRef, useRef } from "react";
import Classnames from "classnames";
import Card from "@/components/card";
import { analysisCg, loadJSON } from "@/utils";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { STORE, SetStore } from "@/stores";
import { useSnapshot } from "valtio";
import { logBoxCallback } from "@/utils/box-observer";
export default function CardDeck() {
    const remember = useRef({});
    const [cgdata, setCgdata] = useState();
    const [cgSum, setCgSum] = useState();
    const rememberHand = useRef({});
    const [cgHandData, setCgHandData] = useState([]);
    const [cgHandSum, setCgHandSum] = useState();
    const [cgTopData, setCgTopData] = useState([]);
    const [cgTopSum, setCgTopSum] = useState();
    const [cgBottomData, setCgBottomData] = useState([]);
    const [cgBottomSum, setCgBottomSum] = useState();
    const [highLightConfig, setHighLightConfig] = useState();
    const [highLightList, setHighLightList] = useState([]);
    const [remainCardExpand, setRemainCardExpand] = useState(true);
    const [handCardExpand, setHandCardExpand] = useState(true);
    const [topCardExpand, setTopCardExpand] = useState(true);
    const [bottomCardExpand, setBottomCardExpand] = useState(true);
    const [highLightSwitch, setHighLightSwitch] = useState(true);
    const { myDeviceId, myBtag, myUrs } = useSnapshot(STORE);
    const replaceCard = useCallback((list, top, bottom, hand, remain, handAmount) => {
        var _a, _b, _c;
        console.log("replaceCard:", list, top, bottom);
        logBoxCallback("tracker.cards", { list, top, bottom, hand, remain, handAmount });
        if (!window.HSCARDS)
            return;
        if (!window.HSCARDS["VIR_001"]) {
            window.HSCARDS["VIR_001"] = { Cost: "?", Rarity: 2, name_cn: "未知卡牌", name_en: "Unknown", Class: 0, CardID: "VIR_001", CardType: 4 };
        }
        if (top) {
            const topTemp = [];
            top.forEach((item) => {
                var _a, _b, _c, _d, _e;
                const realId = item.includes(".") ? item.split(".")[0] : item;
                const OriginId = item.includes(".") && ((_a = item.split(".")) === null || _a === void 0 ? void 0 : _a.length) > 2 && item.split(".")[0] === "VIR_001" ? item.split(".")[2] : "";
                const OriginName = (_c = (_b = window.HSCARDS) === null || _b === void 0 ? void 0 : _b[OriginId]) === null || _c === void 0 ? void 0 : _c.name_cn;
                const SpecialCardID = item.includes(".") ? item : undefined;
                const nodeRef = createRef();
                topTemp.push(Object.assign(Object.assign({}, ((_e = (_d = window.HSCARDS) === null || _d === void 0 ? void 0 : _d[realId]) !== null && _e !== void 0 ? _e : {})), { num: 1, nodeRef, SpecialCardID, OriginName }));
            });
            setCgTopSum(top.length);
            setCgTopData(topTemp);
        }
        if (bottom) {
            const bottomTemp = [];
            bottom.forEach((item) => {
                var _a, _b, _c, _d, _e;
                const realId = item.includes(".") ? item.split(".")[0] : item;
                const OriginId = item.includes(".") && ((_a = item.split(".")) === null || _a === void 0 ? void 0 : _a.length) > 2 && item.split(".")[0] === "VIR_001" ? item.split(".")[2] : "";
                const OriginName = (_c = (_b = window.HSCARDS) === null || _b === void 0 ? void 0 : _b[OriginId]) === null || _c === void 0 ? void 0 : _c.name_cn;
                const SpecialCardID = item.includes(".") ? item : undefined;
                const nodeRef = createRef();
                bottomTemp.push(Object.assign(Object.assign({}, ((_e = (_d = window.HSCARDS) === null || _d === void 0 ? void 0 : _d[realId]) !== null && _e !== void 0 ? _e : {})), { num: 1, nodeRef, SpecialCardID, OriginName }));
            });
            setCgBottomSum(bottom.length);
            setCgBottomData(bottomTemp);
        }
        if (hand) {
            const handTemp = [];
            hand.forEach((item) => {
                var _a, _b, _c, _d, _e, _f;
                const realId = item.includes(".") ? item.split(".")[0] : item;
                const OriginId = item.includes(".") && ((_a = item.split(".")) === null || _a === void 0 ? void 0 : _a.length) > 2 && item.split(".")[0] === "VIR_001" ? item.split(".")[2] : "";
                const OriginName = (_c = (_b = window.HSCARDS) === null || _b === void 0 ? void 0 : _b[OriginId]) === null || _c === void 0 ? void 0 : _c.name_cn;
                const PositionText = item.includes(".") && ((_d = item.split(".")) === null || _d === void 0 ? void 0 : _d[4]) ? `牌位${item.split(".")[4]}` : "";
                const SpecialCardID = item.includes(".") ? item : undefined;
                const nodeRef = createRef();
                const tempTar = handTemp.find((tar) => (tar.SpecialCardID || tar.CardID) === item);
                if (tempTar) {
                    tempTar.num = tempTar.num + 1;
                }
                else {
                    handTemp.push(Object.assign(Object.assign({}, ((_f = (_e = window.HSCARDS) === null || _e === void 0 ? void 0 : _e[realId]) !== null && _f !== void 0 ? _f : {})), { num: 1, nodeRef, SpecialCardID, OriginName, PositionText }));
                }
            });
            handTemp.sort((a, b) => { var _a, _b; ((_a = a === null || a === void 0 ? void 0 : a.Cost) !== null && _a !== void 0 ? _a : 0) - ((_b = b === null || b === void 0 ? void 0 : b.Cost) !== null && _b !== void 0 ? _b : 0); });
            setCgHandSum(handAmount !== null && handAmount !== void 0 ? handAmount : hand.length);
            setCgHandData(handTemp);
        }
        const rememberTemp = {};
        list.forEach((item) => {
            if (rememberTemp[item]) {
                rememberTemp[item]++;
            }
            else {
                rememberTemp[item] = 1;
            }
        });
        remember.current = rememberTemp;
        calRemember();
        setCgSum(remain !== null && remain !== void 0 ? remain : (((_a = list === null || list === void 0 ? void 0 : list.length) !== null && _a !== void 0 ? _a : 0) + ((_b = top === null || top === void 0 ? void 0 : top.length) !== null && _b !== void 0 ? _b : 0) + ((_c = bottom === null || bottom === void 0 ? void 0 : bottom.length) !== null && _c !== void 0 ? _c : 0)));
    }, []);
    const calTopBannerAmount = useCallback((index) => {
        if (index === 1)
            return (cgTopData === null || cgTopData === void 0 ? void 0 : cgTopData.length) ? 1 : 0;
        if (index === 2)
            return ((cgTopData === null || cgTopData === void 0 ? void 0 : cgTopData.length) ? 1 : 0) + ((cgdata === null || cgdata === void 0 ? void 0 : cgdata.length) ? 1 : 0);
        if (index === 3)
            return ((cgTopData === null || cgTopData === void 0 ? void 0 : cgTopData.length) ? 1 : 0) + ((cgdata === null || cgdata === void 0 ? void 0 : cgdata.length) ? 1 : 0) + ((cgBottomData === null || cgBottomData === void 0 ? void 0 : cgBottomData.length) ? 1 : 0);
        return 0;
    }, [cgTopData, cgdata, cgBottomData, cgHandData]);
    const calBottomBannerAmount = useCallback((index) => {
        if (index === 1)
            return (cgHandData === null || cgHandData === void 0 ? void 0 : cgHandData.length) ? 1 : 0;
        if (index === 2)
            return ((cgHandData === null || cgHandData === void 0 ? void 0 : cgHandData.length) ? 1 : 0) + ((cgBottomData === null || cgBottomData === void 0 ? void 0 : cgBottomData.length) ? 1 : 0);
        if (index === 3)
            return ((cgHandData === null || cgHandData === void 0 ? void 0 : cgHandData.length) ? 1 : 0) + ((cgBottomData === null || cgBottomData === void 0 ? void 0 : cgBottomData.length) ? 1 : 0) + ((cgdata === null || cgdata === void 0 ? void 0 : cgdata.length) ? 1 : 0);
        return 0;
    }, [cgTopData, cgdata, cgBottomData, cgHandData]);
    const calRemember = useCallback(() => {
        if (!remember.current)
            return;
        const cgString = JSON.stringify(remember.current).replace(/^\{|\}$/g, "").replace(/\"/g, "");
        const cg = analysisCg(cgString);
        const cg_temp = cg.list.map((item) => {
            item.nodeRef = createRef();
            return item;
        });
        setCgdata(cg_temp);
    }, []);
    const highLightAction = useCallback((id) => {
        var _a, _b, _c, _d;
        if (!highLightConfig || !highLightSwitch)
            return;
        const opt = highLightConfig.query;
        const dat = highLightConfig.data;
        const target = opt === null || opt === void 0 ? void 0 : opt.find((v) => { var _a; return (_a = v === null || v === void 0 ? void 0 : v.card_list) === null || _a === void 0 ? void 0 : _a.includes(id); });
        if (id && target) {
            const queryRes = (_a = target === null || target === void 0 ? void 0 : target.query) === null || _a === void 0 ? void 0 : _a.reduce((pre, v) => {
                const arr = [];
                for (let k in v) {
                    arr.push(`${k}.${v[k]}`);
                }
                pre.push(arr);
                return pre;
            }, []);
            const finalArr = (_b = queryRes === null || queryRes === void 0 ? void 0 : queryRes.reduce((pre, cur) => {
                const curTemp = cur.reduce((p, c) => {
                    var _a;
                    const thisGroup = (_a = dat === null || dat === void 0 ? void 0 : dat[c]) !== null && _a !== void 0 ? _a : [];
                    if (!p.length) {
                        return thisGroup;
                    }
                    else {
                        return thisGroup.filter((item) => p.includes(item));
                    }
                }, []);
                return Array.from(new Set([...pre, ...curTemp]));
            }, [])) !== null && _b !== void 0 ? _b : [];
            const highLightList = (_d = Array.from(new Set([...finalArr, ...((_c = target === null || target === void 0 ? void 0 : target.add_card_list) !== null && _c !== void 0 ? _c : [])]))) === null || _d === void 0 ? void 0 : _d.filter(item => { var _a; return !((_a = target === null || target === void 0 ? void 0 : target.exclude_card_list) === null || _a === void 0 ? void 0 : _a.includes(item)); });
            console.log("highLightList", highLightList, highLightList.length);
            setHighLightList(highLightList);
        }
        else {
            setHighLightList([]);
        }
    }, [highLightConfig, highLightSwitch]);
    useEffect(() => {
        window.highLightAction = highLightAction;
    }, [highLightAction]);
    useEffect(() => {
        window.fReplaceCard = replaceCard;
        window.cancelFixedRelativeCard = () => {
            SetStore("fixedCardId", "");
            SetStore("fixedRelativeCard", false);
        };
        window.initHighLightSwitch = (val) => setHighLightSwitch(val);
        loadJSON("https://hs2.166.net/hs-public-data/hs_data/static/inc/highlight_card_data.json").then((res) => {
            setHighLightConfig(res);
        });
    }, []);
    console.log(cgdata, cgTopData, cgBottomData, cgHandData);
    return (React.createElement(Fragment, null,
        React.createElement(CSSTransition, { timeout: 5000, classNames: "translateHidden", in: cgTopData === null || cgTopData === void 0 ? void 0 : cgTopData.length, unmountOnExit: true },
            React.createElement("p", { className: "ladder-title", style: { top: 0 } },
                React.createElement("span", { className: "ladder-title-text" },
                    "\u724C\u5E93\u9876\uFF1A",
                    cgTopSum),
                React.createElement("i", { className: Classnames("ladder-title-expand", { "fold": !topCardExpand }), onClick: () => setTopCardExpand(pre => !pre) }))),
        React.createElement("div", { className: "ladder-main-wrap", style: { height: topCardExpand ? "auto" : "0px" } }, cgTopData
            ? React.createElement(TransitionGroup, { component: "ul", className: "content" }, cgTopData.map((item, i) => {
                return (React.createElement(CSSTransition, { timeout: 5000, classNames: "translateX", key: "sy-" + (item.SpecialCardID || item.CardID), nodeRef: item.nodeRef },
                    React.createElement("div", { ref: item.nodeRef, onMouseEnter: () => highLightAction(item.CardID), onMouseLeave: () => highLightAction() },
                        React.createElement(Card, { info: item, animateNode: true, associated: true, hignLight: highLightList.includes(item.CardID) }))));
            }))
            : null),
        React.createElement(CSSTransition, { timeout: 5000, classNames: "translateHidden", in: !!cgSum, unmountOnExit: true },
            React.createElement("p", { className: "ladder-title", style: { top: calTopBannerAmount(1) * 30 + "px", bottom: calBottomBannerAmount(2) * 30 + "px" } },
                React.createElement("span", { className: "ladder-title-text" },
                    "\u724C\u5E93\u5269\u4F59\uFF1A",
                    cgSum),
                React.createElement("i", { className: Classnames("ladder-title-expand", { "fold": !remainCardExpand }), onClick: () => setRemainCardExpand(pre => !pre) }))),
        React.createElement("div", { className: "ladder-main-wrap", style: { height: remainCardExpand ? "auto" : "0px" } }, cgdata
            ? React.createElement(TransitionGroup, { component: "ul", className: "content" }, cgdata.map((item) => {
                return (React.createElement(CSSTransition, { timeout: 5000, classNames: "translateX", key: "sy-" + (item.SpecialCardID || item.CardID), nodeRef: item.nodeRef },
                    React.createElement("div", { ref: item.nodeRef, onMouseEnter: () => highLightAction(item.CardID), onMouseLeave: () => highLightAction() },
                        React.createElement(Card, { info: item, animateNode: true, associated: true, hignLight: highLightList.includes(item.CardID) }))));
            }))
            : null),
        React.createElement(CSSTransition, { timeout: 5000, classNames: "translateHidden", in: cgBottomData === null || cgBottomData === void 0 ? void 0 : cgBottomData.length, unmountOnExit: true },
            React.createElement("p", { className: "ladder-title", style: { top: calTopBannerAmount(2) * 30 + "px", bottom: calBottomBannerAmount(1) * 30 + "px" } },
                React.createElement("span", { className: "ladder-title-text" },
                    "\u724C\u5E93\u5E95\uFF1A",
                    cgBottomSum),
                React.createElement("i", { className: Classnames("ladder-title-expand", { "fold": !bottomCardExpand }), onClick: () => setBottomCardExpand(pre => !pre) }))),
        React.createElement("div", { className: "ladder-main-wrap", style: { height: bottomCardExpand ? "auto" : "0px" } }, cgBottomData
            ? React.createElement(TransitionGroup, { component: "ul", className: "content" }, cgBottomData.map((item, i) => {
                return (React.createElement(CSSTransition, { timeout: 5000, classNames: "translateX", key: "sy-" + (item.SpecialCardID || item.CardID), nodeRef: item.nodeRef },
                    React.createElement("div", { ref: item.nodeRef, onMouseEnter: () => highLightAction(item.CardID), onMouseLeave: () => highLightAction() },
                        React.createElement(Card, { info: item, animateNode: true, associated: true, hignLight: highLightList.includes(item.CardID) }))));
            }))
            : null),
        React.createElement(CSSTransition, { timeout: 5000, classNames: "translateHidden", in: cgHandData === null || cgHandData === void 0 ? void 0 : cgHandData.length, unmountOnExit: true },
            React.createElement("p", { className: "ladder-title", style: { top: calTopBannerAmount(3) * 30 + "px", bottom: 0 } },
                React.createElement("span", { className: "ladder-title-text" },
                    "\u624B\u724C\u4E2D\uFF1A",
                    cgHandSum),
                React.createElement("i", { className: Classnames("ladder-title-expand", { "fold": !handCardExpand }), onClick: () => setHandCardExpand(pre => !pre) }))),
        React.createElement("div", { className: "ladder-main-wrap", style: { height: handCardExpand ? "auto" : "0px" } }, cgHandData
            ? React.createElement(TransitionGroup, { component: "ul", className: "content" }, cgHandData.map((item) => {
                const targetKey = item.SpecialCardID ? (item.SpecialCardID.split(".")[0] + "." + item.SpecialCardID.split(".")[1]) : item.CardID;
                return (React.createElement(CSSTransition, { timeout: 5000, classNames: "translateX", key: "sy-" + targetKey, nodeRef: item.nodeRef },
                    React.createElement("div", { ref: item.nodeRef, onMouseEnter: () => highLightAction(item.CardID), onMouseLeave: () => highLightAction() },
                        React.createElement(Card, { info: item, animateNode: true, associated: true, hignLight: highLightList.includes(item.CardID) }))));
            }))
            : null)));
}
