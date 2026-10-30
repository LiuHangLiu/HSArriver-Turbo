import React, { useState, useEffect, Fragment } from "react";
import Classnames from "classnames";
import "./index.scss";
export default function NumAnimate({ animateClass = "", num = 0 }) {
    const [curNum, setCurNum] = useState(num);
    const [animationNum, setAnimationNum] = useState(0);
    const [curAnimateClass, setCurAnimateClass] = useState(animateClass);
    useEffect(() => {
        if (curNum > num) {
            setCurAnimateClass("translateX-exit translateX-exit-active");
            setAnimationNum(curNum);
            setCurNum(num);
            setTimeout(() => {
                setAnimationNum(0);
                setCurAnimateClass("");
            }, 5000);
        }
        else if (curNum < num) {
            setCurNum(num);
        }
    }, [num]);
    return (React.createElement(Fragment, null,
        React.createElement("span", { className: Classnames(`card-item-num ${curAnimateClass}`, { hidden: curNum < 2 && animationNum < 2 }) }, !animationNum ? curNum : animationNum)));
}
