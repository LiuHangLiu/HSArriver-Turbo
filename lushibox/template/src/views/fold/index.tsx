import React, { useEffect, useState } from "react";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import Card from "@/components/card";
import { loadScript } from "@/utils";
import extend from "extend";
import "./index.scss";
import "rc-tooltip/assets/bootstrap_white.css";
export default function Arena() {
    var _a;
    const [guide, setGuide] = useState([]);
    const [hscardsReady, setHscardsReady] = useState(false);
    const [myGuideList, setMyGuideList] = useState([]);
    const toPercentage = (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            throw new Error('输入必须是一个有效的数字');
        }
        const percentage = num * 100;
        const [integerPart, decimalPart = ''] = percentage.toString().split('.');
        let fractionalDigits = '0';
        if (decimalPart.length > 0) {
            fractionalDigits = decimalPart.charAt(0);
        }
        return `${integerPart}.${fractionalDigits}%`;
    };
    useEffect(() => {
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards2.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards2.js", () => {
            window.HSCARDS_2 = window.HSCARDS;
            loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.ana.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.ana.js", () => {
                window.HSCARDS = extend(true, {}, window.HSCARDS, window.HSCARDS_2);
                setHscardsReady(true);
            });
        });
    }, []);
    useEffect(() => {
        window.foldRecommend = (guideList) => {
            console.log("推荐套牌：", guideList);
            setGuide(guideList);
        };
    }, [setGuide]);
    useEffect(() => {
        if (!(hscardsReady))
            return;
        let guideList = [];
        guide.forEach((item) => {
            if (!window.HSCARDS[item] || window.HSCARDS[item]["class"] == "-1") {
                return;
            }
            let card = Object.assign({}, window.HSCARDS[item]);
            if (window.HSCARDS && card) {
                card["discard_percentage"] = card.discard_percentage ? toPercentage(card.discard_percentage) : "-";
            }
            else {
                card["discard_percentage"] = "-";
            }
            guideList.push(card);
        });
        guideList.sort((a, b) => {
            const parseValue = (val) => val === "-" ? 0 : parseFloat(val.replace('%', ''));
            const valueA = parseValue(a.discard_percentage);
            const valueB = parseValue(b.discard_percentage);
            return valueB - valueA;
        });
        console.log("Sorted guideList", [...guideList]);
        setMyGuideList([...guideList]);
    }, [hscardsReady, guide]);
    return (React.createElement("div", { className: "fold-view" },
        React.createElement(Wrapper, { className: "fold-wrapper", width: 260 },
            React.createElement(Title, { text: "弃牌推荐" }),
            React.createElement("div", { className: "fold-content" },
                React.createElement("div", { className: "fold-percentage" },
                    React.createElement("span", null, "\u66FF\u6362\u7387"),
                    React.createElement("i", { className: "fold-percentage-icon" })),
                myGuideList.length ? ((_a = myGuideList === null || myGuideList === void 0 ? void 0 : myGuideList.splice(0, 10)) === null || _a === void 0 ? void 0 : _a.map((item, i) => {
                    return React.createElement(Card, { info: item, key: i, showDiscardPercentage: true });
                })) : null))));
}
