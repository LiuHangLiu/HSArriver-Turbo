import React from "react";
import "./index.scss";
export default function Title({ text = "" }) {
    return React.createElement("h3", { className: "title-component" }, text);
}
