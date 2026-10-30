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
import Classnames from "classnames";
import "./index.scss";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import Card from "@/components/card";
import { HsboxClient, ReadeeCollectDecks } from "@hsbox/api";
import { analysisCg, loadScript, CARD_TYPE_MAP } from "@/utils";
import Save from "@/components/save";
import _ from "lodash";
import { useSnapshot } from "valtio";
import { STORE, SetStore } from "@/stores";
export default function Analysis() {
    const { myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const [myDeck, setMyDeck] = useState();
    const [cgdata, setCgdata] = useState({});
    const [targetTab, setTargetTab] = useState(0);
    const [saveGroup, setSaveGroup] = useState([]);
    const nsRecord = useCallback((type) => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            game_type: 1,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            from_part: type,
            from_type: 2,
            position_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", "clk_new_2_391_20", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const fInit = (data) => {
        var _a, _b;
        console.log("fInit", data);
        let hash = (_b = (_a = data === null || data === void 0 ? void 0 : data.replace(/<\/?[^>]*>/g, "")) === null || _a === void 0 ? void 0 : _a.replace("#", "")) !== null && _b !== void 0 ? _b : "";
        let deck = { cards: "", deck_id: "", hero_id: "", md5: "", name: "" };
        if (hash.indexOf("^") > -1) {
            let base = hash.split("^")[0].split(":");
            let cg = hash.split("^")[1];
            deck["deck_id"] = base[0];
            deck["name"] = base[1];
            deck["cards"] = cg;
            deck["hero_id"] = base[2];
            deck["md5"] = "";
        }
        getDeckData(deck);
    };
    const getDeckData = (deck) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const data = yield HsboxClient.getDeckInfo(deck.deck_id + "");
        if (data && data["md5"]) {
            deck["md5"] = (_a = data["md5"]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
            setMyDeck(deck);
        }
        else {
            deck["md5"] = "";
            setMyDeck(deck);
        }
    });
    const updateDeck = (data) => {
        console.log("updateDeck", data);
        getDeckData(data);
    };
    const onLoad = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const cb = yield ReadeeCollectDecks();
        setSaveGroup((cb === null || cb === void 0 ? void 0 : cb.data) || []);
        const result = yield HsboxClient.getCollectDeck();
        if ((result === null || result === void 0 ? void 0 : result.scene_mode) && (result.scene_mode == 1792 || result.scene_mode == 3328 || result.scene_mode == 2048)) {
            setTargetTab(0);
        }
        else {
            setTargetTab(1);
        }
    }), []);
    useEffect(() => {
        onLoad().catch(console.log);
    }, [onLoad]);
    useEffect(() => {
        if (!myDeck)
            return;
        if (!window.HSCARDS) {
            loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.ana.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.ana.js", () => {
                if (!window.HSCARDS)
                    return;
                try {
                    const result = analysisCg(myDeck.cards, { curve: true, type: true, effect: true, race: true });
                    setCgdata(result);
                    console.log(result);
                }
                catch (e) {
                    console.error("[Analysis] analysisCg error:", e);
                }
            });
        }
        else {
            try {
                const result = analysisCg(myDeck.cards, { curve: true, type: true, effect: true, race: true });
                setCgdata(result);
                console.log(result);
            }
            catch (e) {
                console.error("[Analysis] analysisCg error:", e);
            }
        }
    }, [myDeck]);
    useEffect(() => {
        window.onChangeTargetTab = setTargetTab;
        window.fCardGroupInit = fInit;
        window.fChangeCards = updateDeck;
        window.cancelFixedRelativeCard = () => {
            SetStore("fixedCardId", "");
            SetStore("fixedRelativeCard", false);
        };
    }, [setTargetTab, fInit, updateDeck]);
    const dom0 = React.createElement("div", { className: "analysis-main-wrap" },
        React.createElement("ul", { className: "analysis-main-group" }, cgdata.list
            ? cgdata.list.map((item, index) => {
                return React.createElement(Card, { key: index, info: item, associated: true });
            })
            : null));
    const dom1 = useMemo(() => {
        const { curve, effect, race } = cgdata;
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
        return React.createElement("div", { className: "analysis-main-wrap", style: { height: "610px" } },
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
    }, [cgdata]);
    let hero = (myDeck === null || myDeck === void 0 ? void 0 : myDeck.hero_id) ? parseInt(myDeck === null || myDeck === void 0 ? void 0 : myDeck.hero_id.replace("HERO_", "")) : "default";
    return (React.createElement("div", { className: "analysis-view" },
        React.createElement(Wrapper, { className: "analysis-wrapper", width: 260 },
            React.createElement(Title, { text: "当前卡组" }),
            React.createElement("div", { className: `analysis-job job hero-l-${hero}` },
                React.createElement("i", { className: `hero hero-${hero}` }),
                React.createElement("span", { className: "group-name" }, myDeck === null || myDeck === void 0 ? void 0 : myDeck.name),
                (myDeck === null || myDeck === void 0 ? void 0 : myDeck.md5) ? React.createElement(Save, { groups: saveGroup, data: myDeck, status: 1 }) : null),
            React.createElement("nav", { className: "analysis-nav" },
                React.createElement("a", { className: Classnames("analysis-nav-item flex-ct-x", { active: targetTab === 0 }), onClick: () => { setTargetTab(0); nsRecord(3); } },
                    "\u5361\u7EC4\u6784\u6210",
                    React.createElement("i", null)),
                React.createElement("a", { className: Classnames("analysis-nav-item flex-ct-x", { active: targetTab === 1 }), onClick: () => { setTargetTab(1); nsRecord(4); } },
                    "\u5361\u7EC4\u5206\u6790",
                    React.createElement("i", null))),
            React.createElement("ul", { className: "analysis-statistics" }, cgdata.cardType ? Object.keys(cgdata.cardType).map((key) => {
                if (+key === 3) {
                    return;
                }
                else {
                    return React.createElement("span", { key: key },
                        CARD_TYPE_MAP[key],
                        "(",
                        cgdata.cardType[key].sum,
                        ")");
                }
            }) : null),
            targetTab === 0 && dom0,
            targetTab === 1 && dom1)));
}
