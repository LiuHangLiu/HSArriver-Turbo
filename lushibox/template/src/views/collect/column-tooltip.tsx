import React, { useMemo } from "react";
import Tooltip from "rc-tooltip";
import "rc-tooltip/assets/bootstrap_white.css";
export default function columnTooltip({ extraClass, data, isHave, isHigh, idx, height, handleShowDetailsClick }) {
    const dom = useMemo(() => {
        const columnMap = {
            0: {
                0: '缺失非高胜卡',
                1: '缺失高胜卡'
            },
            1: {
                0: '已有非高胜卡',
                1: '已有高胜卡'
            }
        };
        const rarito = data['sum'] == 0 ? 0 : Math.round(data['by'][isHave][isHigh]['sum'] / data['sum'] * 100);
        let overlay = React.createElement("p", null,
            columnMap[isHave][isHigh],
            data['by'][isHave][isHigh]['sum'],
            "\u79CD\uFF0C\u5360\u6BD4",
            rarito,
            "%");
        const offset = idx % 2 ? [5, 0] : [-5, 0];
        return (React.createElement(Tooltip, { placement: idx % 2 ? "left" : "right", overlay: overlay, overlayClassName: "z-white", overlayStyle: { width: '90px' }, align: { offset: offset }, mouseLeaveDelay: 0 },
            React.createElement("em", { className: extraClass, style: { height: height + 'px' }, onClick: () => handleShowDetailsClick() })));
    }, [extraClass, data, isHave, isHigh, idx, height, handleShowDetailsClick]);
    return dom;
}
