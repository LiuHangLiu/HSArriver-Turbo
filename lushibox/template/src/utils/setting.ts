var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import _ from 'lodash';
import * as config from './getting';
import { HsboxClient } from "@hsbox/api";
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}
function loadScript(url, callback) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = () => {
        if (callback)
            callback();
    };
    script.onerror = (error) => {
        console.error(`Failed to load script from ${url}`, error);
    };
    document.body.appendChild(script);
}
const EFFECT_CONFIG = {
    'Divine Shield': { enCN: '圣盾', enUS: 'D.S.' },
    Adapt: { enCN: '进化', enUS: 'Adapt' },
    Battlecry: { enCN: '战吼', enUS: 'Battlecry' },
    Charge: { enCN: '冲锋', enUS: 'Charge' },
    Choose_One: { enCN: '抉择', enUS: 'Choose One' },
    Colossal: { enCN: '巨型', enUS: 'Colossal' },
    Combo: { enCN: '连击', enUS: 'Combo' },
    Corrupt: { enCN: '腐蚀', enUS: 'Corrupt' },
    Dark_Gift: { enCN: '黑暗之赐', enUS: 'Dark Gift' },
    Deathrattle: { enCN: '亡语', enUS: 'Deathrattle' },
    Discover: { enCN: '发现', enUS: 'Discover' },
    Dredge: { enCN: '探底', enUS: 'Dredge' },
    Echo: { enCN: '回响', enUS: 'Echo' },
    Elusive: { enCN: '扰魔', enUS: 'Elusive' },
    Empower: { enCN: '祈求', enUS: 'Invoked' },
    Enrage: { enCN: '激怒', enUS: 'Enrage' },
    Forge: { enCN: '锻造', enUS: 'Forge' },
    Freeze: { enCN: '冻结', enUS: 'Freeze' },
    Frenzy: { enCN: '暴怒', enUS: 'Frenzy' },
    HonorableKill: { enCN: '荣誉', enUS: 'HonorableKill' },
    Imbue: { enCN: '灌注', enUS: 'Imbue' },
    Infuse: { enCN: '注能', enUS: 'Infuse' },
    Inspire: { enCN: '激励', enUS: 'Inspire' },
    Magnetic: { enCN: '磁力', enUS: 'Magnetic' },
    Outcast: { enCN: '流放', enUS: 'Outcast' },
    Overheal: { enCN: '过量治疗', enUS: 'Overheal' },
    Overkill: { enCN: '超杀', enUS: 'Overkill' },
    Poisonous: { enCN: '剧毒', enUS: 'Poisonous' },
    Reborn: { enCN: '复生', enUS: 'Reborn' },
    Recall: { enCN: '过载', enUS: 'Recall' },
    Rush: { enCN: '突袭', enUS: 'Rush' },
    Secret: { enCN: '奥秘', enUS: 'Secret' },
    Silence: { enCN: '沉默', enUS: 'Silence' },
    Spellburst: { enCN: '法迸', enUS: 'Spellburst' },
    Spellpower: { enCN: '法伤', enUS: 'Spellpower' },
    Stealth: { enCN: '潜行', enUS: 'Stealth' },
    Taunt: { enCN: '嘲讽', enUS: 'Taunt' },
    Tradeable: { enCN: '可交易', enUS: 'Tradeable' },
    Twinspell: { enCN: '双生', enUS: 'Twinspell' },
    Vampire: { enCN: '吸血', enUS: 'Vampire' },
    Windfury: { enCN: '风怒', enUS: 'Windfury' },
    Kindred: { enCN: '延系', enUS: 'Kindred' },
    Rewind: { enCN: '回溯', enUS: 'Rewind' },
    Fabled: { enCN: '奇闻', enUS: 'Fabled' },
    Herald: { enCN: '兆示', enUS: 'Herald' },
    Shatter: { enCN: '裂变', enUS: 'Shatter' },
};
function analysisCg(cg, param) {
    if (typeof (cg) == 'string') {
        cg = cg.split(',');
    }
    let options = {
        sort: true,
    };
    options = Object.assign({}, options, param);
    let result = {
        sum: 0,
        dust: 0,
        list: [],
        rarity: {
            5: {
                sum: 0,
                data: {}
            },
            4: {
                sum: 0,
                data: {}
            },
            3: {
                sum: 0,
                data: {}
            }
        },
        curve: {
            Cost: [0, 0, 0, 0, 0, 0, 0, 0],
            Atk: [0, 0, 0, 0, 0, 0, 0, 0],
            Health: [0, 0, 0, 0, 0, 0, 0, 0]
        },
        cardType: {
            3: {
                curve: [0, 0, 0, 0, 0, 0, 0, 0],
                sum: 0
            },
            4: {
                curve: [0, 0, 0, 0, 0, 0, 0, 0],
                sum: 0
            },
            5: {
                curve: [0, 0, 0, 0, 0, 0, 0, 0],
                sum: 0
            },
            7: {
                curve: [0, 0, 0, 0, 0, 0, 0, 0],
                sum: 0
            },
            39: {
                curve: [0, 0, 0, 0, 0, 0, 0, 0],
                sum: 0
            }
        },
        effect: _.mapValues(EFFECT_CONFIG, v => (Object.assign(Object.assign({}, v), { n: 0 }))),
        race: {
            2: { enCN: '德莱尼', enUS: 'Draenei', n: 0 },
            6: { enCN: '人类', enUS: 'Human', n: 0 },
            8: { enCN: '兽人', enUS: 'Orcs', n: 0 },
            11: { enCN: '亡灵', enUS: 'Undead', n: 0 },
            12: { enCN: '狼人', enUS: 'Worgen', n: 0 },
            14: { enCN: '鱼人', enUS: 'Murloc', n: 0 },
            15: { enCN: '恶魔', enUS: 'Demon', n: 0 },
            17: { enCN: '机械', enUS: 'Mech', n: 0 },
            18: { enCN: '元素', enUS: 'Elemental', n: 0 },
            19: { enCN: '食人魔', enUS: 'Ogre', n: 0 },
            20: { enCN: '野兽', enUS: 'Beast', n: 0 },
            21: { enCN: '图腾', enUS: 'Totem', n: 0 },
            23: { enCN: '海盗', enUS: 'Pirate', n: 0 },
            24: { enCN: '龙', enUS: 'Dragon', n: 0 },
            26: { enCN: '全部', enUS: 'All', n: 0 },
            43: { enCN: '野猪', enUS: 'Quilboar', n: 0 },
            92: { enCN: '纳迦', enUS: 'Naga', n: 0 }
        }
    };
    if (typeof (window.HSCARDS) == 'undefined') {
        return result;
    }
    let cgCount = function (id, num) {
        if (options.curve) {
            Object.keys(result.curve).forEach((key, i) => {
                let curveKey = window.HSCARDS[id][key];
                if (curveKey !== '') {
                    if (curveKey >= 7) {
                        result.curve[key][7] += num;
                    }
                    else {
                        result.curve[key][curveKey] += num;
                    }
                }
            });
        }
        let ctypeKey = window.HSCARDS[id].CardType;
        if (options.type && ctypeKey) {
            let ctypeCurve = result.cardType[ctypeKey].curve;
            result.cardType[ctypeKey].sum += num;
            let ctypeCurveKey = window.HSCARDS[id].Cost;
            if (ctypeCurveKey && ctypeCurveKey != '') {
                if (ctypeCurveKey >= 7) {
                    ctypeCurve[7] += num;
                }
                else {
                    ctypeCurve[ctypeCurveKey] += num;
                }
            }
        }
        if (options.effect) {
            Object.keys(result.effect).forEach((key, i) => {
                if (window.HSCARDS[id][key] && window.HSCARDS[id][key] !== '') {
                    result.effect[key].n += num;
                }
            });
        }
        if (options.race) {
            let race = window.HSCARDS[id].Race;
            if (result.race[race]) {
                result.race[race].n += num;
            }
        }
        let rarity = window.HSCARDS[id]['Rarity'];
        if (options.rarity) {
            if (result.rarity[rarity]) {
                result.rarity[rarity]['sum'] += num;
                result.rarity[rarity]['data'][id] = num;
            }
        }
        if (options.dust) {
            result['dust'] += config.RARITY_MAP[rarity] * num;
        }
    };
    cg.map((item) => {
        var _a, _b;
        let card = item.split(':');
        let id = card[0];
        let num = parseInt(card[1], 10);
        let ysk = 0;
        if (options.ysk) {
            ysk = num == 1 ? 1 : 0;
            num = 1;
        }
        if (window.HSCARDS && id.includes(".") && window.HSCARDS[id.split(".")[0]]) {
            const idArr = id.split(".");
            const realId = idArr[0];
            let o = JSON.parse(JSON.stringify(window.HSCARDS[realId]));
            o['Cost'] = parseInt(window.HSCARDS[realId].Cost, 10);
            o['ysk'] = ysk;
            if (idArr === null || idArr === void 0 ? void 0 : idArr[1]) {
                o['num'] = 1;
            }
            else {
                o['num'] = num;
            }
            o['SpecialCardID'] = id;
            if (idArr === null || idArr === void 0 ? void 0 : idArr[2]) {
                const OriginId = id.includes(".") && ((_a = id.split(".")) === null || _a === void 0 ? void 0 : _a.length) > 2 && realId === "VIR_001" ? id.split(".")[2] : "";
                o['OriginName'] = (_b = window.HSCARDS[OriginId]) === null || _b === void 0 ? void 0 : _b.name_cn;
            }
            if (idArr === null || idArr === void 0 ? void 0 : idArr[3]) {
                const ExtraText = `(${idArr === null || idArr === void 0 ? void 0 : idArr[3]})`;
                o['ExtraText'] = ExtraText;
            }
            result.list.push(o);
            result.sum += num;
            cgCount(realId, num);
        }
        else if (window.HSCARDS && window.HSCARDS[id] && window.HSCARDS[id]['Class'] != '-1') {
            let o = JSON.parse(JSON.stringify(window.HSCARDS[id]));
            o['Cost'] = parseInt(window.HSCARDS[id].Cost, 10);
            o['ysk'] = ysk;
            o['num'] = num;
            result.list.push(o);
            result.sum += num;
            cgCount(id, num);
        }
    });
    if (options.sort) {
        result.list = _.sortBy(result.list, 'Cost');
    }
    return result;
}
function rankMapFunc(level) {
    if (!level) {
        return { id: "bronze", name: "青铜", level: 10 };
    }
    else if (level >= 1 && level <= 10) {
        return { id: "bronze", name: "青铜", level: 11 - level % 10 - (level % 10 !== 0 ? 0 : 10) };
    }
    else if (level >= 11 && level <= 20) {
        return { id: "silver", name: "白银", level: 11 - level % 10 - (level % 10 !== 0 ? 0 : 10) };
    }
    else if (level >= 21 && level <= 30) {
        return { id: "gold", name: "黄金", level: 11 - level % 10 - (level % 10 !== 0 ? 0 : 10) };
    }
    else if (level >= 31 && level <= 40) {
        return { id: "platinum", name: "白金", level: 11 - level % 10 - (level % 10 !== 0 ? 0 : 10) };
    }
    else if (level >= 41 && level <= 50) {
        return { id: "diamond", name: "钻石", level: 11 - level % 10 - (level % 10 !== 0 ? 0 : 10) };
    }
    else {
        return { id: "legend", name: "传说" };
    }
}
;
function parseUrlSearch() {
    const { search } = location;
    return search ? search.replace(/(^\?)|(&$)/g, "").split("&")
        .reduce((t, v) => {
        const [key, val] = v.split("=");
        t[key] = decodeURIComponent(val);
        return t;
    }, {}) : {};
}
function loadJSON(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(url);
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            const data = yield response.json();
            console.log(data);
            return data;
        }
        catch (error) {
            console.error('获取JSON失败:', error);
        }
    });
}
function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}
const showCard = (cardId, x, y) => {
    console.log(cardId, x, y);
    HsboxClient.showRelevantCard(cardId, x, y);
};
const debouncedShowCard = debounce(showCard, 300);
export { isObject, analysisCg, rankMapFunc, loadScript, loadJSON, parseUrlSearch, debounce, showCard, debouncedShowCard, EFFECT_CONFIG };
