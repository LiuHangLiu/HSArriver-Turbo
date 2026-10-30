import React, { useMemo, useEffect, useState, useCallback } from "react";
import ActionGroup from "@/components/action-group";
import { logBoxCallback } from "@/utils/box-observer";
export default function Recommend() {
    const [recommendActions, setRecommendActions] = useState({ data: [], status: 2, error: "" });
    const onUpdateLadderActionRecommend = useCallback((data = "") => {
        let newData = data.replaceAll("opp-target-hero", "oppTargetHero").replaceAll("opp-target", "oppTarget").replaceAll("target-hero", "targetHero");
        const parsed = JSON.parse(newData);
        logBoxCallback("ladder.recommend", parsed);
        setRecommendActions(parsed);
    }, []);
    useEffect(() => {
        window.onUpdateLadderActionRecommend = onUpdateLadderActionRecommend;
    }, [onUpdateLadderActionRecommend]);
    const actionsDom = useMemo(() => {
        var _a;
        return ((_a = recommendActions.data) === null || _a === void 0 ? void 0 : _a.length) ? recommendActions.data.map((a, i) => {
            return React.createElement(ActionGroup, { key: i, actionName: a.actionName, card: a.card, index: i, target: a.target, oppTarget: a.oppTarget, targetHero: a.targetHero, oppTargetHero: a.oppTargetHero, subOption: a.subOption, position: a.position, using_disguised: a.using_disguised });
        }) : (recommendActions === null || recommendActions === void 0 ? void 0 : recommendActions.status) !== 2 && recommendActions.error
            ? null
            : React.createElement("p", { style: { textAlign: "center", lineHeight: "20px", color: "#fff", opacity: 0.8, paddingTop: "15px" } },
                "AI\u63A8\u8350\u529F\u80FD\u5B9E\u884C\u9636\u68AF\u5F00\u653E\uFF1A",
                React.createElement("br", null),
                "\u6BCF\u670801~10\u53F7\uFF0C\u4F20\u8BF4\u4E4B\u4E0B\u53EF\u7528 ",
                React.createElement("br", null),
                "\u6BCF\u670811~20\u53F7\uFF0C\u4F20\u8BF45\u4E07\u540D\u5916\u53EF\u7528 ",
                React.createElement("br", null),
                "\u6BCF\u670821~\u6708\u7EC8\uFF0C\u4F20\u8BF43\u4E07\u540D\u5916\u53EF\u7528");
    }, [recommendActions]);
    console.log("actionDom", recommendActions, actionsDom);
    return (React.createElement("div", { className: "recommend-playstyle-wrapper", style: { height: "704px" } },
        recommendActions.status !== 2
            ? React.createElement("p", { style: { padding: "10px 10px 0" } }, recommendActions.error)
            : null,
        actionsDom));
}
