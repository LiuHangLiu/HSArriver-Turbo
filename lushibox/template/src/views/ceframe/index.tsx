var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HERO_CLASS_MAP, HERO_MAP, loadJSON, loadScript, SECRET_MAP, CLASS_HERO_MAP } from "@/utils";
import Classnames from 'classnames';
import { HsboxClient } from "@hsbox/api";
import "./index.scss";
import Card from '@/components/card';
import DraggableElement from '@/components/draggable-dom';
import { CSSTransition, TransitionGroup, } from 'react-transition-group';
export default function Ceframe() {
    var _a, _b, _c, _d, _e, _f, _g;
    const [markEnabled, setMarkEnabled] = useState(true);
    const [relativeList, setRelativeList] = useState([]);
    const [showState, setShowState] = useState(false);
    const [positionY, setPositionY] = useState('0');
    const [positionX, setPositionX] = useState('0');
    const [showOriginCard, setShowOriginCard] = useState("");
    const [positionLeftZero, setPositionLeftZero] = useState(false);
    const [postionBottomZero, setPositionBottomZero] = useState(false);
    const [positionDirection, setPositionDirection] = useState("right");
    const [showWargameState, setShowWargameState] = useState(false);
    const [showSecretsLocation, setShowSecretsLocation] = useState(false);
    const [secretsLocation, SetSecretsLocation] = useState({});
    const [secretState, setSecretState] = useState(false);
    const [showSecretContent, setShowSecretContent] = useState(false);
    const isSecretFirstShow = useRef(true);
    const [secret, setSecret] = useState({});
    const secretRef = useRef({});
    const [fixedState, setFixedState] = useState(false);
    const [relativeStore, setRelativeStore] = useState();
    const [description, setDescription] = useState("");
    const [targetWargame, setTargetWargame] = useState("");
    const [targetTabWargame, setTargetTabWargame] = useState("");
    const [markCardIds, setMarkCardIds] = useState([]);
    const [markedFlag, setMarkedFlag] = useState(false);
    const [secretPositionRight, setSecretPositionRight] = useState(false);
    const [series, setSeries] = useState([]);
    const TEST_SRC = "https://lushi-test.gameyw.netease.com/configConstant/linkCardConfig.json";
    const PROD_SRC = "https://lushi-app.gameyw.netease.com/json/linkCardConfig.json";
    const TEST_CHESS = "https://lushi-test.gameyw.netease.com/chessGroup.js";
    const PROD_CHESS = "https://lushi-app.gameyw.netease.com/json/chessGroup.js";
    const TEST_CARDS_DESC = "https://lushi-test.gameyw.netease.com/gzdata/hsCardsDesc.js";
    const PROD_CARDS_DESC = "https://lushi-app.gameyw.netease.com/gzdata/hsCardsDesc.js";
    const loadRelativeJson = () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield loadJSON(RUN_ENV === "prod" ? PROD_SRC : TEST_SRC);
        console.log("json", res);
        setRelativeStore(res === null || res === void 0 ? void 0 : res.cardLinks);
        setDescription((_a = res === null || res === void 0 ? void 0 : res.description) !== null && _a !== void 0 ? _a : "单击固定展示，再次单击取消固定。");
    });
    const loadChessGroupJs = () => __awaiter(this, void 0, void 0, function* () {
        loadScript(RUN_ENV === "prod" ? PROD_CHESS : TEST_CHESS, () => {
        });
    });
    const loadCardsDescJs = () => {
        loadScript(RUN_ENV === "prod" ? PROD_CARDS_DESC : TEST_CARDS_DESC, () => {
            var _a;
            setSeries((_a = window.seriesList) !== null && _a !== void 0 ? _a : []);
        });
    };
    const currentTabItem = useMemo(() => {
        var _a, _b, _c;
        const chessTarget = (_a = window === null || window === void 0 ? void 0 : window.chessGroup) === null || _a === void 0 ? void 0 : _a.find((v) => v.title === targetWargame);
        return (_c = (_b = chessTarget === null || chessTarget === void 0 ? void 0 : chessTarget.extInfo) === null || _b === void 0 ? void 0 : _b.docGroups) === null || _c === void 0 ? void 0 : _c.find((v) => v.title === targetTabWargame);
    }, [window === null || window === void 0 ? void 0 : window.chessGroup, targetTabWargame, targetWargame]);
    const updateLocation = (position) => {
        console.log("上报最终postion", position);
        HsboxClient.updateSecretsLocation(position.x / 100, position.y / 100);
        const containerWidth = window.innerWidth;
        if (((1 - (position.x / 100)) * containerWidth) < 262) {
            setSecretPositionRight(true);
        }
        else {
            setSecretPositionRight(false);
        }
    };
    const changeSecret = useCallback((list, status) => {
        let hero = "";
        if (typeof (list) == "number") {
            if (SECRET_MAP[list]) {
                hero = list;
                list = SECRET_MAP[list];
            }
            else {
                return;
            }
        }
        if (typeof (window.HSCARDS) == "undefined") {
            return;
        }
        const secretTemp = Object.assign({}, secretRef.current);
        if (hero === "") {
            list.map((item) => {
                let classId = window.HSCARDS[item]["Class"];
                hero = HERO_CLASS_MAP[classId];
                if (!secretTemp[hero]) {
                    secretTemp[hero] = {};
                }
                if (status == "disabled") {
                    delete secretTemp[hero][item];
                }
                else {
                    secretTemp[hero][item] = {
                        id: item,
                        status,
                        nodeRef: createRef(),
                    };
                }
            });
            secretRef.current = secretTemp;
            setSecret(secretTemp);
        }
        else {
            secretTemp[hero] = {};
            list.map((item) => {
                if (status == "disabled") {
                    delete secretTemp[hero][item];
                }
                else {
                    secretTemp[hero][item] = {
                        id: item,
                        status,
                        nodeRef: createRef(),
                    };
                }
            });
            secretRef.current = secretTemp;
            setSecret(secretTemp);
        }
    }, []);
    const isEmptyObject = useCallback((obj) => {
        return Object.keys(obj).length === 0;
    }, []);
    const deleteSecret = useCallback((hero) => {
        var _a;
        const secretRefTemp = Object.assign({}, secretRef.current);
        const secretObj = (_a = secretRefTemp === null || secretRefTemp === void 0 ? void 0 : secretRefTemp[hero]) !== null && _a !== void 0 ? _a : {};
        const secretTemp = Object.keys(secretObj);
        changeSecret(secretTemp, "disabled");
    }, [changeSecret]);
    const onSecretGuideClick = () => {
        setShowSecretContent(showSecretContent => !showSecretContent);
    };
    const cancelFixedCard = () => {
        setShowState(false);
        setFixedState(false);
        HsboxClient.closeRelativeFixedCard();
    };
    const showWargameGuide = (title, subTitle) => {
        var _a, _b, _c, _d;
        console.log(title, subTitle);
        if (!!title) {
            setShowWargameState(true);
            setShowState(false);
            setTargetWargame(title);
            if (subTitle) {
                setTargetTabWargame(subTitle);
            }
            else {
                const chessTarget = (_a = window === null || window === void 0 ? void 0 : window.chessGroup) === null || _a === void 0 ? void 0 : _a.find((v) => v.title === title);
                const tabName = (_d = (_c = (_b = chessTarget === null || chessTarget === void 0 ? void 0 : chessTarget.extInfo) === null || _b === void 0 ? void 0 : _b.docGroups) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.title;
                setTargetTabWargame(tabName);
            }
        }
    };
    const closeBattleWindow = () => {
        HsboxClient.closeBattleGroundBuild();
        setShowWargameState(false);
    };
    const onMark = useCallback(() => {
        var _a, _b, _c, _d;
        const cardIds = (_b = (_a = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.cardIds) === null || _a === void 0 ? void 0 : _a.split(",")) === null || _b === void 0 ? void 0 : _b.concat((_d = (_c = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.transitionCardIds) === null || _c === void 0 ? void 0 : _c.split(",")) !== null && _d !== void 0 ? _d : []);
        HsboxClient.oneTouchMarkCards(cardIds, true).catch(console.log);
    }, [currentTabItem]);
    const onCancelMark = useCallback(() => {
        var _a, _b, _c, _d;
        const cardIds = (_b = (_a = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.cardIds) === null || _a === void 0 ? void 0 : _a.split(",")) === null || _b === void 0 ? void 0 : _b.concat((_d = (_c = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.transitionCardIds) === null || _c === void 0 ? void 0 : _c.split(",")) !== null && _d !== void 0 ? _d : []);
        HsboxClient.oneTouchMarkCards(cardIds, false, true).catch(console.log);
    }, [currentTabItem]);
    const initMarkCards = useCallback((cardIds, title) => {
        var _a, _b, _c, _d, _e, _f, _g;
        console.log("initMarkCards", cardIds, title);
        const cardIdsArr = cardIds;
        const chessTarget = (_a = window === null || window === void 0 ? void 0 : window.chessGroup) === null || _a === void 0 ? void 0 : _a.find((v) => v.title === targetWargame);
        const currentTabItem = (_c = (_b = chessTarget === null || chessTarget === void 0 ? void 0 : chessTarget.extInfo) === null || _b === void 0 ? void 0 : _b.docGroups) === null || _c === void 0 ? void 0 : _c.find((v) => { var _a; return v.title === ((_a = title !== null && title !== void 0 ? title : targetTabWargame) !== null && _a !== void 0 ? _a : ""); });
        const currentTabCardIds = (_e = (_d = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.cardIds) === null || _d === void 0 ? void 0 : _d.split(",")) === null || _e === void 0 ? void 0 : _e.concat((_g = (_f = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.transitionCardIds) === null || _f === void 0 ? void 0 : _f.split(",")) !== null && _g !== void 0 ? _g : []);
        const flag = currentTabCardIds === null || currentTabCardIds === void 0 ? void 0 : currentTabCardIds.every(item => cardIdsArr.includes(item));
        setMarkCardIds(cardIdsArr);
        setMarkedFlag(flag);
    }, [targetWargame, targetTabWargame]);
    const changeTargetTabWargame = useCallback((title) => {
        console.log("changeTargetTabWargame", title, markCardIds);
        setTargetTabWargame(title);
        initMarkCards(markCardIds, title);
    }, [markCardIds]);
    const chessTarget = (_a = window === null || window === void 0 ? void 0 : window.chessGroup) === null || _a === void 0 ? void 0 : _a.find((v) => v.title === targetWargame);
    const chessGroupTabs = React.createElement("ul", { className: 'ceframe-wargame-tabs' }, (_c = (_b = chessTarget === null || chessTarget === void 0 ? void 0 : chessTarget.extInfo) === null || _b === void 0 ? void 0 : _b.docGroups) === null || _c === void 0 ? void 0 : _c.map((item, i) => {
        return React.createElement("li", { className: Classnames("ceframe-wargame-tab", { active: item.title === targetTabWargame }), key: i, onClick: () => changeTargetTabWargame(item.title) }, item.title);
    }));
    useEffect(() => {
        loadScript(RUN_ENV === "prod" ? "https://hs2.166.net/hs-public-data/hs_data/static/inc/hscards.min.js" : "https://hs-api-dev.lushi.163.com/static/inc/hscards.min.js", () => {
            window.HSCARDS["VIR_001"] = { Cost: "?", Rarity: 2, name_cn: "未知卡牌", name_en: "Unknown", Class: 0, CardID: "VIR_001", CardType: 4 };
        });
        window.fKnownCard = () => console.log("切换到对方卡组，开启卡组预测功能");
    }, []);
    useEffect(() => {
        window.SecretsLocation = (show, x, y) => {
            setShowSecretsLocation(show);
            SetSecretsLocation({
                x: (x * 100),
                y: (y * 100)
            });
        };
        window.SecretsInit = (list) => {
            setSecretState(true);
            changeSecret(list, "normal");
        };
        window.SecretsAdded = (list) => {
            changeSecret(list, "normal");
        };
        window.SecretsKnown = (list) => {
            changeSecret(list, "lighted");
        };
        window.SecretsRemoved = (list) => {
            changeSecret(list, "disabled");
        };
        window.SecretsDeleted = (hero) => {
            deleteSecret(hero);
        };
        window.SecretsRemoveKnown = (list) => {
            changeSecret(list, "normal");
        };
        window.SecretsEmpty = () => {
            setSecretState(false);
            secretRef.current = {};
            setSecret({});
        };
        window.fSetMarkEnabled = setMarkEnabled;
    }, []);
    useEffect(() => {
        window.showHoverRelevantCard = (id, x, y, direction, hero, showOrigin) => {
            if (fixedState && !id) {
                return;
            }
            else if (!fixedState && !id) {
                setShowState(false);
                setRelativeList([]);
            }
            else {
                const cardArr = id.split("|");
                const cardId = cardArr[0];
                const cardExtra = cardArr[1];
                setShowState(true);
                setShowWargameState(false);
                console.log(x, y);
                setPositionX(x ? `${x * 100}%` : `0`);
                setPositionY(y ? `${y * 100}%` : `0`);
                setPositionDirection(direction === "toright" ? "left" : "right");
                if (cardExtra) {
                    setRelativeList(cardExtra.split(","));
                }
                else {
                    const result = relativeStore === null || relativeStore === void 0 ? void 0 : relativeStore.find((v) => v === null || v === void 0 ? void 0 : v[cardId]);
                    if (result) {
                        let targetRelativeList = result === null || result === void 0 ? void 0 : result[cardId];
                        if ((result === null || result === void 0 ? void 0 : result.classCondition) === "own" && hero) {
                            const targetClass = CLASS_HERO_MAP[hero];
                            if (window.HSCARDS) {
                                targetRelativeList = targetRelativeList.filter((v) => {
                                    var _a, _b, _c, _d, _e, _f, _g;
                                    const hsClassObj = ((_a = window.HSCARDS[v]) === null || _a === void 0 ? void 0 : _a.Classes) ? ((_c = JSON.parse((_b = window.HSCARDS[v]) === null || _b === void 0 ? void 0 : _b.Classes)) !== null && _c !== void 0 ? _c : null) : null;
                                    return (!((_d = window.HSCARDS[v]) === null || _d === void 0 ? void 0 : _d.Class) && !((_e = window.HSCARDS[v]) === null || _e === void 0 ? void 0 : _e.Classes))
                                        || +((_f = window.HSCARDS[v]) === null || _f === void 0 ? void 0 : _f.Class) === 12
                                        || (((_g = window.HSCARDS[v]) === null || _g === void 0 ? void 0 : _g.Class) === (targetClass + ""))
                                        || (hsClassObj && (hsClassObj === null || hsClassObj === void 0 ? void 0 : hsClassObj.includes(targetClass + "")));
                                });
                            }
                        }
                        else if ((result === null || result === void 0 ? void 0 : result.classCondition) === "other" && hero) {
                            const targetClass = CLASS_HERO_MAP[hero];
                            if (window.HSCARDS) {
                                targetRelativeList = targetRelativeList.filter((v) => {
                                    var _a, _b, _c, _d, _e, _f, _g, _h;
                                    const hsClassObj = ((_a = window.HSCARDS[v]) === null || _a === void 0 ? void 0 : _a.Classes) ? ((_c = JSON.parse((_b = window.HSCARDS[v]) === null || _b === void 0 ? void 0 : _b.Classes)) !== null && _c !== void 0 ? _c : null) : null;
                                    if (v === "END_010") {
                                        console.log(targetClass, hsClassObj, "targetClass!!!");
                                    }
                                    return (!((_d = window.HSCARDS[v]) === null || _d === void 0 ? void 0 : _d.Class) && !((_e = window.HSCARDS[v]) === null || _e === void 0 ? void 0 : _e.Classes))
                                        || +((_f = window.HSCARDS[v]) === null || _f === void 0 ? void 0 : _f.Class) === 12
                                        || (((_g = window.HSCARDS[v]) === null || _g === void 0 ? void 0 : _g.Class) && ((_h = window.HSCARDS[v]) === null || _h === void 0 ? void 0 : _h.Class) !== (targetClass + ""))
                                        || (hsClassObj && !(hsClassObj === null || hsClassObj === void 0 ? void 0 : hsClassObj.includes(targetClass + "")));
                                });
                            }
                        }
                        setRelativeList(targetRelativeList);
                    }
                    else {
                        setShowState(false);
                        setRelativeList([]);
                    }
                }
                if (showOrigin) {
                    setShowOriginCard(cardId);
                }
                else {
                    setShowOriginCard("");
                }
            }
        };
    }, [fixedState, relativeStore]);
    useEffect(() => {
        window.showHoverFilterCard = (cardRegularMode, cardRegularJob, cardRegularType, x, y, direction, originCardId) => {
            var _a;
            if (fixedState && !cardRegularMode && !cardRegularJob && !cardRegularType) {
                return;
            }
            else if (!fixedState && !cardRegularMode && !cardRegularJob && !cardRegularType) {
                setShowState(false);
                setRelativeList([]);
                return;
            }
            setShowState(true);
            setShowWargameState(false);
            setPositionX(x ? `${x * 100}%` : `0`);
            setPositionY(y ? `${y * 100}%` : `0`);
            setPositionDirection(direction === "toright" ? "left" : "right");
            const isStandard = String(cardRegularMode) === "2";
            const cardSetSet = new Set((isStandard ? series.filter((v) => v.standard) : series).map((s) => String(s.id)));
            const filterJob = Array.isArray(cardRegularJob) && cardRegularJob.length > 0;
            const targetClassSet = new Set();
            let includeNeutral = false;
            if (filterJob) {
                for (const j of cardRegularJob) {
                    const js = String(j);
                    targetClassSet.add(js);
                    if (js === "12")
                        includeNeutral = true;
                }
            }
            const targetType = +cardRegularType;
            const hits = [];
            if (window.HSCARDS) {
                for (const cid in window.HSCARDS) {
                    const card = window.HSCARDS[cid];
                    if (!card || card.Collectible != 1)
                        continue;
                    if (!cardSetSet.has(String(card.CardSet)))
                        continue;
                    if (filterJob) {
                        let pass = false;
                        const hsClassObj = card.Classes ? ((_a = JSON.parse(card.Classes)) !== null && _a !== void 0 ? _a : null) : null;
                        if (hsClassObj) {
                            for (const tc of targetClassSet) {
                                if (hsClassObj.includes(tc)) {
                                    pass = true;
                                    break;
                                }
                            }
                        }
                        else if (card.Class) {
                            if (targetClassSet.has(String(card.Class)))
                                pass = true;
                        }
                        else {
                            if (includeNeutral)
                                pass = true;
                        }
                        if (!pass)
                            continue;
                    }
                    if (+card.CardType !== targetType)
                        continue;
                    hits.push(cid);
                }
            }
            setRelativeList(hits);
            if (originCardId) {
                setShowOriginCard(originCardId);
            }
            else {
                setShowOriginCard("");
            }
        };
    }, [fixedState, series]);
    useEffect(() => {
        const clientWidth = document.documentElement.clientWidth;
        const xrace = positionX === '0' ? 0 : parseFloat(positionX) / 100;
        const emptyWidth = clientWidth * (1 - xrace);
        if (positionDirection === "right" && ((relativeList.length === 1 && emptyWidth < 224) || (relativeList.length === 2 && emptyWidth < 362) || (relativeList.length > 2 && emptyWidth < 540))) {
            setPositionLeftZero(true);
        }
        else {
            setPositionLeftZero(false);
        }
    }, [relativeList, positionX, positionDirection]);
    useEffect(() => {
        const clientHeight = document.documentElement.clientHeight;
        const yrace = positionY === '0' ? 0 : parseFloat(positionY) / 100;
        const emptyHeight = clientHeight * (1 - yrace);
        if ((relativeList.length <= 3 && emptyHeight < 280) || (relativeList.length > 3 && emptyHeight < 507)) {
            setPositionBottomZero(true);
        }
        else {
            setPositionBottomZero(false);
        }
    }, [relativeList, positionY]);
    useEffect(() => {
        window.showClickRelevantCard = setFixedState;
        window.showBattleGroundBuild = showWargameGuide;
        window.clearOriginCard = () => setShowOriginCard("");
        loadRelativeJson();
        loadChessGroupJs();
        loadCardsDescJs();
    }, []);
    useEffect(() => {
        window.initMarkCards = initMarkCards;
    }, [initMarkCards]);
    useEffect(() => {
        if (secretState) {
            if (isSecretFirstShow.current === true) {
                isSecretFirstShow.current = false;
                setShowSecretContent(true);
            }
        }
    }, [secretState]);
    return (React.createElement("div", { className: "ceframe-view" },
        showOriginCard
            ? React.createElement("div", { className: "ceframe-relative-origin", style: {
                    top: `${!postionBottomZero ? positionY : 'unset'}`,
                    bottom: `${postionBottomZero ? 0 : 'unset'}`,
                    left: `${positionLeftZero ? 0 : positionDirection === 'left' ? positionX : 'unset'}`,
                    right: `${!positionLeftZero && positionDirection === 'right' ? positionX : 'unset'}`
                } },
                React.createElement("img", { className: "ceframe-relative-origin-img", src: `https://hs2.166.net/hs-card-img/card/${showOriginCard}.png` }))
            : null,
        React.createElement("div", { className: Classnames("ceframe-relative-frame", { show: showState }), style: {
                top: `${!postionBottomZero ? positionY : 'unset'}`,
                bottom: `${postionBottomZero ? 0 : 'unset'}`,
                left: `${positionLeftZero ? 0 : positionDirection === 'left' ? positionX : 'unset'}`,
                right: `${!positionLeftZero && positionDirection === 'right' ? positionX : 'unset'}`,
                marginLeft: showOriginCard ? "165px" : 0,
                marginTop: showOriginCard ? "-45px" : 0
            } },
            React.createElement("p", { className: "ceframe-relative-title" },
                "\u5173\u8054\u5361\u724C",
                fixedState ? "（已固定）" : ""),
            React.createElement("p", { className: "ceframe-relative-content" }, description),
            React.createElement("ul", { className: Classnames("ceframe-relative-list", { center: relativeList.length < 3 }) }, relativeList.map((item, i) => {
                return React.createElement("img", { className: "ceframe-relative-item", key: i, src: `https://hs2.166.net/hs-card-img/card/${item}.png` });
            })),
            React.createElement("div", { className: "ceframe-close", onClick: cancelFixedCard })),
        React.createElement("div", { className: Classnames("ceframe-wargame-frame", { show: showWargameState }) },
            React.createElement("p", { className: "ceframe-wargame-title" }, chessTarget === null || chessTarget === void 0 ? void 0 :
                chessTarget.title,
                "\u6559\u5B66"),
            React.createElement("div", { className: 'ceframe-wargame-groups' },
                chessGroupTabs,
                markEnabled
                    ? markedFlag
                        ? (React.createElement("div", { className: 'ceframe-wargame-mark-cancel', onClick: onCancelMark },
                            React.createElement("i", { className: 'ceframe-wargame-mark-cancel-icon' }),
                            "\u53D6\u6D88\u6807\u8BB0\u76F8\u5173\u968F\u4ECE"))
                        : (React.createElement("div", { className: 'ceframe-wargame-mark', onClick: onMark },
                            React.createElement("i", { className: 'ceframe-wargame-mark-icon' }),
                            "\u4E00\u952E\u6807\u8BB0\u76F8\u5173\u968F\u4ECE"))
                    : null),
            React.createElement("p", { className: "ceframe-wargame-content", dangerouslySetInnerHTML: { __html: (_d = currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.docDesc) === null || _d === void 0 ? void 0 : _d.replace(/\/n/g, "<br>") } }),
            ((_e = chessTarget === null || chessTarget === void 0 ? void 0 : chessTarget.extInfo) === null || _e === void 0 ? void 0 : _e.docImg) ? React.createElement("img", { className: "ceframe-max-height", src: currentTabItem === null || currentTabItem === void 0 ? void 0 : currentTabItem.docImg, alt: "" }) : null,
            React.createElement("div", { className: "ceframe-close", onClick: closeBattleWindow })),
        React.createElement(DraggableElement, { initialPosition: { x: (_f = secretsLocation === null || secretsLocation === void 0 ? void 0 : secretsLocation.x) !== null && _f !== void 0 ? _f : 50, y: (_g = secretsLocation === null || secretsLocation === void 0 ? void 0 : secretsLocation.y) !== null && _g !== void 0 ? _g : 50 }, onClick: () => onSecretGuideClick(), onDrag: updateLocation },
            React.createElement("div", { className: Classnames("ceframe-secrets-guide", { show: showSecretsLocation && secretState }) },
                React.createElement("div", { className: "ceframe-secrets-bg" }),
                showSecretContent && React.createElement("div", { className: 'ceframe-secrets-wrapper', style: { marginLeft: secretPositionRight ? "-262px" : "auto" } },
                    React.createElement("p", { className: 'ceframe-secrets-title' }, "\u5965\u79D8\u76D1\u63A7"),
                    React.createElement("div", { className: 'ceframe-secrets-content' }, Object.keys(secret).map((key, i) => {
                        return (React.createElement("div", { key: i },
                            !isEmptyObject(secret === null || secret === void 0 ? void 0 : secret[key]) && React.createElement("p", { className: "ceframe-secrets-job" }, HERO_MAP[key]),
                            React.createElement(TransitionGroup, null, Object.values(secret[key]).map((item, j) => {
                                return (React.createElement(CSSTransition, { key: item === null || item === void 0 ? void 0 : item.id, nodeRef: item === null || item === void 0 ? void 0 : item.nodeRef, timeout: 5000, classNames: "secrets-translateX" },
                                    React.createElement("div", { ref: item.nodeRef },
                                        React.createElement(Card, { showHit: (item === null || item === void 0 ? void 0 : item.status) === "lighted", info: window.HSCARDS && window.HSCARDS[item === null || item === void 0 ? void 0 : item.id], customDirection: "left" }))));
                            }))));
                    })))))));
}
