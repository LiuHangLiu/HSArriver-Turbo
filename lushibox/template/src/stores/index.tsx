import { proxy } from "valtio";
const STORE = proxy({
    myUrs: "",
    myBtag: "",
    myDeviceId: "",
    mySid: "",
    isShowLadderRecommend: false,
    isShowLadderCemetery: true,
    extraWidth: 0,
    extraHeight: 0,
    expandPanelEnabled: false,
    isLeftAreaEnabled: false,
    isTopAreaEnabled: false,
    isRightAreaEnabled: false,
    isBottomAreaEnabled: false,
    horizontal: 0,
    vertical: 0,
    dataSource: "hsang",
    positionType: 1,
    fixedRelativeCard: false,
    fixedCardId: "",
    checkOppEnable: true,
    copyDeckTip: ""
});
function GetStore(name) {
    return STORE[name];
}
function SetStore(name, value) {
    STORE[name] = value;
}
export { STORE, GetStore, SetStore };
