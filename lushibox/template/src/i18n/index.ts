import { parseUrlSearch } from "@/utils";
const { lang } = parseUrlSearch();
const LANG_MAP = {
    当前模式环境: {
        en: "Game Mode Environment",
        zh: "当前模式环境"
    },
    卡组占比: {
        en: "Decks",
        zh: "卡组占比"
    },
    职业占比: {
        en: "Class",
        zh: "职业占比"
    },
    过去12小时: {
        en: "Last 12 hours",
        zh: "过去12小时"
    },
    过去3天: {
        en: "Last 3 days",
        zh: "过去3天"
    },
    过去7天: {
        en: "Last 7 days",
        zh: "过去7天"
    },
    过去30天: {
        en: "Last 30 days",
        zh: "过去30天"
    },
    传说分段: {
        en: "Legend",
        zh: "传说"
    },
    传说前1000: {
        en: "Legend: Top 1,000",
        zh: "传说前1000"
    },
    "钻石4-钻石1": {
        en: "Diamond: 4-1",
        zh: "钻石4-钻石1"
    },
    "钻石10-钻石5": {
        en: "Diamond: 10-5",
        zh: "钻石10-钻石5"
    },
    其余段位: {
        en: "Other ranks",
        zh: "其余段位"
    },
    胜率最高: {
        en: "Highest win rate",
        zh: "胜率最高"
    },
    选取率最高: {
        en: "Highest selection rate",
        zh: "选取率最高"
    },
    上分最快: {
        en: "Fastest score",
        zh: "上分最快"
    },
    场: {
        en: "",
        zh: "场"
    },
    死亡骑士: {
        en: "Death Knight",
        zh: "死亡骑士"
    },
    德鲁伊: {
        en: "Druid",
        zh: "德鲁伊"
    },
    猎人: {
        en: "Hunter",
        zh: "猎人"
    },
    法师: {
        en: "Mage",
        zh: "法师"
    },
    圣骑士: {
        en: "Paladin",
        zh: "圣骑士"
    },
    牧师: {
        en: "Priest",
        zh: "牧师"
    },
    盗贼: {
        en: "Rogue",
        zh: "潜行者"
    },
    萨满: {
        en: "Shaman",
        zh: "萨满祭司"
    },
    术士: {
        en: "Warlock",
        zh: "术士"
    },
    战士: {
        en: "Warrior",
        zh: "战士"
    },
    恶魔猎手: {
        en: "Demon Hunter",
        zh: "恶魔猎手"
    },
    已复制到剪贴板: {
        en: "Copied to clipboard",
        zh: "已复制到剪贴板"
    },
    时: {
        en: "hour",
        zh: "时"
    }
};
const langV = (lang !== "zh" && lang !== "en") ? "zh" : lang;
const PAGE_TEXT = Object.entries(LANG_MAP)
    .reduce((t, v) => (t[v[0]] = v[1][langV], t), {});
export default PAGE_TEXT;
