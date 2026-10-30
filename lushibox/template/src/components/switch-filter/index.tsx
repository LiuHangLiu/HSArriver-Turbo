import React, { useMemo } from "react";
import { useState } from "react";
import Classnames from "classnames";
import Tooltip from "rc-tooltip";
import "rc-tooltip/assets/bootstrap_white.css";
import "./index.scss";
function SwitchFilter({ list, init, callback }) {
    const [visible, setVisible] = useState(false);
    const [target, setTarget] = useState(init !== null && init !== void 0 ? init : list[0]);
    const Option = useMemo(() => {
        return list.map((item, index) => {
            return React.createElement("li", { key: index, className: Classnames("switch-filter-option", { active: (target === null || target === void 0 ? void 0 : target.id) === item.id }), onClick: () => {
                    setVisible(false);
                    setTarget(item);
                    callback && callback(item.id);
                } }, item.name);
        });
    }, [list, target, callback]);
    return (React.createElement(Tooltip, { trigger: ["click"], prefixCls: "hs-tooltip", placement: "bottomLeft", visible: visible, destroyTooltipOnHide: true, onVisibleChange: setVisible, overlay: React.createElement("ul", { className: "switch-filter-options" }, Option) },
        React.createElement("p", { className: Classnames("switch-filter-wrap", { active: visible }) },
            React.createElement("span", { className: "switch-filter-txt ellipsis" }, target === null || target === void 0 ? void 0 : target.name),
            React.createElement("i", { className: Classnames("switch-filter-arrow") }))));
}
export default SwitchFilter;
