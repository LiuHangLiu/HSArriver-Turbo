import React, { useMemo } from "react";
import { SORT_MAP } from "@/utils";
import "./index.scss";
const ASSEMBLE_POSITION_MAP = {
    1: "左1中2",
    2: "左2中1",
    3: "右1中2",
    4: "右2中1"
};
function ActionCard(props) {
    var _a, _b, _c, _d;
    const { card } = props;
    const { cardId } = card;
    const backgroundImage = `url("https://hs2.166.net/hs-card-img/cropcard/${cardId}.png")`;
    const cardName = (_d = (_a = card.cardName) !== null && _a !== void 0 ? _a : (_c = (_b = window.HSCARDS) === null || _b === void 0 ? void 0 : _b[cardId]) === null || _c === void 0 ? void 0 : _c.name_cn) !== null && _d !== void 0 ? _d : "-";
    return (React.createElement("div", { className: "recommend-playstyle-action-card", style: { backgroundImage } },
        React.createElement("div", { className: "recommend-playstyle-action-card-wrapper" },
            React.createElement("span", { className: "recommend-playstyle-action-card-name ellipsis" }, cardName))));
}
export default function ActionGroup(props) {
    const content = useMemo(() => {
        const { index, actionName, card, target, targetHero, oppTarget, oppTargetHero, subOption, position, using_disguised } = props;
        const cardDom = card ? React.createElement(ActionCard, { card: card }) : null;
        const choiceDom = target ? React.createElement(ActionCard, { card: target }) : oppTarget ? React.createElement(ActionCard, { card: oppTarget }) : null;
        const choiceMutiDom = card
            ? Array.isArray(card)
                ? card.map((v, i) => React.createElement(ActionCard, { card: v, key: i }))
                : React.createElement(ActionCard, { card: card })
            : null;
        const positionDom = React.createElement("p", { className: "recommend-playstyle-action-description" }, using_disguised === 1 ? `放置于对手${position}号位` : using_disguised === 0 ? `放置于我方${position}号位` : `放置于${position}号位`);
        const targetDom = (() => {
            var _a, _b;
            const curTarget = (_b = (_a = target !== null && target !== void 0 ? target : oppTarget) !== null && _a !== void 0 ? _a : targetHero) !== null && _b !== void 0 ? _b : oppTargetHero;
            if (!curTarget)
                return null;
            const ifOpp = oppTarget || oppTargetHero;
            const ifHero = targetHero || oppTargetHero;
            return (React.createElement(React.Fragment, null,
                React.createElement("p", { className: "recommend-playstyle-action-description" },
                    "\u76EE\u6807\u662F",
                    ifOpp ? "对方" : "己方",
                    ifHero ? "英雄" : React.createElement(React.Fragment, null,
                        React.createElement("span", { className: "sort" }, curTarget.position),
                        "\u53F7\u4F4D")),
                React.createElement(ActionCard, { card: curTarget })));
        })();
        const subOptionDom = (subOption === null || subOption === void 0 ? void 0 : subOption.cardId) ? (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "recommend-playstyle-action-description" },
                React.createElement("span", { className: "choice" }, "\u9009\u62E9"),
                "\u5361\u724C"),
            React.createElement(ActionCard, { card: subOption }))) : null;
        switch (actionName) {
            case "end_turn": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "end" }, "\u7ED3\u675F"),
                        "\u56DE\u5408")));
            }
            case "choice": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "choice" },
                            "\u9009\u62E9",
                            oppTarget ? "对方" : "我方"),
                        React.createElement("span", { className: "sort" }, (target === null || target === void 0 ? void 0 : target.ZONE_POSITION) || (oppTarget === null || oppTarget === void 0 ? void 0 : oppTarget.ZONE_POSITION)),
                        "\u53F7\u4F4D\u5361\u724C"),
                    choiceDom));
            }
            case "play_minion": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "play" }, "\u6253\u51FA"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u968F\u4ECE"),
                    cardDom,
                    targetDom,
                    subOptionDom,
                    positionDom));
            }
            case "play_special": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u6253\u51FA"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u6CD5\u672F"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "play_weapon": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u6253\u51FA"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u6B66\u5668"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "play_hero": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u6253\u51FA"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u82F1\u96C4"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "play_location": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u6253\u51FA"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u5730\u6807"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "forge": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u953B\u9020"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u5361\u724C"),
                    cardDom));
            }
            case "trade": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u4EA4\u6613"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u5361\u724C"),
                    cardDom));
            }
            case "prepare": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u9884\u5907"),
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u5361\u724C"),
                    cardDom));
            }
            case "hero_attack": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" }, "\u64CD\u4F5C\u6211\u65B9\u82F1\u96C4\u653B\u51FB"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "minion_attack": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        "\u64CD\u4F5C",
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u968F\u4ECE\u653B\u51FB"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "hero_skill": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        "\u4F7F\u7528",
                        React.createElement("span", { className: "play" }, "\u82F1\u96C4\u6280\u80FD")),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "titan_power": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        "\u64CD\u4F5C",
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u6CF0\u5766"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "location_power": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        "\u64CD\u4F5C",
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u5730\u6807"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "launch_starship": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        "\u53D1\u5C04",
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u661F\u8230"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "common_action": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        "\u64CD\u4F5C",
                        React.createElement("span", { className: "sort" }, card === null || card === void 0 ? void 0 : card.ZONE_POSITION),
                        "\u53F7\u4F4D\u5361\u724C"),
                    cardDom,
                    targetDom,
                    subOptionDom));
            }
            case "discard": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "arena-recommend-playstyle-action-description" },
                        React.createElement("span", { className: "choice" }, "\u820D\u5F03\u5361\u724C")),
                    choiceMutiDom));
            }
            case "choose": {
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "arena-recommend-playstyle-action-description" },
                        React.createElement("span", { className: "choice" }, "\u9009\u62E9\u5361\u724C")),
                    choiceMutiDom));
            }
            case "replace": {
                return (Array.isArray(card) && card.length
                    ? React.createElement(React.Fragment, null, card.map((v, i) => {
                        return (React.createElement("p", { className: "recommend-playstyle-action-description", style: { paddingTop: i !== 0 ? "8px" : 0 } },
                            React.createElement("span", { className: "choice" },
                                "\u66FF\u6362", v === null || v === void 0 ? void 0 :
                                v.ZONE_POSITION,
                                "\u53F7\u4F4D\u5361\u724C"),
                            React.createElement(ActionCard, { card: v, key: i })));
                    }))
                    : React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "choice" }, "\u4FDD\u7559\u5168\u90E8\u5361\u724C")));
            }
            case "assemble": {
                const assembleEffect = (target === null || target === void 0 ? void 0 : target.ZONE_POSITION) ? ASSEMBLE_POSITION_MAP[target.ZONE_POSITION] : null;
                return (React.createElement(React.Fragment, null,
                    React.createElement("p", { className: "recommend-playstyle-action-description" },
                        React.createElement("span", { className: "special" }, "\u8FDB\u884C\u62FC\u88C5"),
                        assembleEffect ? `【${assembleEffect}】` : null),
                    target ? React.createElement(ActionCard, { card: target }) : null));
            }
            default: {
                return null;
            }
        }
    }, [props]);
    return (React.createElement("div", { className: "recommend-playstyle-action" },
        React.createElement("h4", { className: "recommend-playstyle-action-title" },
            "\u6253\u6CD5\u53C2\u8003",
            SORT_MAP[props.index]),
        React.createElement("div", { className: "recommend-playstyle-action-wrapper" }, content)));
}
