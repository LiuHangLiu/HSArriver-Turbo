var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useEffect, useCallback, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Classnames from "classnames";
import "./index.scss";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import { HsboxClient } from "@hsbox/api";
import { loadScript, RARITY_NAME_MAP } from "@/utils";
import ColumnTooltip from "./column-tooltip";
import CollectDetailList from "./collect-detail-list";
import Tooltip from "rc-tooltip";
import "rc-tooltip/assets/bootstrap_white.css";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
export default function Collect() {
    var _a, _b, _c, _d;
    const { myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const [hscardsReady, setHscardsReady] = useState(false);
    const [highcardReady, setHighcardsReady] = useState(false);
    const [cardSetReady, setCardSetReady] = useState(false);
    const [collectData, setCollectData] = useState(null);
    const [onlyGold, setOnlyGold] = useState(false);
    const [onlyClass, setOnlyClass] = useState(false);
    const [curSet, setCurSets] = useState(0);
    const [cardSetGroup, setCardSetGroup] = useState([]);
    const [rarityResult, setRarityResult] = useState();
    const [detailRarity, setDetailRarity] = useState();
    const [detailIsHave, setDetailIsHave] = useState();
    const [detailIsHigh, setDetailIsHigh] = useState();
    const [detailShow, setDetailShow] = useState();
    const handleShowDetailsClick = (rarity, isHave, isHigh) => {
        setDetailRarity(rarity);
        setDetailIsHave(isHave);
        setDetailIsHigh(isHigh);
        setDetailShow(true);
        console.log("rarity", rarity, "isHave", isHave, "isHigh", isHigh);
    };
    const getCollectionManagerInfo = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const res = yield HsboxClient.getCollectInfo();
        if (!res) {
            console.log("getCollectInfo load error:", res);
            return;
        }
        const sets = res.sets;
        const selected = res.select_sets;
        let setVal = 0;
        if (sets.length == 1) {
            setVal = sets[0];
        }
        else if (sets[0] == 3 && sets[1] == 1635) {
            setVal = 1635;
        }
        else if (sets.length > 1 && sets[0] == 3 && selected) {
            setVal = 1;
        }
        else {
            setVal = 0;
        }
        setCurSets(setVal);
        setCollectData(res);
        console.log("getCollectInfo show:", res);
    }), []);
    const handleOnlyChange = (type, event) => {
        console.log(type, event.target.checked);
        if (type === "onlyGold") {
            setOnlyGold(event.target.checked);
        }
        else if (type === "onlyClass") {
            setOnlyClass(event.target.checked);
        }
    };
    useEffect(() => {
        HsboxClient.upDateEmbeddedMode();
        window.fDeckRecord = () => { };
        window.NotifyCollectMgrChanged = getCollectionManagerInfo;
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.min.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.min.js", () => {
            setHscardsReady(true);
            const CARDSET_GROUP = [];
            for (var i in window.HSCARDS) {
                if (window.HSCARDS[i]['Collectible'] == 1) {
                    let cardset = window.HSCARDS[i]['CardSet'];
                    if (!CARDSET_GROUP[cardset]) {
                        CARDSET_GROUP[cardset] = [];
                    }
                    CARDSET_GROUP[cardset].push(i);
                }
            }
            setCardSetGroup(CARDSET_GROUP);
        });
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/ops_rsync/high_win_cards.js" : "https://hs-api-dev.lushi.163.com/static/inc/ops_rsync/high_win_cards.js", () => {
            setHighcardsReady(true);
        });
        loadScript(RUN_ENV === "prod" ? "https://lushi-app.gameyw.netease.com/gzdata/hsCardsDesc.js" : "https://lushi-test.gameyw.netease.com/gzdata/hsCardsDesc.js", () => {
            setCardSetReady(true);
        });
        getCollectionManagerInfo().catch(console.log);
    }, []);
    const isHighCard = (id) => {
        const highCardString = window.HIGH_WIN_CARDS.join(',');
        if (highCardString.indexOf(id) > -1) {
            return 1;
        }
        return 0;
    };
    const countColumnHeight = (data) => {
        let x = data.sum;
        let y = data.by[1].sum;
        let z = data.by[0].sum;
        let h = [0, 0, 0, 0];
        let y1 = data.by[1][1].sum;
        let y2 = data.by[1][0].sum;
        let z1 = data.by[0][1].sum;
        let z2 = data.by[0][0].sum;
        let yC = y > z ? y : z;
        let zC = y > z ? (z / y) : (y / z);
        let yH = Math.pow((yC / x), 1 / 3) * 110;
        let zH = zC * yH;
        if (y > z) {
            if (y != 0) {
                h[0] = Math.ceil((y1 / y) * yH);
                h[1] = Math.ceil((y2 / y) * yH);
            }
            if (z != 0) {
                h[2] = Math.ceil((z1 / z) * zH);
                h[3] = Math.ceil((z2 / z) * zH);
            }
        }
        else {
            if (y != 0) {
                h[0] = Math.ceil((y1 / y) * zH);
                h[1] = Math.ceil((y2 / y) * zH);
            }
            if (z != 0) {
                h[2] = Math.ceil((z1 / z) * yH);
                h[3] = Math.ceil((z2 / z) * yH);
            }
        }
        return h;
    };
    useEffect(() => {
        if (!(hscardsReady && highcardReady && collectData))
            return;
        let rarityRes = {
            5: {}, 4: {}, 3: {}, 2: {}, 1: {}
        };
        for (let i in rarityRes) {
            rarityRes[i] = {
                sum: 0,
                by: {
                    0: {
                        sum: 0,
                        0: { sum: 0, list: [] },
                        1: { sum: 0, list: [] }
                    },
                    1: {
                        sum: 0,
                        0: { sum: 0, list: [] },
                        1: { sum: 0, list: [] }
                    }
                }
            };
        }
        let { cards, sets, select_sets } = collectData;
        let cardObj = { 0: {}, 1: {} };
        if (sets.length == 0 && select_sets) {
            sets = [2, 3, 4, 11, 12, 13, 14, 15, 20, 21, 23, 25, 27, 1001, 1004, 1125, 1127, 1129, 1130, 1158, 1347, 1403, 1414, 1443, 1463, 1466];
        }
        else if (sets.length == 0 && !select_sets) {
            sets = [2, 3, 1125, 1127, 1129, 1130, 1158, 1347, 1403, 1414, 1443, 1463, 1466];
        }
        else if (sets.indexOf(1439) > -1) {
            sets.splice(sets.indexOf(1439), 1);
        }
        else if (sets.indexOf(1439) > -1) {
            sets.splice(sets.indexOf(1439), 1);
        }
        cards.forEach((item) => {
            if (item.gold == 1) {
                cardObj[1][item.id] = item;
            }
            else {
                cardObj[0][item.id] = item;
            }
        });
        sets.forEach((v) => {
            if (v == 2) {
                return;
            }
            if (!cardSetGroup[v]) {
                return;
            }
            cardSetGroup[v].forEach((id) => {
                if (id.indexOf('HERO_') > -1) {
                    return;
                }
                if (onlyClass && window.HSCARDS[id]["Class"] != collectData["class"]) {
                    return;
                }
                let rarity = window.HSCARDS[id]["Rarity"];
                rarityRes[rarity]['sum']++;
                let isHigh = isHighCard(id);
                let crtCardObj = cardObj[0];
                if (onlyGold) {
                    crtCardObj = cardObj[1];
                }
                if (!crtCardObj[id]) {
                    if (!onlyGold && cardObj[1][id]) {
                        rarityRes[rarity]['by'][1]['sum']++;
                        rarityRes[rarity]['by'][1][isHigh]['sum']++;
                        rarityRes[rarity]['by'][1][isHigh]['list'].push(cardObj[1][id]);
                    }
                    if (!cardObj[1][id] || (cardObj[1][id]['num'] < 2 && window.HSCARDS[id]['Rarity'] != 5)) {
                        rarityRes[rarity]['by'][0]['sum']++;
                        rarityRes[rarity]['by'][0][isHigh]['sum']++;
                        if (!cardObj[1][id] && window.HSCARDS[id]['Rarity'] != 5) {
                            rarityRes[rarity]['by'][0][isHigh]['list'].push({ id: id, num: 2, gold: onlyGold ? 1 : 0 });
                        }
                        else {
                            rarityRes[rarity]['by'][0][isHigh]['list'].push({ id: id, num: 1, gold: onlyGold ? 1 : 0 });
                        }
                    }
                }
                else if (crtCardObj[id]) {
                    rarityRes[rarity]['by'][1]['sum']++;
                    rarityRes[rarity]['by'][1][isHigh]['sum']++;
                    rarityRes[rarity]['by'][1][isHigh]['list'].push(crtCardObj[id]);
                    if (!onlyGold && cardObj[1][id]) {
                        rarityRes[rarity]['by'][1][isHigh]['list'].push(cardObj[1][id]);
                    }
                    else if (crtCardObj[id]['num'] < 2 && window.HSCARDS[id]['Rarity'] != 5) {
                        rarityRes[rarity]['by'][0]['sum']++;
                        rarityRes[rarity]['by'][0][isHigh]['sum']++;
                        rarityRes[rarity]['by'][0][isHigh]['list'].push({ id: id, num: 1, gold: onlyGold ? 1 : 0 });
                    }
                }
            });
            setRarityResult(rarityRes);
            console.log("show res", rarityRes);
        });
    }, [collectData, hscardsReady, highcardReady, onlyGold, onlyClass, cardSetGroup]);
    const nsRecord = useCallback((type) => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            game_type: 1,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            button_id: type,
            from_part: 5,
            from_type: 3,
            postion_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", "clk_new_2_391_20", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const filters = useMemo(() => {
        return React.createElement("p", { className: "collect-control" },
            React.createElement("label", null,
                React.createElement("span", { className: Classnames("checkmark", { active: onlyGold }) }),
                React.createElement("input", { className: "i-radio", type: "checkbox", onChange: (e) => { handleOnlyChange("onlyGold", e); nsRecord(6); } })),
            "\u53EA\u770B\u91D1\u5361");
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType, onlyGold]);
    const resDom = useMemo(() => {
        if (!rarityResult) {
            return null;
        }
        else {
            const rarityList = [5, 4, 3, 1];
            return rarityList.map((rarity, idx) => {
                let columnHeight = countColumnHeight(rarityResult[rarity]);
                return (React.createElement("div", { className: "collect-block", key: idx },
                    React.createElement("p", { className: "collect-type", onClick: () => { handleShowDetailsClick(rarity, 1, 1); nsRecord(7); } },
                        React.createElement("em", { className: "u-rarity i-rarity-" + rarity }),
                        RARITY_NAME_MAP[rarity]),
                    React.createElement("ul", null,
                        React.createElement("li", null,
                            React.createElement("span", { className: "col" },
                                React.createElement(ColumnTooltip, { data: rarityResult[rarity], isHave: 1, isHigh: 1, idx: idx, extraClass: 'z-c1', height: columnHeight[0], handleShowDetailsClick: () => handleShowDetailsClick(rarity, 1, 1) }),
                                React.createElement(ColumnTooltip, { data: rarityResult[rarity], isHave: 1, isHigh: 0, idx: idx, extraClass: 'z-c2', height: columnHeight[1], handleShowDetailsClick: () => handleShowDetailsClick(rarity, 1, 0) })),
                            React.createElement("b", { className: "val" }, rarityResult[rarity]['by'][1]['sum'])),
                        React.createElement("li", null,
                            React.createElement("span", { className: "col" },
                                React.createElement(ColumnTooltip, { data: rarityResult[rarity], isHave: 0, isHigh: 1, idx: idx, extraClass: 'z-c3', height: columnHeight[2], handleShowDetailsClick: () => handleShowDetailsClick(rarity, 0, 1) }),
                                React.createElement(ColumnTooltip, { data: rarityResult[rarity], isHave: 0, isHigh: 0, idx: idx, extraClass: 'z-c4', height: columnHeight[3], handleShowDetailsClick: () => handleShowDetailsClick(rarity, 1, 0) })),
                            React.createElement("b", { className: "val" }, rarityResult[rarity]['by'][0]['sum'])))));
            });
        }
    }, [rarityResult]);
    const ctrlNodes = useMemo(() => {
        if (!detailRarity)
            return null;
        const nodes = [];
        [1, 0].forEach((v, k) => {
            [1, 0].forEach((b) => {
                nodes.push(React.createElement("span", { className: (detailIsHigh == b && detailIsHave == v) ? 'z-active' : '', key: k * 2 + b, onClick: () => handleShowDetailsClick(detailRarity !== null && detailRarity !== void 0 ? detailRarity : 1, v, b) },
                    React.createElement("i", null),
                    rarityResult[detailRarity !== null && detailRarity !== void 0 ? detailRarity : 1]["by"][v][b].sum));
            });
        });
        return nodes;
    }, [detailIsHave, detailIsHigh, detailRarity]);
    return (React.createElement("div", { className: "collect-view" },
        React.createElement(Wrapper, { className: "collect-wrapper", width: 260 },
            curSet == 1646 ? ""
                : React.createElement(React.Fragment, null,
                    React.createElement(Title, { text: "我的收藏" }),
                    React.createElement("nav", { className: "collect-nav" },
                        React.createElement("a", { className: "collect-nav-item flex-ct-x active" },
                            "\u6536\u85CF\u7BA1\u7406",
                            React.createElement("i", null)),
                        React.createElement(Link, { className: "collect-nav-item flex-ct-x", to: "/record" },
                            "\u5957\u724C\u7BA1\u7406",
                            React.createElement("i", null))),
                    React.createElement("div", { className: "collect-middle" },
                        React.createElement("div", { className: "collect-title" },
                            "\u6536\u85CF\u8BE6\u60C5\uFF1A", (_d = ((_b = (_a = window.seriesList) === null || _a === void 0 ? void 0 : _a.find((v) => { return v.id === (curSet + ""); })) !== null && _b !== void 0 ? _b : (_c = window.seriesType) === null || _c === void 0 ? void 0 : _c.find((v) => { return v.id === (curSet + ""); }))) === null || _d === void 0 ? void 0 :
                            _d.name),
                        filters,
                        React.createElement("div", { className: "collect-column" }, resDom),
                        React.createElement("div", { className: "collect-legend" },
                            React.createElement("span", null,
                                React.createElement("em", { className: "z-c1" }),
                                "\u5DF2\u6709\u9AD8\u80DC\u5361"),
                            React.createElement("span", null,
                                React.createElement("em", { className: "z-c3" }),
                                "\u7F3A\u5931\u9AD8\u80DC\u5361"),
                            React.createElement("span", null,
                                React.createElement("em", { className: "z-c2" }),
                                "\u5DF2\u6709\u975E\u9AD8\u80DC\u5361"),
                            React.createElement("span", null,
                                React.createElement("em", { className: "z-c4" }),
                                "\u7F3A\u5931\u975E\u9AD8\u80DC\u5361")),
                        React.createElement("div", { className: "collect-tips" },
                            "\u4EC0\u4E48\u662F\u9AD8\u80DC\u5361",
                            React.createElement(Tooltip, { placement: "top", overlay: "\u9AD8\u80DC\u5361\u6307\u7684\u662F\u5929\u68AF\u9AD8\u80DC\u5361\u7EC4\u5E38\u7528\u5361\u724C", overlayClassName: "z-white", overlayStyle: { width: '160px' } },
                                React.createElement("b", { className: "i-tips" }, "?"))))),
            React.createElement("div", { className: Classnames("collect-detail-view", { active: detailShow }) },
                React.createElement("div", { className: "collect-detail-title" },
                    React.createElement("i", { onClick: () => setDetailShow(false) }),
                    React.createElement("em", { className: "u-rarity i-rarity-" + detailRarity }),
                    RARITY_NAME_MAP[detailRarity !== null && detailRarity !== void 0 ? detailRarity : 1]),
                React.createElement("div", { className: "collect-detail-ctrl" }, ctrlNodes),
                detailRarity ? React.createElement(CollectDetailList, { isHave: detailIsHave !== null && detailIsHave !== void 0 ? detailIsHave : 0, isHigh: detailIsHigh !== null && detailIsHigh !== void 0 ? detailIsHigh : 0, data: rarityResult[detailRarity]["by"] }) : null,
                React.createElement("div", { className: "collect-detail-empty" })))));
}
