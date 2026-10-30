import React, { useEffect, useRef, useState, useMemo, useCallback, } from "react";
import extend from "extend";
import _ from "lodash";
import Card from "@/components/card";
export default function CollectDetailList({ isHave, isHigh, data }) {
    const [totalList, setTotalList] = useState([]);
    const [showList, setShowList] = useState([]);
    const [pageSum, setPageSum] = useState(0);
    const [curPage, setCurPage] = useState(1);
    const listRef = useRef(null);
    const handleScroll = useCallback(() => {
        const clientHeight = listRef.current.clientHeight;
        const scrollTop = listRef.current.scrollTop;
        const scrollHeight = listRef.current.scrollHeight;
        if (clientHeight + scrollTop == scrollHeight) {
            console.log("curPage: ", curPage);
            if (curPage < pageSum) {
                setCurPage(curPage + 1);
            }
        }
    }, [curPage, totalList, pageSum]);
    useEffect(() => {
        let list = [];
        let goldObj = {};
        let usualObj = {};
        data[isHave][isHigh].list.map((item) => {
            if (window.HSCARDS[item.id]) {
                window.HSCARDS[item.id]['Cost'] = parseInt(window.HSCARDS[item.id]['Cost'], 10);
                if (item.gold == 1) {
                    goldObj[item.id] = item;
                }
                if (item.gold == 0) {
                    usualObj[item.id] = item;
                }
            }
        });
        data[isHave][isHigh].list.map((item, idx) => {
            if (window.HSCARDS[item.id]) {
                if (item.gold == 0 && goldObj[item.id]) {
                    item['total'] = item['num'] + goldObj[item.id]['num'];
                }
                else if (item.gold == 1 && usualObj[item.id]) {
                    item['total'] = item['num'] + usualObj[item.id]['num'];
                }
                else {
                    item['idx'] = idx;
                    item['total'] = item['num'];
                }
                list.push(extend(true, {}, item, window.HSCARDS[item.id]));
            }
        });
        list = _.sortBy(list, 'id');
        list = _.sortBy(list, 'total').reverse();
        list = _.sortBy(list, 'Cost');
        setTotalList(list);
        console.log(data[isHave][isHigh].list.length);
        console.log("list", list);
    }, [isHave, isHigh, data]);
    useEffect(() => {
        const pageSize = 50;
        let diff = totalList.length - pageSize;
        let totalPage = diff > 0 ? Math.ceil(totalList.length / 50) : 1;
        const total = curPage * pageSize;
        setPageSum(totalPage);
        setShowList(totalList.length > total ? totalList.slice(0, total) : totalList);
    }, [totalList, curPage]);
    const domRes = useMemo(() => {
        return showList.map((v, i) => React.createElement(Card, { key: i, info: v }));
    }, [showList]);
    return React.createElement("div", { className: "collect-detail-list", onScroll: handleScroll, ref: listRef }, domRes);
}
