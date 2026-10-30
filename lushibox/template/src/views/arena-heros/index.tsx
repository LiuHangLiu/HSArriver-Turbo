import React, { useEffect, useState, useMemo } from "react";
import "../environment/index.scss";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import { loadScript, ENG_HERO_MAP, HERO_CN_MAP, parseUrlSearch } from "@/utils";
import SwitchFilter from "@/components/switch-filter";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
const { modeType } = parseUrlSearch();
export default function ArenaHeros() {
    const { myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const { fullscreen } = parseUrlSearch();
    const initTime = { name: "过去12小时", id: "1d" };
    const initType = { name: "热度最高", id: "pickrate" };
    const [heroReady, setHeroReady] = useState(false);
    const [targetTab, setTargetTab] = useState(0);
    const [heroTimeFilter, setHeroTimeFilter] = useState(initTime.id);
    const [heroTypeFilter, setHeroTypeFilter] = useState(initType.id);
    const [type, setType] = useState((modeType !== "GT_ARENA" && modeType !== "GT_UNDERGROUND_ARENA") ? "GT_ARENA" : modeType);
    const calStars = (winItem, useItem, upItem) => {
        return ((winItem / useItem) - ((useItem - winItem) / useItem)) * (60 / (upItem / 60));
    };
    const toPercentage = (num) => {
        return (num * 100).toFixed(1) + '%';
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
            ? "https://hs2.166.net/hs-public-data/hs_data/ld2_card_group_statistics/arena_card_class_statistics.js"
            : "https://hs2.166.net/hs-public-data/hs_data/ld2_card_group_statistics/arena_card_class_statistics_test.js", () => {
            setHeroReady(true);
            console.log(window.ARENA_CARD_CLASS_STATISTICS);
        });
    }, []);
    useEffect(() => {
        window.onChangeTargetTab = setTargetTab;
        window.fSetMode = (mode) => {
            setType(mode);
        };
    }, [setTargetTab]);
    const filter = useMemo(() => {
        const timeFilter = [{ name: "过去12小时", id: "1d" }, { name: "过去3天", id: "3d" }, { name: "过去7天", id: "7d" }, { name: "过去30天", id: "30d" }];
        const typeFilter = [{ name: "热度最高", id: "pickrate" }, { name: "胜率最高", id: "winrate" }, { name: "均胜场最高", id: "uprate" }];
        return (React.createElement("div", null,
            React.createElement("div", { className: "environment-filter" },
                React.createElement(SwitchFilter, { list: timeFilter, init: initTime, callback: str => setHeroTimeFilter(str) }),
                React.createElement(SwitchFilter, { list: typeFilter, init: initType, callback: str => setHeroTypeFilter(str) }))));
    }, [targetTab, myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const list = useMemo(() => {
        var _a, _b, _c;
        if (!heroReady) {
            return null;
        }
        else {
            let heroTemp = [...window.ARENA_CARD_CLASS_STATISTICS];
            const totalUseCn = (_a = heroTemp === null || heroTemp === void 0 ? void 0 : heroTemp.filter(v => v.game_type === type)) === null || _a === void 0 ? void 0 : _a.reduce((a, b) => {
                return a + b[`select_cnt_${heroTimeFilter}`];
            }, 0);
            console.log(totalUseCn, heroTimeFilter);
            return (_c = (_b = heroTemp === null || heroTemp === void 0 ? void 0 : heroTemp.filter(v => v.game_type === type)) === null || _b === void 0 ? void 0 : _b.sort((a, b) => {
                const winA = a[`win_cnt_${heroTimeFilter}`];
                const winB = b[`win_cnt_${heroTimeFilter}`];
                const selectA = a[`select_cnt_${heroTimeFilter}`];
                const selectB = b[`select_cnt_${heroTimeFilter}`];
                const totalA = a[`game_cnt_${heroTimeFilter}`];
                const totalB = b[`game_cnt_${heroTimeFilter}`];
                return heroTypeFilter === "winrate"
                    ? (winB / totalB - winA / totalA)
                    : heroTypeFilter === "pickrate"
                        ? selectB - selectA : (winB / selectB - winA / selectA);
            })) === null || _c === void 0 ? void 0 : _c.map((item, i) => {
                const winItem = item[`win_cnt_${heroTimeFilter}`];
                const selectItem = item[`select_cnt_${heroTimeFilter}`];
                const totalItem = item[`game_cnt_${heroTimeFilter}`];
                return React.createElement("div", { className: "environment-flex", key: i },
                    React.createElement("div", { className: "environment-flex-left" },
                        React.createElement("i", { className: `environment-hero hero hero-${HERO_CN_MAP[ENG_HERO_MAP[item.hero.toLocaleLowerCase()]]}` }),
                        ENG_HERO_MAP[item.hero.toLocaleLowerCase()]),
                    heroTypeFilter !== "uprate"
                        ? React.createElement("div", { className: "environment-rate" },
                            React.createElement("div", { className: "environment-rate-bar", style: { "width": heroTypeFilter === "winrate" ? toPercentage(winItem / totalItem) : toPercentage(selectItem / totalUseCn) } }),
                            React.createElement("p", { className: "environment-rate-value" }, (heroTypeFilter === "winrate" ? toPercentage(winItem / totalItem) : toPercentage(selectItem / totalUseCn))))
                        : React.createElement("div", { className: "environment-stars", style: { width: "100px", justifyContent: "center" } },
                            (winItem / selectItem).toFixed(2),
                            "\u573A"));
            });
        }
    }, [targetTab, heroTimeFilter, heroTypeFilter, type, heroReady, myBtag, myDeviceId, myUrs, dataSource, positionType]);
    return (React.createElement("div", { className: "environment-view" },
        React.createElement(Wrapper, { className: "environment-wrapper", width: 260, fullscreen: !!fullscreen },
            React.createElement(Title, { text: type === "GT_ARENA" ? "地上竞技场模式环境" : "地下竞技场模式环境" }),
            React.createElement("nav", { className: "environment-nav" },
                React.createElement("a", { className: "environment-nav-item flex-ct-x active", onClick: () => setTargetTab(1) },
                    "\u804C\u4E1A\u5360\u6BD4",
                    React.createElement("i", null))),
            filter,
            React.createElement("div", { className: "environment-ul" }, list))));
}
