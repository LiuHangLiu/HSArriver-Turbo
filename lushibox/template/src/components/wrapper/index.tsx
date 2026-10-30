var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { useEffect, useState } from "react";
import React from "react";
import Classnames from "classnames";
import { HsboxClient } from "@hsbox/api";
import { STORE, SetStore } from "@/stores";
import { useSnapshot } from "valtio";
import { parseUrlSearch } from "@/utils";
import "./index.scss";
const { lang } = parseUrlSearch();
const langV = (lang !== "zh" && lang !== "en") ? "zh" : lang;
export default function Wrapper({ children = "", className = "", nologo = false, width, fullscreen }) {
    const { isLeftAreaEnabled, isRightAreaEnabled, extraWidth, expandPanelEnabled } = useSnapshot(STORE);
    const [text, setText] = useState();
    const [icon, setIcon] = useState();
    const [hideSwitch, setHideSwitch] = useState(true);
    const [forbidSwitch, setForbidSwitch] = useState(true);
    const [switchText, setSwitchText] = useState();
    const extraAllWidth = (isLeftAreaEnabled ? extraWidth : 0) + (isRightAreaEnabled ? extraWidth : 0);
    const style = fullscreen ? { width: "100%" } : (expandPanelEnabled && extraAllWidth) ? ({ width: `calc(100% - ${extraAllWidth + 'px'})` }) : (width ? { width: `${width}px` } : {});
    const loadVersion = () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { category } = yield HsboxClient.getVersion();
        const mapper = {
            "hsang": langV === "zh" ? "该功能由网易炉石盒子提供" : "Provided by NetEase Hearthstone Box",
            "hsang_ta": "功能由炉石盒子和网易大神共同提供"
        };
        setText((_a = mapper === null || mapper === void 0 ? void 0 : mapper[category]) !== null && _a !== void 0 ? _a : (langV === "zh" ? "该功能由网易炉石盒子提供" : "Provided by NetEase Hearthstone Box"));
        setIcon(category === "hsang_ta" ? "icon-ta" : "icon-hsbox");
    });
    useEffect(() => {
        loadVersion().catch(() => console.log("err"));
        window.showSwitchBtn = (state, vaild) => {
            setHideSwitch(!state);
            setForbidSwitch(!vaild);
        };
        window.setSwitchText = (text) => {
            var _a;
            const textMapper = {
                "切换外挂": "切换外置",
                "切换内嵌": "切换内嵌"
            };
            setSwitchText((_a = textMapper[text]) !== null && _a !== void 0 ? _a : text);
            SetStore("positionType", text === "切换外挂" ? 1 : 2);
        };
    }, []);
    return React.createElement("div", { className: Classnames("wrapper-component", className, { nologo }), style: Object.assign(Object.assign({}, style), (expandPanelEnabled ? { position: "fixed", left: `${isLeftAreaEnabled ? extraWidth : 0}px`, top: 0 } : {})) },
        React.createElement("p", { className: "wrapper-component-top" },
            React.createElement("i", { className: "icon-hsbox" }),
            langV === "zh" ? "网易炉石传说盒子" : "NetEase Hearthstone Box",
            hideSwitch ? null : React.createElement("span", { title: forbidSwitch ? "游戏全屏状态，记牌器默认内嵌，无法切换外置效果" : undefined, className: Classnames("wrapper-component-top-switch", { disabled: forbidSwitch }), onClick: () => !forbidSwitch && HsboxClient.switchEmbeddedMode() },
                React.createElement("em", null),
                switchText)),
        children,
        nologo ? null : React.createElement("p", { className: "wrapper-component-bottom", style: { fontSize: langV === "en" ? "12px" : "inherit" } },
            React.createElement("i", { className: icon }),
            text));
}
