import Classnames from "classnames";
import React, { useCallback } from "react";
import Tooltip from "rc-tooltip";
import NumAnimate from "@/components/num-animate";
import { HsboxClient } from "@hsbox/api";
import { useSnapshot } from "valtio";
import { STORE, SetStore } from "@/stores";
import { debouncedShowCard, showCard } from "@/utils";
import "rc-tooltip/assets/bootstrap_white.css";
import "./index.scss";
const RARITY_MAP = {
    1: 40,
    2: 0,
    3: 100,
    4: 400,
    5: 1600
};
let CARDSET_MAP = {};
export default function Card({ animateNode, info, extra = "", associated = false, customDirection = "", showDiscardPercentage = false, hignLight = false, showHit = false }) {
    var _a, _b;
    const { horizontal } = useSnapshot(STORE);
    console.log(horizontal === 1 ? "left" : horizontal === 2 ? "right" : "bottom");
    const { fixedRelativeCard, fixedCardId } = useSnapshot(STORE);
    const card = (_a = window.HSCARDS) === null || _a === void 0 ? void 0 : _a[info === null || info === void 0 ? void 0 : info.CardID];
    const fixedCard = useCallback((id) => {
        HsboxClient.fixedRelevantCard(true);
        SetStore("fixedCardId", id);
        SetStore("fixedRelativeCard", true);
        showCard(id);
    }, [fixedRelativeCard]);
    const tooltip = card
        ? React.createElement("div", { className: "content new-style" },
            React.createElement("img", { src: "https://hs2.166.net/hs-card-img/card/" + info.CardID + ".png", onError: (e) => { e.target.setAttribute("src", "https://hs2.166.net/hs-card-img/card/VIR_001.png"); } }))
        : null;
    return React.createElement(Tooltip, { destroyTooltipOnHide: false, overlay: tooltip, overlayClassName: "card-tooltip", placement: !!customDirection ? customDirection : horizontal === 1 ? "left" : horizontal === 2 ? "right" : "bottom", mouseEnterDelay: 0.3, mouseLeaveDelay: 0.3 },
        React.createElement("li", { key: info.SpecialCardID || info.CardID, className: Classnames("card-item", { gray: extra === "gray" }, { active: fixedCardId === (info.SpecialCardID || info.CardID) || hignLight }), style: { backgroundImage: `url("https://hs2.166.net/hs-card-img/cropcard/${info.CardID}.png")` }, onMouseEnter: (e) => {
                var _a;
                if (fixedCardId !== (info.SpecialCardID || info.CardID)) {
                    HsboxClient.fixedRelevantCard(false);
                    SetStore("fixedRelativeCard", false);
                    SetStore("fixedCardId", "");
                }
                const element = e.currentTarget;
                const rect = element.getBoundingClientRect();
                const clientHeight = document.documentElement.clientHeight;
                const clientY = rect.y < 123 ? 0 : (clientHeight < (rect.y + 123 + 30)) ? (rect.y - 123 - (123 + 30 + rect.y - clientHeight)) : (rect.y - 123);
                let useCardId = "";
                if (info.SpecialCardID) {
                    const useCardIdArr = (_a = info.SpecialCardID) === null || _a === void 0 ? void 0 : _a.split(".");
                    useCardId = useCardIdArr[0] + (useCardIdArr[1] ? `.${useCardIdArr[1]}` : "");
                }
                associated && debouncedShowCard(useCardId || info.CardID, 0, clientY / clientHeight);
            }, onMouseLeave: () => associated && !fixedRelativeCard && debouncedShowCard("", 0, 0), onDoubleClick: () => associated && fixedCard(info.SpecialCardID || info.CardID) },
            React.createElement("p", { className: Classnames("card-item-wrapper") },
                React.createElement("i", null, isNaN(card === null || card === void 0 ? void 0 : card.Cost) ? '' : card.Cost),
                React.createElement("span", { className: `card-item-name rarity-${card === null || card === void 0 ? void 0 : card.Rarity}` }, (info === null || info === void 0 ? void 0 : info.OriginName)
                    ? `由${info.OriginName}创建`
                    : (info === null || info === void 0 ? void 0 : info.ExtraText)
                        ? `${card === null || card === void 0 ? void 0 : card.name_cn} ${info === null || info === void 0 ? void 0 : info.ExtraText}`
                        : card === null || card === void 0 ? void 0 : card.name_cn),
                showDiscardPercentage && React.createElement("span", { className: `card-item-discard-percentage` }, info === null || info === void 0 ? void 0 : info.discard_percentage),
                showHit && React.createElement("div", { className: `card-item-hit` })),
            info.qp === 1 ? React.createElement("span", { className: "card-item-qp", style: { right: info.ysk === 1 ? "30px" : "2px" } }) : null,
            info.ysk === 1 ? React.createElement("span", { className: "card-item-ysk" }) : null,
            animateNode ? React.createElement(NumAnimate, { num: info.num }) : ((_b = info.num) !== null && _b !== void 0 ? _b : 0) < 2 ? null : React.createElement("span", { className: "card-item-num" }, info.num),
            (info === null || info === void 0 ? void 0 : info.PositionText) ? React.createElement("span", { className: "card-item-postion" }, info.PositionText) : null));
}
