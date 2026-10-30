import React, { useEffect, useCallback, useState, useMemo } from "react";
import Classnames from "classnames";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import Card from "@/components/card";
import { analysisCg, loadScript, CARD_TYPE_MAP } from "@/utils";
import extend from "extend";
import "./index.scss";
import "rc-tooltip/assets/bootstrap_white.css";
import _ from "lodash";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
export default function Arena() {
    const { myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const [guide, setGuide] = useState([]);
    const [myHero, setMyHero] = useState(0);
    const [myCgString, setMyCgString] = useState("");
    const [cardStage, setCardStage] = useState("ordinary");
    const [myCgData, setMyCgData] = useState({});
    const [hscardsReady, setHscardsReady] = useState(false);
    const [curveReady, setCurveReady] = useState(false);
    const [myGuideList, setMyGuideList] = useState([]);
    const [targetTab, setTargetTab] = useState(0);
    const nsRecord = useCallback((type) => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            game_type: 2,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            from_part: type,
            from_type: 4,
            position_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", "clk_new_2_391_20", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const changeTab = useCallback((tab) => {
        setTargetTab(tab);
    }, []);
    const changedCountDeck = useCallback((cgString) => {
        if (typeof (cgString) != "string") {
            cgString = JSON.stringify(cgString).replace(/^\{|\}$/g, "").replace(/\"/g, "");
        }
        setMyCgString(cgString);
    }, []);
    useEffect(() => {
        if (!hscardsReady)
            return;
        setMyCgData(analysisCg(myCgString, { curve: true, type: true, effect: true, race: true }));
    }, [hscardsReady, myCgString, setMyCgData]);
    useEffect(() => {
        loadScript(RUN_ENV === "prod" ? "https://hs-api.lushi.163.com/static/inc/ops_rsync/jjc_power_curve.js" : "https://hs-api-dev.lushi.163.com/static/inc/ops_rsync/jjc_power_curve.js", () => {
            setCurveReady(true);
        });
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards2.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards2.js", () => {
            window.HSCARDS_2 = window.HSCARDS;
            loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.ana.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.ana.js", () => {
                window.HSCARDS = extend(true, {}, window.HSCARDS, window.HSCARDS_2);
                setHscardsReady(true);
            });
        });
    }, []);
    useEffect(() => {
        window.fRecommend = (hero, guideList, cardStage) => {
            console.log("推荐套牌：", hero, guideList);
            setMyHero(hero);
            setGuide(guideList);
            setCardStage(cardStage);
        };
        window.fCountEffect = changedCountDeck;
    }, [setMyHero, setGuide, changedCountDeck, setCardStage]);
    useEffect(() => {
        if (!(hscardsReady && curveReady))
            return;
        let guideList = [];
        guide.forEach((item) => {
            if (!window.HSCARDS[item] || window.HSCARDS[item]["class"] == "-1") {
                return;
            }
            let card = window.HSCARDS[item];
            if (window.HSCARDS && window.HSCARDS[item]) {
                card["score"] = window.HSCARDS[item].score;
                card["arena_strength"] = window.HSCARDS[item].arena_strength;
            }
            else {
                card["score"] = "-";
                card["arena_strength"] = "-";
            }
            guideList.push(card);
            setMyGuideList(guideList);
        });
    }, [hscardsReady, curveReady, guide, myHero]);
    const highBuild = useMemo(() => {
        return "";
        const { cardType } = myCgData;
        if (!curveReady || !cardType || !myHero)
            return "";
        const configList = [4, 5, 7, 3, 39].map((type) => {
            const total = Math.round(window.HERO_CURVE[myHero].types[type] * 10) / 10;
            return {
                name: CARD_TYPE_MAP[type],
                current: cardType[type].sum,
                total: isNaN(total) ? 0 : total,
            };
        });
        let max = 1;
        configList.forEach((element) => {
            if (element.total > max) {
                max = element.total;
            }
        });
        configList.forEach((element) => {
            if (element.current > max) {
                max = element.current;
            }
        });
        max = Math.ceil(max);
        return React.createElement("ul", { className: "arena-high-build", style: { "paddingLeft": "40px", "paddingRight": "40px" } },
            configList.map((item, i) => {
                return (React.createElement("li", { className: "arena-high-build-item", key: i },
                    React.createElement("div", { className: "arena-high-build-total", style: { "height": item.total * 100 / max + "%" } },
                        React.createElement("p", { className: "arena-high-build-value" }, item.total)),
                    React.createElement("div", { className: "arena-high-build-current", style: { "height": item.current * 100 / max + "%" } }),
                    React.createElement("p", { className: "arena-high-build-name" }, item.name)));
            }),
            React.createElement("span", { className: "arena-high-build-zhang" }, "\uFF08\u5F20\uFF09"));
    }, [curveReady, myCgData, myHero]);
    const curveBuild = useMemo(() => {
        var _a;
        return "";
        if (!curveReady || !(myCgData === null || myCgData === void 0 ? void 0 : myCgData.curve) || !myHero)
            return "";
        const curveCost = (_a = myCgData === null || myCgData === void 0 ? void 0 : myCgData.curve) === null || _a === void 0 ? void 0 : _a.Cost;
        let max = 1;
        curveCost.forEach((element) => {
            if (element > max) {
                max = element;
            }
        });
        for (let i = 0; i < 8; i++) {
            if (window.HERO_CURVE[myHero]["power"][i] > max) {
                max = window.HERO_CURVE[myHero]["power"][i];
            }
        }
        max = Math.ceil(max);
        return React.createElement("ul", { className: "arena-high-build" }, curveCost.map((item, i) => {
            return (React.createElement("li", { className: "arena-high-build-item", key: i },
                React.createElement("div", { className: "arena-high-build-total", style: { "height": window.HERO_CURVE[myHero]["power"][i] * 100 / max + "%" } },
                    React.createElement("p", { className: "arena-high-build-value" }, window.HERO_CURVE[myHero]["power"][i].toFixed(1))),
                React.createElement("div", { className: "arena-high-build-current", style: { "height": item * 100 / max + "%" } }),
                React.createElement("p", { className: "arena-high-build-cost" }, i == 7 ? "7+" : i)));
        }));
    }, [curveReady, myCgData, myHero]);
    const recommandList = useMemo(() => {
        return myGuideList.length ? myGuideList === null || myGuideList === void 0 ? void 0 : myGuideList.map((item, i) => {
            return (React.createElement("div", { className: "arena-card", key: i },
                React.createElement(Card, { info: item }),
                cardStage === "legend" ? (React.createElement("p", { className: "arena-card-txt" },
                    React.createElement("b", null, "\u5361\u724C\u5F3A\u5EA6\uFF1A"),
                    !!item.arena_strength ? React.createElement("em", { className: "arena-card-score" }, item.arena_strength) : React.createElement("span", { className: "arena-card-none" }, "\u6682\u65E0"))) : (React.createElement("p", { className: "arena-card-txt" },
                    React.createElement("b", null, "\u4E3B\u64AD\u8BC4\u5206\uFF1A"),
                    !isNaN(item.score) ? React.createElement("em", { className: "arena-card-score" },
                        item.score,
                        "\u5206") : React.createElement("span", { className: "arena-card-none" }, "\u6682\u65E0"))),
                React.createElement("p", { className: "arena-card-txt" },
                    React.createElement("b", null, "\u70B9\u8BC4\uFF1A"),
                    item.recommend)));
        }) : "";
    }, [myGuideList]);
    const analysisDom = useMemo(() => {
        const { curve, effect, race } = myCgData;
        if (!curve)
            return;
        const curveMapper = {
            Cost: "法力曲线",
            Atk: "攻击曲线（随从&武器）",
            Health: "生命曲线（随从）"
        };
        console.log(curve);
        const curveDom = Object.keys(curve).map((key) => {
            var _a;
            let max = (_a = _.max(curve[key])) !== null && _a !== void 0 ? _a : 0;
            return (React.createElement("div", { className: "analysis-curve", key: key },
                React.createElement("p", { className: "tlt" },
                    React.createElement("em", { className: "i-" + key }),
                    curveMapper[key]),
                React.createElement("ul", null, curve[key].map((v, k) => {
                    return (React.createElement("li", { key: k },
                        React.createElement("span", { className: "num" }, v),
                        React.createElement("span", { className: "column" },
                            React.createElement("em", { style: { height: max == 0 ? 0 : Math.ceil(v / max * 100) + "px" } })),
                        React.createElement("span", { className: "val" }, k > 6 ? "7+" : k)));
                }))));
        });
        return React.createElement("div", { className: "arena-middle", style: { height: "calc(100vh - 167px)" } },
            curveDom,
            React.createElement("div", { className: "analysis-effectList" },
                React.createElement("p", { className: "tlt" }, "\u5361\u724C\u6548\u679C"),
                React.createElement("ul", null, Object.keys(effect).map((key) => {
                    if (effect[key]["n"] == 0) {
                        return;
                    }
                    return (React.createElement("li", { key: key },
                        effect[key]["enCN"],
                        "(",
                        effect[key]["n"],
                        ")"));
                }))),
            React.createElement("div", { className: "analysis-effectList" },
                React.createElement("p", { className: "tlt" }, "\u5361\u724C\u79CD\u65CF"),
                React.createElement("ul", null, Object.keys(race).map((key) => {
                    if (race[key]["n"] == 0) {
                        return;
                    }
                    return (React.createElement("li", { key: key },
                        race[key]["enCN"],
                        "(",
                        race[key]["n"],
                        ")"));
                }))));
    }, [myCgData]);
    return (React.createElement("div", { className: "arena-view" },
        React.createElement(Wrapper, { className: "arena-wrapper", width: 260 },
            React.createElement(Title, { text: "竞技套牌模式" }),
            React.createElement("nav", { className: "arena-nav" },
                React.createElement("a", { className: Classnames("arena-nav-item flex-ct-x", { active: targetTab === 0 }), onClick: () => { changeTab(0); nsRecord(7); } },
                    "\u9009\u5361\u6307\u5357",
                    React.createElement("i", null)),
                React.createElement("a", { className: Classnames("arena-nav-item flex-ct-x", { active: targetTab === 1 }), onClick: () => { changeTab(1); nsRecord(4); } },
                    "\u5361\u7EC4\u5206\u6790",
                    React.createElement("i", null))),
            targetTab === 0
                ? !hscardsReady ? "loading..."
                    : React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "arena-middle" }, recommandList))
                : React.createElement(React.Fragment, null,
                    React.createElement("ul", { className: "analysis-statistics arena-statistics" }, myCgData.cardType ? Object.keys(myCgData.cardType).map((key) => {
                        if (+key === 3) {
                            return;
                        }
                        else {
                            return React.createElement("span", { key: key },
                                CARD_TYPE_MAP[key],
                                "(",
                                myCgData.cardType[key].sum,
                                ")");
                        }
                    }) : null),
                    analysisDom))));
}
