const GAME_MODE = {
    1: {
        name: "狂野模式",
        key: "FT_WILD"
    },
    2: {
        name: "标准模式",
        key: "FT_STANDARD"
    }
};
const RARITY_MAP = {
    1: 40,
    2: 0,
    3: 100,
    4: 400,
    5: 1600
};
const RARITY_NAME_MAP = {
    1: "普通",
    2: "基本",
    3: "稀有",
    4: "史诗",
    5: "传说"
};
const HERO_MAP = {
    1: "战士",
    2: "萨满",
    3: "潜行者",
    4: "圣骑士",
    5: "猎人",
    6: "德鲁伊",
    7: "术士",
    8: "法师",
    9: "牧师",
    10: "恶魔猎手",
    11: "死亡骑士",
};
const HERO_CN_MAP = {
    "战士": 1,
    "萨满": 2,
    "盗贼": 3,
    "潜行者": 3,
    "圣骑士": 4,
    "猎人": 5,
    "德鲁伊": 6,
    "术士": 7,
    "法师": 8,
    "牧师": 9,
    "BOSS": 0,
    "恶魔猎手": 10,
    "死亡骑士": 11,
};
const HERO_CLASS_MAP = {
    1: 11,
    2: 6,
    3: 5,
    4: 8,
    5: 4,
    6: 9,
    7: 3,
    8: 2,
    9: 7,
    10: 1,
    14: 10,
    101: 101,
    102: 102,
    103: 103,
    104: 104,
    105: 105,
    106: 106
};
const CLASS_HERO_MAP = {
    1: 10,
    2: 8,
    3: 7,
    4: 5,
    5: 3,
    6: 2,
    7: 9,
    8: 4,
    9: 6,
    10: 14,
    11: 1,
    101: 101,
    102: 102,
    103: 103,
    104: 104,
    105: 105,
    106: 106
};
const ENG_HERO_MAP = {
    "warrior": "战士",
    "mage": "法师",
    "deathknight": "死亡骑士",
    "warlock": "术士",
    "rogue": "盗贼",
    "shaman": "萨满",
    "druid": "德鲁伊",
    "paladin": "圣骑士",
    "hunter": "猎人",
    "priest": "牧师",
    "demonhunter": "恶魔猎手"
};
const CARD_TYPE_MAP = {
    3: "英雄",
    4: "随从",
    5: "法术",
    7: "武器",
    39: "地标"
};
const SECRET_MAP = {
    3: ['BT_042', 'BT_707', 'BT_709', 'CORE_BT_707', 'CORE_LOOT_204', 'CORE_MAW_018', 'CORE_REV_825', 'CORE_REV_827', 'CORE_REV_828', 'CORE_SCH_706', 'DMF_513', 'LOOT_204', 'LOOT_210', 'LOOT_214', 'MAW_018', 'REV_825', 'REV_827', 'REV_828', 'SCH_706', 'YOP_017'],
    4: ['AT_073', 'BAR_550', 'BOT_908', 'CFM_800', 'CORE_CS3_016', 'CORE_EX1_130', 'CORE_FP1_020', 'CS3_016', 'DAL_570', 'DMF_236', 'EX1_130', 'EX1_132', 'EX1_136', 'EX1_379', 'FP1_020', 'GIL_903', 'LOE_027', 'VAN_EX1_130', 'VAN_EX1_132', 'VAN_EX1_136', 'VAN_EX1_379', 'WC_033'],
    5: ['AT_060', 'AV_226', 'BT_203', 'CFM_026', 'CORE_EX1_554', 'CORE_ICC_200', 'CORE_KAR_004', 'CORE_LOOT_079', 'CORE_MAW_010', 'DMF_123', 'EX1_533', 'EX1_554', 'EX1_609', 'EX1_610', 'EX1_611', 'GIL_577', 'ICC_200', 'JAM_003', 'KAR_004', 'LOE_021', 'LOOT_079', 'MAW_010', 'NX2_013', 'TSC_929', 'TTN_504', 'ULD_152', 'VAN_EX1_533', 'VAN_EX1_554', 'VAN_EX1_609', 'VAN_EX1_610', 'VAN_EX1_611', 'WON_018'],
    8: ['AT_002', 'BAR_812', 'CORE_BAR_812', 'BT_003', 'CFM_620', 'CORE_EX1_294', 'CORE_ICC_082', 'CORE_MAW_006', 'CORE_REV_516', 'DEEP_000', 'DMF_107', 'EX1_287', 'EX1_289', 'EX1_294', 'EX1_295', 'EX1_594', 'FP1_018', 'ICC_082', 'LOOT_101', 'MAW_006', 'REV_516', 'TRL_400', 'tt_010', 'ULD_239', 'UNG_024', 'VAN_EX1_287', 'VAN_EX1_289', 'VAN_EX1_294', 'VAN_EX1_295', 'VAN_EX1_594', 'VAN_tt_010', 'WW_422']
};
const PACKAGE_AHIEVE = {
    enCN: {
        0: `BOX给你加祝福了，赶紧开包吧！`,
        1: `天啦噜，运气也太好了，请珍惜你的神之右手！`,
        2: `盒子君加的BUFF非同小可啊，快去分享吧！`,
        3: `虽然开了不少包，但橙卡之神还是眷顾你的`,
        4: `这么多史诗！紫色是你的幸运色`,
        5: `这么多包都没有橙，遥远非洲才是你的故乡`,
        6: `连续N包都是蓝天白云，你一定很爱护环境`,
        7: `卡包价值远超常人，欧皇血统舍你其谁！`,
        8: `平凡世界平凡包，金橙就在下一包`,
        9: `太惨啦，别开包了，先去打猎吧！`
    },
    enUS: {
        0: `HSBox has already blessed you，come and open packs.`,
        1: `OMG, that\'s incredible！Please do cherish your golden right hand.`,
        2: `That was a incomparable buff HSBox gave you, go share it!`,
        3: `A lot of packs thought, fair to middling to get a legendary.`,
        4: `You got so many epics, purple is absolutely your lucky color.`,
        5: `So many packs but without a legendary, It's just not your day today.`,
        6: `You got only blue sky and white clouds in so many packs, you must be a environmentalist.`,
        7: `This pack values way far more than ordinary people, knock on wood!`,
        8: `A common you just got a common pack in a common world. What? Golden legendary? Err…Maybe next pack,`,
        9: `How miserable! Just go hunting instead of continue open packs.`
    }
};
const SORT_MAP = {
    0: "A",
    1: "B",
    2: "C",
    3: "D",
    4: "E",
    5: "F",
    6: "G",
    7: "H",
    8: "I",
    9: "J",
    10: "K",
    11: "L",
    12: "M",
    13: "N",
    14: "O",
    15: "P",
    16: "Q",
    17: "R",
    18: "S",
    19: "T",
    20: "U",
    21: "V",
    22: "W",
    23: "X",
    24: "Y",
    25: "Z"
};
export { CARD_TYPE_MAP, ENG_HERO_MAP, RARITY_MAP, RARITY_NAME_MAP, HERO_MAP, HERO_CN_MAP, HERO_CLASS_MAP, CLASS_HERO_MAP, SECRET_MAP, GAME_MODE, PACKAGE_AHIEVE, SORT_MAP };
