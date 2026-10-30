var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useEffect, useCallback, useState } from "react";
import Classnames from "classnames";
import Wrapper from "@/components/wrapper";
import Title from "@/components/title";
import { PACKAGE_AHIEVE } from "@/utils";
import { HsboxClient } from "@hsbox/api";
import "./index.scss";
import "rc-tooltip/assets/bootstrap_white.css";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
export default function Cardpack() {
    const { myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const [autoState, setAutoState] = useState(false);
    const [cardList, setCardList] = useState([]);
    const [hasRecord, setHasRecord] = useState(false);
    const [enableOpenPacket, setEnableOpenPacket] = useState(false);
    const [hasPackage, setHasPackage] = useState(false);
    const [pack, setPack] = useState({
        achieve: 0,
        dust: 0,
        packs: 0,
        legendary: 0,
        epic: 0,
        rare: 0,
        common: 0
    });
    const nsRecord = useCallback((type) => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            button_id: type,
            from_part: 8,
            from_type: 5,
            position_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", "clk_new_2_391_20", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    const autoOpenDone = (err) => {
        console.log("err:" + err);
        setAutoState(false);
    };
    const recordOpenDetail = useCallback((cards) => {
        console.log(cards);
        const cardListTemp = [...cardList];
        cards.forEach(item => {
            const tar = cardListTemp.find(v => v.id === item.id);
            if (tar) {
                tar.num++;
            }
            else {
                item.num = 1;
                cardListTemp.push(item);
            }
        });
        setCardList(cardListTemp);
        setHasRecord(true);
        localStorage.setItem("openPackageList", JSON.stringify(cardListTemp));
    }, [cardList]);
    const handleShareClick = useCallback(() => {
        if (pack.packs === 0)
            return;
        let url = "https://hs-web.lushi.163.com/box_unpack_share.html" + "#" + encodeURIComponent(JSON.stringify(pack));
        HsboxClient.openInsideBrowser(url);
    }, [pack]);
    const autoOpenPackage = useCallback(() => {
        nsRecord(9);
        if (!hasPackage)
            return;
        if (!autoState) {
            window.ns && window.ns("send", "event", "wtcg_box_client", "clk_new_2_391_13", JSON.stringify({
                bnet_tag: "",
                deviceid: "",
                game_type: "5",
                overlay_part: "一键开包",
                time: new Date().getTime(),
                urs: ""
            }));
            setAutoState(true);
            HsboxClient.openPack();
        }
        else {
            setAutoState(false);
            HsboxClient.stopOpenPack();
        }
    }, [autoState, hasPackage]);
    const viewResult = useCallback(() => {
        nsRecord(10);
        if (hasRecord) {
            let url = `https://${location.hostname}/client-jipaiqi/pack-result`;
            HsboxClient.openInsideBrowser(url);
        }
    }, [hasRecord]);
    useEffect(() => {
        var _a;
        const hasRecordVal = localStorage.getItem("openPackageList") && JSON.parse((_a = localStorage.getItem("openPackageList")) !== null && _a !== void 0 ? _a : "").length;
        setHasRecord(hasRecordVal);
        window.NotifyPackOpenChanged = setPack;
        window.NotifyPackOpenCardsChanged = recordOpenDetail;
        window.AutoOpenPackDone = autoOpenDone;
    }, [autoOpenDone, recordOpenDetail, setPack]);
    useEffect(() => {
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            const boxConfigStr = yield HsboxClient.GetConfig();
            if (!boxConfigStr)
                return;
            const config = JSON.parse(boxConfigStr);
            const hasPackageVal = yield HsboxClient.checkRemainPack();
            setEnableOpenPacket(config.EnableOpenPacket);
            setHasPackage(hasPackageVal);
        }), 2000);
    }, []);
    return (React.createElement("div", { className: "cardpack-view" },
        React.createElement(Wrapper, { className: "cardpack-wrapper", width: 260 },
            React.createElement(Title, { text: "卡包" }),
            React.createElement("ul", { className: "cardpack-list" },
                React.createElement("li", null,
                    React.createElement("i", { className: "i-package" }), pack === null || pack === void 0 ? void 0 :
                    pack.packs),
                React.createElement("li", null,
                    React.createElement("i", { className: "i-dust" }), pack === null || pack === void 0 ? void 0 :
                    pack.dust),
                React.createElement("li", null,
                    React.createElement("i", { className: "i-rarity-5" }), pack === null || pack === void 0 ? void 0 :
                    pack.legendary),
                React.createElement("li", null,
                    React.createElement("i", { className: "i-rarity-4" }), pack === null || pack === void 0 ? void 0 :
                    pack.epic),
                React.createElement("li", null,
                    React.createElement("i", { className: "i-rarity-3" }), pack === null || pack === void 0 ? void 0 :
                    pack.rare),
                React.createElement("li", null,
                    React.createElement("i", { className: "i-rarity-1" }), pack === null || pack === void 0 ? void 0 :
                    pack.common)),
            React.createElement("p", { className: "cardpack-text" }, PACKAGE_AHIEVE["enCN"][pack === null || pack === void 0 ? void 0 : pack.achieve]),
            React.createElement("div", { className: Classnames("cardpack-btn", { disable: pack.packs === 0 }), onClick: handleShareClick }, (pack.achieve == 5 || pack.achieve == 6 || pack.achieve == 9) ? "多少小伙伴和我一样惨?" : "多少小伙伴和我一样?"),
            React.createElement("div", { className: "cardpack-line" }),
            enableOpenPacket ? React.createElement("div", { className: Classnames("cardpack-btn-sp", { disable: !hasPackage }), onClick: autoOpenPackage }, autoState ? "停止开包" : "一键开包") : null,
            React.createElement("div", { className: Classnames("cardpack-btn", { disable: !hasRecord }), onClick: viewResult }, "\u5F00\u5305\u7ED3\u679C"))));
}
