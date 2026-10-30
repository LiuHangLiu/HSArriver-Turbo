var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useEffect, useCallback, useState, useRef, useMemo, Fragment } from "react";
import { HsboxClient, ReadeeSimilarDecks, ReadeeCollectDecks, GetRivalInfo } from "@hsbox/api";
import _ from "lodash";
import Card from "@/components/card";
import { analysisCg, rankMapFunc, HERO_CLASS_MAP } from "@/utils";
import Classnames from "classnames";
import Save from "@/components/save";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
import Tooltip from "rc-tooltip";
import "rc-tooltip/assets/bootstrap_white.css";
export default function OppList() {
    var _a, _b, _c, _d, _e, _f, _g;
    const { myDeviceId, myBtag, myUrs, mySid, dataSource, positionType, checkOppEnable } = useSnapshot(STORE);
    const [current, setCurrent] = useState(0);
    const [loading, setLoading] = useState(false);
    const [newGroup, setNewGroup] = useState(false);
    const [result, setResult] = useState([]);
    const [error, setError] = useState("");
    const [knownLen, setKnownLen] = useState(0);
    const known = useRef([]);
    const battle = useRef({});
    const reqFresh = useRef(true);
    const reqKnowString = useRef("");
    const firstCgMd5key = useRef("");
    const reqResult = useRef([]);
    const newReqResult = useRef({});
    const [saveGroup, setSaveGroup] = useState([]);
    const [mode, setMode] = useState();
    const [enemyBtag, setEnemyBtag] = useState("");
    const [oppInfo, setOppInfo] = useState({});
    const nsRecord = useCallback(() => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            game_type: 1,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            button_id: 4,
            from_part: 4,
            from_type: 2,
            position_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", "clk_new_2_391_19", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const knownCard = useCallback((list) => {
        if (!list || list.length < 3) {
            known.current = list;
            setKnownLen(list.length);
            return;
        }
        else {
            known.current = list;
            setKnownLen(list.length);
            setLoading(true);
            if (reqFresh.current) {
                reqKnowString.current = list.join(',');
                requestCg();
            }
            else {
                dealCg(reqResult.current);
            }
        }
    }, []);
    const dealCg = useCallback((list) => __awaiter(this, void 0, void 0, function* () {
        let matchData = [];
        list.map((cg) => {
            let data = matchCg(cg.cg);
            cg['match'] = data;
            matchData.push(cg);
        });
        setLoading(false);
        setResult(matchData);
        setError("");
        firstCgMd5key.current = list[0].md5;
        console.log("预测结果", matchData);
    }), []);
    const matchCg = useCallback((cgSingleString) => {
        const data = {
            have: {},
            unhave: {},
            all: {}
        };
        let knownList = known.current.slice(0);
        console.log(knownList);
        const list = cgSingleString.split(" ");
        const pushKey = ((key, id) => {
            if (data[key][id]) {
                data[key][id]++;
            }
            else {
                data[key][id] = 1;
            }
        });
        list.map((item) => {
            let knownIdx = _.indexOf(knownList, item);
            if (knownIdx > -1) {
                pushKey('have', item);
                knownList.splice(knownIdx, 1);
            }
            else {
                pushKey('unhave', item);
            }
            pushKey('all', item);
        });
        console.log("已知", data.have);
        return data;
    }, []);
    const requestCg = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const param = { topage: reqKnowString.current, hero: (_a = battle.current) === null || _a === void 0 ? void 0 : _a.enemyhero, mode: (_b = battle.current) === null || _b === void 0 ? void 0 : _b.wild };
        const res = yield ReadeeSimilarDecks(param);
        if (res.flag && !_.isEmpty(res.data)) {
            console.log("有数据", res);
            newReqResult.current = res.data;
            if (res.data[0].md5 !== firstCgMd5key.current && firstCgMd5key.current !== "" && !loading) {
                setNewGroup(true);
                reqFresh.current = false;
                dealCg(reqResult.current);
            }
            else {
                reqResult.current = res.data;
                dealCg(res.data);
            }
        }
        else {
            if (_.isEmpty(res.data)) {
                setLoading(false);
                setError("找不到匹配卡组");
            }
            else {
                setLoading(false);
                setError(res.message);
            }
        }
    }), [loading]);
    const handleUpdateCg = useCallback(() => {
        setLoading(true);
        setNewGroup(false);
        reqFresh.current = true;
        setCurrent(0);
        let knownString = known.current.join(',');
        if (reqKnowString.current === knownString) {
            dealCg(newReqResult.current);
        }
        else {
            reqKnowString.current = knownString;
            requestCg();
        }
    }, []);
    const calRate = (a, b) => {
        if (!b)
            return 0;
        return Math.round(a * 100 / b);
    };
    const onLoad = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const res = yield HsboxClient.getBattleInfo();
        console.log("展示battleInfo", res);
        battle.current = res;
        const cb = yield ReadeeCollectDecks();
        setSaveGroup((cb === null || cb === void 0 ? void 0 : cb.data) || []);
        if (!res)
            return;
        setMode(res.game_type);
        setEnemyBtag(res.enemybtag);
        const rivalRes = yield GetRivalInfo({ sid: mySid, id: res.rival_bnet_id + "", type: res.game_type });
        console.log("mySid", mySid, "id", res === null || res === void 0 ? void 0 : res.rival_bnet_id, "result", rivalRes);
        setOppInfo(rivalRes.data);
    }), [mySid]);
    useEffect(() => {
        window.fKnownCard = knownCard;
    }, [knownCard]);
    useEffect(() => {
        if (!mySid)
            return;
        onLoad();
    }, [mySid]);
    const groupTab = useMemo(() => {
        const doms = result.map((item, i) => {
            return React.createElement("li", { key: i, className: current === i ? 'active' : '', onClick: () => { setCurrent(i); nsRecord(); } },
                "\u5361\u7EC4",
                i + 1);
        });
        return React.createElement("ul", { className: "opplist-groups" },
            doms,
            React.createElement(Save, { groups: saveGroup, data: result[current], status: 2 }));
    }, [result, current]);
    const groupDetail = useMemo(() => {
        if (!result.length) {
            return null;
        }
        else {
            return result.map((item, i) => {
                const haveString = JSON.stringify(item.match.have).replace(/^\{|\}$/g, '').replace(/\"/g, '');
                const havecg = analysisCg(haveString);
                const unhaveString = JSON.stringify(item.match.unhave).replace(/^\{|\}$/g, '').replace(/\"/g, '');
                const unhavecg = analysisCg(unhaveString);
                return (React.createElement("ul", { className: Classnames("conetnt opplist-current", { hidden: current !== i }), key: i },
                    havecg.list.map((v, k) => {
                        return React.createElement(Card, { info: v, key: k });
                    }),
                    unhavecg.list.map((v, k) => {
                        return React.createElement(Card, { info: v, extra: "gray", key: k });
                    })));
            });
        }
    }, [result, current]);
    return (React.createElement("div", { className: "opplist-view" },
        checkOppEnable && (mode === "standard" || mode === "wild")
            ? React.createElement("div", { className: "opplist-rank" },
                React.createElement("div", { className: "records-level" },
                    React.createElement("div", { className: "records-level-pic" },
                        React.createElement("div", { className: `level ${rankMapFunc(+oppInfo.game_end_star_level).id + (rankMapFunc(+oppInfo.game_end_star_level).id === "legend" ? "" : "-" + rankMapFunc(+oppInfo.game_end_star_level).level)}` }, rankMapFunc(+oppInfo.game_end_star_level).level ? React.createElement("i", null, rankMapFunc(+oppInfo.game_end_star_level).level) : null),
                        React.createElement("ul", { className: "records-level-pic-stars" }, rankMapFunc(+oppInfo.game_end_star_level).id !== "legend" ? [1, 2, 3].map((v, i) => {
                            const starNum = +oppInfo.game_end_stars;
                            return (React.createElement("li", { key: i, className: Classnames("records-level-pic-star", { active: starNum >= v }) }));
                        }) : null))),
                React.createElement("div", { className: "opplist-enemy" },
                    React.createElement("p", { className: "opplist-enemy-name" }, enemyBtag),
                    React.createElement("p", { className: "opplist-enemy-value" },
                        "\u672C\u8D5B\u5B63\u80DC\u7387",
                        React.createElement("span", null,
                            calRate(oppInfo.matchnum_win_1 + oppInfo.matchnum_win_2, oppInfo.matchnum_all_1 + oppInfo.matchnum_all_2),
                            "%"),
                        React.createElement("span", { style: { color: "#5EFF3E", marginLeft: "11px" } }, oppInfo.matchnum_win_1 + oppInfo.matchnum_win_2),
                        React.createElement("span", null, "-"),
                        React.createElement("span", { style: { color: "#DE2929" } }, oppInfo.matchnum_all_1 + oppInfo.matchnum_all_2 - (oppInfo.matchnum_win_1 + oppInfo.matchnum_win_2)))))
            : null,
        checkOppEnable && (mode === "arena" || mode === "underground_arena")
            ? React.createElement("div", { className: "opplist-rank" },
                React.createElement("div", { className: "records-level" },
                    React.createElement("div", { className: "records-level-pic" },
                        React.createElement("div", { className: `records-${mode}` }),
                        React.createElement("p", { style: { textAlign: "center" } }, oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.score))),
                React.createElement("div", { className: "opplist-enemy" },
                    React.createElement("p", { className: "opplist-enemy-name" }, enemyBtag),
                    React.createElement("p", { className: "opplist-enemy-value" },
                        "\u672C\u8F6E\u6570\u636E(\u9996\u573A\u4E3A\u4E0A\u8F6E)",
                        React.createElement("span", { style: { color: "#5EFF3E", marginLeft: "11px" } }, oppInfo.wins),
                        React.createElement("span", null, "-"),
                        React.createElement("span", { style: { color: "#DE2929" } }, oppInfo.losses))))
            : null,
        checkOppEnable && mode === "casual"
            ? React.createElement("div", { className: "opplist-rank" },
                React.createElement("div", { className: "opplist-enemy" },
                    React.createElement("p", { className: "opplist-enemy-name" }, enemyBtag),
                    React.createElement("p", { className: "opplist-enemy-value" },
                        "\u672C\u8D5B\u5B63\u80DC\u7387",
                        React.createElement("span", null,
                            calRate(oppInfo.matchnum_win_1 + oppInfo.matchnum_win_2, oppInfo.matchnum_all_1 + oppInfo.matchnum_all_2),
                            "%"),
                        React.createElement("span", { style: { color: "#5EFF3E", marginLeft: "11px" } }, oppInfo.matchnum_win_1 + oppInfo.matchnum_win_2),
                        React.createElement("span", null, "-"),
                        React.createElement("span", { style: { color: "#DE2929" } }, oppInfo.matchnum_all_1 + oppInfo.matchnum_all_2 - (oppInfo.matchnum_win_1 + oppInfo.matchnum_win_2)))))
            : null,
        checkOppEnable
            && (mode === "standard" || mode === "wild" || mode === "arena" || mode === "underground_arena" || mode === "casual")
            && ((_a = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.last_three) === null || _a === void 0 ? void 0 : _a.length)
            ? React.createElement(React.Fragment, null,
                React.createElement("p", { className: "opplist-last3-title" }, "\u8FD13\u573A\u6BD4\u8D5B\u80DC\u7387"),
                React.createElement("ul", { className: "opplist-last3-list" }, (_b = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.last_three) === null || _b === void 0 ? void 0 : _b.map((item, i) => {
                    return (React.createElement("li", { className: "opplist-last3-item", key: i },
                        React.createElement("div", { className: `hero hero-${HERO_CLASS_MAP[item === null || item === void 0 ? void 0 : item.hero_class_1]}` }),
                        (item === null || item === void 0 ? void 0 : item.went_first) ? "先" : "后",
                        "-",
                        (item === null || item === void 0 ? void 0 : item.won_game) ? React.createElement("span", { style: { color: "#5EFF3E" } }, "\u80DC") : React.createElement("span", { style: { color: "#DE2929" } }, "\u8D1F")));
                })))
            : null,
        (oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.meet_count)
            ? React.createElement("div", { className: "opplist-joy" },
                React.createElement("p", { style: { color: "rgba(255, 255, 255, 0.6)", marginBottom: "6px" } },
                    "\u4F60\u4E0E\u4ED6\u5BF9\u6218\u7684\u80DC\u7387\uFF1A",
                    React.createElement("span", { style: { color: "#fff" } },
                        calRate((_c = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.win_count) !== null && _c !== void 0 ? _c : 0, (_d = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.meet_count) !== null && _d !== void 0 ? _d : 0),
                        "%"),
                    " ",
                    React.createElement("span", { style: { color: "#5EFF3E" } }, oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.win_count),
                    "-",
                    React.createElement("span", { style: { color: "#DE2929" } }, ((_e = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.meet_count) !== null && _e !== void 0 ? _e : 0) - ((_f = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.win_count) !== null && _f !== void 0 ? _f : 0))),
                React.createElement("p", { style: { color: "#FFC768", opacity: "0.8" } },
                    "\u8FD9\u662F\u4F60\u672C\u8D5B\u5B63\u7B2C",
                    +(oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.meet_count) + 1,
                    "\u6B21\u9047\u5230\u4ED6\uFF01"))
            : null,
        (mode === "arena" || mode === "underground_arena") ? null
            : knownLen < 3 || error !== ''
                ? React.createElement("div", { className: "opplist-ps" }, "\u5BF9\u624B\u5C55\u793A\u5361\u724C\u6570\u91CF\u8D85\u8FC73\u5F20\uFF0CBOX\u541B\u624D\u80FD\u731C\u51FA\u5BF9\u65B9\u662F\u4EC0\u4E48\u5361\u7EC4\u54E6\uFF5E")
                : loading
                    ? React.createElement("div", { className: "opplist-ps" }, "\u667A\u80FD\u5339\u914D\u4E2D...")
                    : !result.length && knownLen >= 3
                        ? React.createElement("div", { className: "opplist-ps" }, "\u4EC0\u4E48\uFF0C\u5C31\u8FDEBOX\u541B\u4E5F\u731C\u4E0D\u900F\u5BF9\u624B\u7684\u5361\u7EC4\uFF01\uFF1F")
                        : React.createElement(Fragment, null,
                            newGroup ? React.createElement("div", { className: "opplist-btn", onClick: handleUpdateCg },
                                React.createElement("i", null),
                                "\u6709\u66F4\u63A5\u8FD1\u7684\u5361\u7EC4") : React.createElement("p", { className: "ladder-p-text", style: { marginBottom: "5px" } }, "\u5DF2\u5339\u914D\u51FA\u6700\u63A5\u8FD1\u7684\u5361\u7EC4"),
                            groupTab,
                            React.createElement("div", { className: "ladder-main-wrap", style: { maxHeight: checkOppEnable ? ((_g = oppInfo === null || oppInfo === void 0 ? void 0 : oppInfo.last_three) === null || _g === void 0 ? void 0 : _g.length) ? "390px" : "440px" : "590px" } }, groupDetail)),
        React.createElement("p", { className: "opplist-tips" },
            "\u5BF9\u65B9\u5DF2\u5C55\u793A\u5361\u724C\uFF1A",
            React.createElement("b", { className: "z-Brand" },
                knownLen,
                "\u5F20"),
            React.createElement(Tooltip, { placement: "top", overlay: React.createElement("p", { style: { lineHeight: "26px" } }, "\u6309\u5DF2\u5C55\u793A\u5361\u724C\u731C\u6D4B\u5C55\u793A\u5BF9\u624B\u53EF\u80FD\u7684\u5361\u7EC4\uFF0C\u975E\u5BF9\u624B\u5F53\u524D\u5361\u7EC4\u3002"), overlayClassName: "z-white" },
                React.createElement("b", { className: "i-tips" })))));
}
