import React, { useEffect, useCallback, useState, useMemo } from "react";
import "./index.scss";
import Wrapper from "@/components/wrapper";
import Card from "@/components/card";
import { loadScript, analysisCg, parseUrlSearch } from "@/utils";
import _ from "lodash";
export default function VideoCemetery() {
    const { type } = parseUrlSearch();
    const [my, setMy] = useState({ sort: 0, list: [] });
    const handleChangeSort = useCallback((sort) => {
        const myTemp = Object.assign({}, my);
        myTemp.sort = sort;
        setMy(myTemp);
    }, [my]);
    const wasterCard = useCallback((myData) => {
        const myTemp = Object.assign({}, my);
        myData.forEach((item) => {
            myTemp.list.push(item);
        });
        setMy(myTemp);
    }, [my]);
    const fwasterCard = useCallback((list) => {
        let my = [];
        let magic = 0;
        list.map((item) => {
            let curtype = item.split('|')[1];
            console.log("curtype", curtype, "type", type);
            let card = item.split('|')[0];
            let isYsk = 0;
            let id;
            if (card.indexOf(':') > -1) {
                id = card.split(':')[0];
                isYsk = parseInt(card.split(':')[1], 10);
            }
            else {
                id = card;
            }
            if (!window.HSCARDS || !window.HSCARDS[id] || window.HSCARDS[id]['Class'] == '-1') {
                return;
            }
            let o = {};
            o[id] = isYsk;
            if ((curtype == 0 && type == "mine") || (curtype == 1 && type == "opp")) {
                if (window.HSCARDS[id]['CardType'] == 5) {
                    magic++;
                }
                my.push(o);
            }
        });
        wasterCard(my);
    }, [wasterCard]);
    useEffect(() => {
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.min.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.min.js", () => {
            console.log("load hscard");
        });
    }, []);
    useEffect(() => {
        window.fWasterCard = fwasterCard;
    }, [fwasterCard]);
    const dom = useMemo(() => {
        const target = my;
        let wasteString = '';
        let wastecg;
        const cglist = [];
        let cg = {};
        target.list.forEach((item) => {
            let id = _.keys(item)[0];
            let val = _.values(item)[0];
            if (target.sort === 0) {
                cglist.push(id + ':' + val);
            }
            else {
                if (!cg[id]) {
                    cg[id] = 0;
                }
                cg[id]++;
            }
        });
        if (target.sort == 0) {
            wasteString = cglist.join(',');
            wastecg = analysisCg(wasteString, { ysk: true, sort: false });
            wastecg.list.reverse();
        }
        else {
            wasteString = JSON.stringify(cg).replace(/^\{|\}$/g, '').replace(/\"/g, '');
            wastecg = analysisCg(wasteString);
        }
        console.log(wastecg);
        return (React.createElement("div", { style: { height: `calc(100% - 140px)` } },
            React.createElement("div", { className: "mudi-p-text" },
                React.createElement("span", null,
                    "\u724C\u6570\uFF1A",
                    target.list.length),
                React.createElement("ul", null,
                    React.createElement("i", { className: "mudi-sort" }),
                    React.createElement("li", { className: target.sort === 0 ? "active" : "", onClick: () => handleChangeSort(0) }, "\u51FA\u724C"),
                    React.createElement("i", { className: "mudi-line" }),
                    React.createElement("li", { className: target.sort === 1 ? "active" : "", onClick: () => handleChangeSort(1) }, "\u6CD5\u529B"))),
            React.createElement("div", { className: "ladder-main-wrap", style: { height: "634px" } }, wastecg.list.map((item, i) => {
                return React.createElement(Card, { info: item, key: i });
            }))));
    }, [my]);
    return (React.createElement("div", { className: "cemetery-view" },
        React.createElement(Wrapper, { className: "cemetery-wrapper", width: 260 },
            React.createElement("ul", { className: "cemetery-mode" },
                React.createElement("li", { className: "active" },
                    type === "mine" ? "我方" : "对方",
                    "\u575F\u573A")),
            dom)));
}
