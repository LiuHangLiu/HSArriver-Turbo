var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useCallback, useEffect, useState, useRef } from "react";
import { HERO_CLASS_MAP, CLASS_HERO_MAP } from "@/utils";
import { DeleteCollectDeck, CreateCollectDeck, HsboxClient } from "@hsbox/api";
import { useSnapshot } from "valtio";
import { STORE } from "@/stores";
import "./index.scss";
import _ from "lodash";
export default function Save({ groups, data, status }) {
    const { myDeviceId, myBtag, myUrs, dataSource, positionType } = useSnapshot(STORE);
    const [allData, setAllData] = useState(data);
    const [save, setSave] = useState(false);
    const [saveGroup, setSaveGroup] = useState([]);
    const [contest, setContest] = useState(false);
    const cgname = useRef("");
    const matchGroup = useCallback((deckdata) => {
        if (saveGroup.length) {
            const { md5, job, hero_id } = deckdata;
            let hero = hero_id ? parseInt(hero_id.replace("HERO_", "")) : "";
            let saveState = false;
            let contestState = false;
            saveGroup.forEach((item) => {
                if (item["code"] == md5.toLowerCase() && (HERO_CLASS_MAP[item["class"]] == parseInt(job) || HERO_CLASS_MAP[item["class"]] == hero)) {
                    cgname.current = item["cgname"];
                    if (item["contest"] == 1 && status == 1) {
                        saveState = true;
                        contestState = true;
                    }
                    else {
                        saveState = true;
                    }
                }
            });
            setSave(saveState);
            setContest(contestState);
        }
        else {
            if (save) {
                setSave(false);
            }
        }
    }, [saveGroup, save, contest, allData, status]);
    const handleGroupStatus = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (contest)
            return;
        const { md5, new_cg, new_md5, job, iswild, deck_id, hero_id } = allData;
        let hero = hero_id ? parseInt(hero_id === null || hero_id === void 0 ? void 0 : hero_id.replace("HERO_", "")) : "";
        if (save) {
            const res = yield DeleteCollectDeck({ hero: job !== null && job !== void 0 ? job : hero, md5: md5.toLowerCase(), name: cgname.current });
            setSave(false);
            updateGroups({
                code: md5.toLowerCase(), cgname: cgname.current, class_id: CLASS_HERO_MAP[job]
            }, false);
        }
        else {
            if (status === 1) {
                const dataCb = yield HsboxClient.getDeckInfo(deck_id + "");
                if (dataCb && dataCb["md5"]) {
                    dataCb["md5"] = dataCb["md5"].toLowerCase();
                }
                const res = yield CreateCollectDeck({
                    hero,
                    md5: dataCb.md5,
                    mode: dataCb.game_mode,
                    name: dataCb.name,
                    topage: dataCb.cards
                });
                setSave(true);
                updateGroups({
                    code: dataCb.md5.toLowerCase(), name: dataCb.name, class_id: CLASS_HERO_MAP[hero]
                }, true);
            }
            else if (status === 2) {
                const res = yield CreateCollectDeck({
                    hero: job,
                    md5: new_md5,
                    mode: iswild,
                    name: "对手卡组",
                    topage: new_cg
                });
                cgname.current = "对手卡组";
                setSave(true);
                updateGroups({
                    code: md5.toLowerCase(), name: "对手卡组", class_id: CLASS_HERO_MAP[job]
                }, true);
            }
        }
    }), [saveGroup, save, contest, allData, status]);
    const updateGroups = useCallback((param, isSaved) => {
        const { code, name, class_id } = param;
        const saveGroupTemp = [...saveGroup];
        let deck = {
            code: code,
            cgname: name,
            class: class_id,
        };
        if (isSaved) {
            saveGroupTemp.push(deck);
        }
        else {
            let index = _.findIndex(saveGroupTemp, { code: param.code });
            saveGroupTemp.splice(index, 1);
        }
        setSaveGroup(saveGroupTemp);
    }, [saveGroup, save, contest, allData, status]);
    const nsRecord = useCallback(() => {
        var _a;
        const obj = {
            bnet_tag: myBtag,
            deviceid: myDeviceId,
            game_type: 1,
            urs: myUrs,
            data_source: dataSource === "hsang" ? 1 : 2,
            button_id: status === 2 ? 3 : 5,
            from_type: 2,
            position_type: positionType
        };
        (_a = window === null || window === void 0 ? void 0 : window.ns) === null || _a === void 0 ? void 0 : _a.call(window, "send", "event", "wtcg_box_client", status === 2 ? "clk_new_2_391_19" : "clk_new_2_391_20", JSON.stringify(obj));
    }, [myBtag, myDeviceId, myUrs, dataSource, positionType]);
    useEffect(() => {
        if (saveGroup.length === 0) {
            setSaveGroup(groups);
            setSave(false);
            setContest(false);
            matchGroup(data);
        }
        else {
            matchGroup(data);
        }
        setAllData(data);
    }, [saveGroup, groups, data, status]);
    return React.createElement("i", { className: contest ? "u-validated" : "u-save " + (save ? "z-saved" : ""), onClick: () => { handleGroupStatus(); nsRecord(); } });
}
