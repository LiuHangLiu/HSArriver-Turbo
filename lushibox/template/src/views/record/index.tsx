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
import "./index.scss";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import { HsboxClient, ReadeeCollectDecks } from "@hsbox/api";
import Save from "@/components/save";
export default function Record() {
    const [saveGroup, setSaveGroup] = useState([]);
    const [decklist, setDeckList] = useState([]);
    const [myDeckGroup, setMyDeckGroup] = useState({});
    const onLoad = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const cb = yield ReadeeCollectDecks();
        setSaveGroup((cb === null || cb === void 0 ? void 0 : cb.data) || []);
    }), []);
    useEffect(() => {
        window.fDeckRecord = (data) => setDeckList(data !== null && data !== void 0 ? data : []);
        onLoad().catch(console.log);
        HsboxClient.JsDeckMgrLoaded();
        HsboxClient.upDateEmbeddedMode();
    }, []);
    useEffect(() => {
        const deckGroupBy = {
            0: [],
            1: []
        };
        (decklist !== null && decklist !== void 0 ? decklist : []).forEach((item) => {
            let tag = item['valid'];
            if (tag == true || tag == '1') {
                deckGroupBy[0].push(item);
            }
            else {
                deckGroupBy[1].push(item);
            }
        });
        setMyDeckGroup(deckGroupBy);
    }, [decklist]);
    const list0 = useMemo(() => {
        var _a;
        return (_a = myDeckGroup === null || myDeckGroup === void 0 ? void 0 : myDeckGroup[0]) === null || _a === void 0 ? void 0 : _a.map((item, idx) => {
            let hero = parseInt(item['hero_id'].replace('HERO_', ''));
            return (React.createElement("div", { className: `record-deck-item job hero-l-${hero}`, key: idx },
                React.createElement("div", { className: "record-deck-left" },
                    React.createElement("div", { className: `hero hero-${hero}` }),
                    item.name,
                    React.createElement(Save, { groups: saveGroup, data: item, status: 1 }))));
        });
    }, [decklist, saveGroup, myDeckGroup]);
    const list1 = useMemo(() => {
        var _a;
        return (_a = myDeckGroup === null || myDeckGroup === void 0 ? void 0 : myDeckGroup[1]) === null || _a === void 0 ? void 0 : _a.map((item, idx) => {
            let hero = parseInt(item['hero_id'].replace('HERO_', ''));
            return (React.createElement("div", { className: `record-deck-item job hero-l-${hero}`, key: idx },
                React.createElement("div", { className: "record-deck-left" },
                    React.createElement("div", { className: `hero hero-${hero}` }),
                    item.name)));
        });
    }, [myDeckGroup]);
    return (React.createElement("div", { className: "record-view" },
        React.createElement(Wrapper, { className: "record-wrapper", width: 260 },
            React.createElement("div", { className: "record-main-wrap" },
                React.createElement(Title, { text: "我的套牌" }),
                React.createElement("nav", { className: "record-nav" },
                    React.createElement(Link, { className: "record-nav-item flex-ct-x", to: "/collect" },
                        "\u6536\u85CF\u7BA1\u7406",
                        React.createElement("i", null)),
                    React.createElement("a", { className: "record-nav-item flex-ct-x active" },
                        "\u5957\u724C\u7BA1\u7406",
                        React.createElement("i", null))),
                React.createElement("div", { className: "record-middle" },
                    React.createElement("div", { className: "record-title" },
                        "\u5F53\u524D\u5DF2\u8BB0\u5F55\u5957\u724C ",
                        React.createElement("i", { className: "refresh", onClick: () => location.reload() })),
                    React.createElement("ul", null, list0),
                    React.createElement("div", { className: "record-title" }, "\u5F53\u524D\u672A\u8BB0\u5F55\u5957\u724C"),
                    React.createElement("ul", null, list1)),
                React.createElement("div", { className: "record-bottom" },
                    React.createElement("div", { className: "record-title" }, "\u6E29\u99A8\u63D0\u793A"),
                    React.createElement("p", null,
                        "1.\u5DF2\u8BB0\u5F55\u7684\u5957\u724C\u624D\u80FD\u5728\u961F\u9635\u4E2D\u4F7F\u7528\u8BB0\u724C\u5668\u529F\u80FD\uFF0C\u82E5\u5957\u724C\u4E0D\u6EE130\u5F20\uFF0C\u5219\u65E0\u6CD5\u88AB\u76D2\u5B50\u8BB0\u5F55\u3002",
                        React.createElement("br", null),
                        "2.\u5DF2\u6536\u85CF\u7684\u5361\u7EC4\uFF0C\u53EF\u5728\u7089\u77F3\u76D2\u5B50\u201C\u5361\u7EC4\u901F\u9012-\u6211\u7684\u6536\u85CF\u201D\u91CC\u67E5\u770B\u3002"))))));
}
