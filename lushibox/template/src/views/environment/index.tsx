import React, { useEffect, useCallback, useState, useMemo } from "react";
import Classnames from "classnames";
import "./index.scss";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import Toast from "@/components/Toast";
import { loadScript, GAME_MODE, ENG_HERO_MAP, parseUrlSearch } from "@/utils";
import CopyToClipboard from "react-copy-to-clipboard";
import SwitchFilter from "@/components/switch-filter";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
import PAGE_TEXT from "../../i18n";
const { modeType, fullscreen, lang } = parseUrlSearch();
export default function Environment() {
    const { myDeviceId, myBtag, myUrs, dataSource, positionType, copyDeckTip } = useSnapshot(STORE);
    const initTime = { name: PAGE_TEXT["过去12小时"], id: "1d" };
    const initRank = { name: PAGE_TEXT["传说分段"], id: "legend" };
    const initType = { name: PAGE_TEXT["选取率最高"], id: "pickrate" };
    const [groupReady, setGroupReady] = useState(false);
    const [heroReady, setHeroReady] = useState(false);
    const [targetTab, setTargetTab] = useState(0);
    const [groupTimeFilter, setGroupTimeFilter] = useState(initTime.id);
    const [groupRankFilter, setGroupRankFilter] = useState(initRank.id);
    const [groupTypeFilter, setGroupTypeFilter] = useState(initType.id);
    const [heroTimeFilter, setHeroTimeFilter] = useState(initTime.id);
    const [heroRankFilter, setHeroRankFilter] = useState(initRank.id);
    const [heroTypeFilter, setHeroTypeFilter] = useState(initType.id);
    const [type, setType] = useState((modeType !== "FT_STANDARD" && modeType !== "FT_WILD") ? "FT_STANDARD" : modeType);
    const calStars = (winItem, useItem, upItem) => {
        if (useItem === 0 || upItem === 0)
            return 0;
        return ((winItem / useItem) - ((useItem - winItem) / useItem)) * (60 / (upItem / 60));
    };
    const toPercentage = (num) => {
        const result = num * 100;
        if (isNaN(result) || !isFinite(result))
            return '0.0%';
        return result.toFixed(1) + '%';
    };
    const formatMatchCount = (count) => {
        count = Number(count);
        if (isNaN(count) || count < 0) {
            return '0';
        }
        if (count < 100) {
            return count.toString();
        }
        else if (count < 10000) {
            return (count >= 1000) ?
                (Math.floor(count / 100) / 10).toFixed(1) + 'k' :
                count.toString();
        }
        else {
            return (Math.floor(count / 1000) / 10).toFixed(1) + 'w';
        }
    };
    useEffect(() => {
        loadScript(RUN_ENV === "prod"
            ? "https://hs2.166.net/hs-public-data/hs_data/ld2_card_group_statistics/card_group_all_v2.js"
            : "https://hs2.166.net/hs-public-data/hs_data/ld2_card_group_statistics/card_group_all_v2_test.js", () => {
            if (Array.isArray(window.CARD_GROUP_STATISTICS)) {
                setGroupReady(true);
            }
        });
        loadScript(RUN_ENV === "prod"
            ? "https://hs2.166.net/hs-public-data/hs_data/ld2_card_group_statistics/hero_statistics_v2.js"
            : "https://hs2.166.net/hs-public-data/hs_data/ld2_card_group_statistics/hero_statistics_v2_test.js", () => {
            if (Array.isArray(window.HERO_STATISTICS)) {
                setHeroReady(true);
            }
            console.log(window.HERO_STATISTICS);
        });
    }, []);
    useEffect(() => {
        window.onChangeTargetTab = setTargetTab;
        window.fSetMode = (mode) => {
            if (!GAME_MODE[mode])
                return;
            setType(GAME_MODE[mode].key);
        };
    }, [setTargetTab]);
    const nsRecord = useCallback((type, from, content) => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            game_type: 1,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            button_id: type,
            from_part: from,
            from_type: 1,
            select_detail: content,
            position_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", "clk_new_2_391_20", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const filter = useMemo(() => {
        const timeFilter = [{ name: PAGE_TEXT["过去12小时"], id: "1d" }, { name: PAGE_TEXT["过去3天"], id: "3d" }, { name: PAGE_TEXT["过去7天"], id: "7d" }, { name: PAGE_TEXT["过去30天"], id: "30d" }];
        const levelFilter = [{ name: PAGE_TEXT["传说分段"], id: "legend" }, { name: PAGE_TEXT["传说前1000"], id: "legend_top_1000" }, { name: PAGE_TEXT["钻石4-钻石1"], id: "diamond1" }, { name: PAGE_TEXT["钻石10-钻石5"], id: "diamond2" }, { name: PAGE_TEXT["其余段位"], id: "other" }];
        const typeFilter = [{ name: PAGE_TEXT["胜率最高"], id: "winrate" }, { name: PAGE_TEXT["选取率最高"], id: "pickrate" }, { name: PAGE_TEXT["上分最快"], id: "uprate" }];
        return (React.createElement("div", null,
            React.createElement("div", { className: Classnames("environment-filter", { hidden: targetTab !== 0 }) },
                React.createElement(SwitchFilter, { list: timeFilter, init: initTime, callback: str => { setGroupTimeFilter(str); nsRecord(2, 1, str); } }),
                React.createElement(SwitchFilter, { list: levelFilter, init: initRank, callback: str => { setGroupRankFilter(str); nsRecord(3, 1, str); } }),
                React.createElement(SwitchFilter, { list: typeFilter, init: initType, callback: str => { setGroupTypeFilter(str); nsRecord(4, 1, str); } })),
            React.createElement("div", { className: Classnames("environment-filter", { hidden: targetTab !== 1 }) },
                React.createElement(SwitchFilter, { list: timeFilter, init: initTime, callback: str => { setHeroTimeFilter(str); nsRecord(2, 2, str); } }),
                React.createElement(SwitchFilter, { list: levelFilter, init: initRank, callback: str => { setHeroRankFilter(str); nsRecord(3, 2, str); } }),
                React.createElement(SwitchFilter, { list: typeFilter, init: initType, callback: str => { setHeroTypeFilter(str); nsRecord(4, 2, str); } }))));
    }, [targetTab, myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const list = useMemo(() => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!groupReady || !heroReady) {
            return null;
        }
        else if (targetTab === 0) {
            try {
                let cardGroupTemp = [...window.CARD_GROUP_STATISTICS];
                return (_d = (_c = (_b = (_a = cardGroupTemp === null || cardGroupTemp === void 0 ? void 0 : cardGroupTemp.filter(v => v.format_type === type)) === null || _a === void 0 ? void 0 : _a.filter((v) => {
                    const useItem = v[`use_cnt_${groupTimeFilter}`];
                    return useItem >= 100;
                })) === null || _b === void 0 ? void 0 : _b.filter(v => {
                    return v.level_type === groupRankFilter;
                })) === null || _c === void 0 ? void 0 : _c.sort((a, b) => {
                    const winA = a[`win_cnt_${groupTimeFilter}`];
                    const winB = b[`win_cnt_${groupTimeFilter}`];
                    const useA = a[`use_cnt_${groupTimeFilter}`];
                    const useB = b[`use_cnt_${groupTimeFilter}`];
                    const upA = a[`battle_avg_time_${groupTimeFilter}`];
                    const upB = b[`battle_avg_time_${groupTimeFilter}`];
                    const starsA = calStars(winA, useA, upA);
                    const starsB = calStars(winB, useB, upB);
                    return groupTypeFilter === "winrate"
                        ? (winB / useB - winA / useA)
                        : groupTypeFilter === "pickrate"
                            ? useB - useA : starsB - starsA;
                })) === null || _d === void 0 ? void 0 : _d.map((item, i) => {
                    var _a;
                    const winItem = item[`win_cnt_${groupTimeFilter}`];
                    const useItem = item[`use_cnt_${groupTimeFilter}`];
                    const totalItem = item[`total_cnt_${groupTimeFilter}`];
                    const upItem = item[`battle_avg_time_${groupTimeFilter}`];
                    const stars = calStars(winItem, useItem, upItem);
                    return React.createElement("div", { className: "environment-flex", key: i },
                        React.createElement("div", { className: "environment-flex-left" },
                            React.createElement("i", { className: `environment-hero hero hero-${item.title === "酷炫威兹班" ? "unknown" : +item.job}` }),
                            React.createElement("span", { style: { "flexGrow": "0", "maxWidth": "70px" } }, lang === "en" ? ((_a = item.title_en) !== null && _a !== void 0 ? _a : item.title) : item.title),
                            React.createElement(CopyToClipboard, { text: `### ${item.title}\n${item.cipher}\n#${copyDeckTip}`, onCopy: () => {
                                    Toast({ text: "已复制到剪贴板", postion: "bottom", delay: 3000 });
                                    nsRecord(1, undefined, undefined);
                                } },
                                React.createElement("span", { className: "environment-copy" }))),
                        groupTypeFilter !== "uprate"
                            ? React.createElement("div", { className: "environment-rate" },
                                React.createElement("div", { className: "environment-rate-bar", style: { "width": groupTypeFilter === "winrate" ? toPercentage(winItem / useItem) : toPercentage(useItem / totalItem) } }),
                                React.createElement("p", { className: "environment-rate-value" }, (groupTypeFilter === "winrate" ? toPercentage(winItem / useItem) : toPercentage(useItem / totalItem)) + " " + formatMatchCount(useItem) + PAGE_TEXT["场"]))
                            : React.createElement("div", { className: "environment-stars" }, stars === null || stars === void 0 ? void 0 :
                                stars.toFixed(2),
                                React.createElement("i", null),
                                "/",
                                PAGE_TEXT["时"]));
                });
            }
            catch (e) {
                console.error("[Environment] card-group data processing error:", e);
                return [];
            }
        }
        else {
            try {
                let heroTemp = [...window.HERO_STATISTICS];
                return (_g = (_f = (_e = heroTemp === null || heroTemp === void 0 ? void 0 : heroTemp.filter(v => v.format_type === type)) === null || _e === void 0 ? void 0 : _e.filter(v => v.level_type === heroRankFilter)) === null || _f === void 0 ? void 0 : _f.sort((a, b) => {
                    const winA = a[`win_cnt_${heroTimeFilter}`];
                    const winB = b[`win_cnt_${heroTimeFilter}`];
                    const useA = a[`use_cnt_${heroTimeFilter}`];
                    const useB = b[`use_cnt_${heroTimeFilter}`];
                    const upA = a[`battle_avg_time_${heroTimeFilter}`];
                    const upB = b[`battle_avg_time_${heroTimeFilter}`];
                    const starsA = calStars(winA, useA, upA);
                    const starsB = calStars(winB, useB, upB);
                    return heroTypeFilter === "winrate"
                        ? (winB / useB - winA / useA)
                        : heroTypeFilter === "pickrate"
                            ? useB - useA : starsB - starsA;
                })) === null || _g === void 0 ? void 0 : _g.map((item, i) => {
                    const winItem = item[`win_cnt_${heroTimeFilter}`];
                    const useItem = item[`use_cnt_${heroTimeFilter}`];
                    const totalItem = item[`total_cnt_${heroTimeFilter}`];
                    const upItem = item[`battle_avg_time_${heroTimeFilter}`];
                    const stars = calStars(winItem, useItem, upItem);
                    return React.createElement("div", { className: "environment-flex", key: i },
                        React.createElement("div", { className: "environment-flex-left" },
                            React.createElement("i", { className: `environment-hero hero hero-${item.hero}` }),
                            React.createElement("span", { style: { fontSize: "12px" } }, PAGE_TEXT[ENG_HERO_MAP[item.hero]])),
                        heroTypeFilter !== "uprate"
                            ? React.createElement("div", { className: "environment-rate" },
                                React.createElement("div", { className: "environment-rate-bar", style: { "width": heroTypeFilter === "winrate" ? toPercentage(winItem / useItem) : toPercentage(useItem / totalItem) } }),
                                React.createElement("p", { className: "environment-rate-value" }, (heroTypeFilter === "winrate" ? toPercentage(winItem / useItem) : toPercentage(useItem / totalItem)) + " " + formatMatchCount(useItem) + PAGE_TEXT["场"]))
                            : React.createElement("div", { className: "environment-stars" }, stars === null || stars === void 0 ? void 0 :
                                stars.toFixed(2),
                                React.createElement("i", null),
                                "/\u65F6"));
                });
            }
            catch (e) {
                console.error("[Environment] hero data processing error:", e);
                return [];
            }
        }
    }, [targetTab, groupTimeFilter, groupRankFilter, groupTypeFilter, heroTimeFilter, heroRankFilter, heroTypeFilter, type, groupReady, heroReady, myBtag, myDeviceId, myUrs, dataSource, positionType]);
    return (React.createElement("div", { className: "environment-view" },
        React.createElement(Wrapper, { className: "environment-wrapper", width: 260, fullscreen: !!fullscreen },
            React.createElement(Title, { text: PAGE_TEXT["当前模式环境"] }),
            React.createElement("nav", { className: "environment-nav" },
                React.createElement("a", { className: Classnames("environment-nav-item flex-ct-x", { active: targetTab === 0 }), onClick: () => setTargetTab(0) },
                    PAGE_TEXT["卡组占比"],
                    React.createElement("i", null)),
                React.createElement("a", { className: Classnames("environment-nav-item flex-ct-x", { active: targetTab === 1 }), onClick: () => setTargetTab(1) },
                    PAGE_TEXT["职业占比"],
                    React.createElement("i", null))),
            filter,
            React.createElement("div", { className: "environment-ul" }, list))));
}
