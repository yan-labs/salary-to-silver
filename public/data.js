/**
 * 几斤几两 | 俸禄换算 - 数据配置
 * 以明朝官制为基准
 */

// 单位换算常量
const CONVERSION = {
    GRAM_PER_LIANG: 37.3,      // 1两 = 37.3克
    LIANG_PER_JIN: 16,          // 1斤 = 16两
    QIAN_PER_LIANG: 10,         // 1两 = 10钱
    FEN_PER_QIAN: 10,           // 1钱 = 10分
};

// 默认银价（元/克），当API获取失败时使用
const DEFAULT_SILVER_PRICE = 6.5;

// 明朝俸禄品级数据
// 月俸单位：两
const RANK_DATA = [
    {
        grade: "正一品",
        position: "太师、太傅、太保",
        monthlyLiang: 87,
        description: "位极人臣，一人之下万人之上。掌国家大政，辅佐天子。",
        sealChar: "极"
    },
    {
        grade: "从一品",
        position: "少师、少傅、少保",
        monthlyLiang: 74,
        description: "朝廷重臣，参与机要。虽非宰执，亦为国之栋梁。",
        sealChar: "贵"
    },
    {
        grade: "正二品",
        position: "六部尚书、都御史",
        monthlyLiang: 61,
        description: "执掌一部，统领百官。国家大事，皆需过目。",
        sealChar: "尊"
    },
    {
        grade: "从二品",
        position: "布政使、按察使",
        monthlyLiang: 48,
        description: "封疆大吏，一省之长。民生刑狱，皆在掌中。",
        sealChar: "显"
    },
    {
        grade: "正三品",
        position: "参政、副使",
        monthlyLiang: 35,
        description: "省级要员，辅佐藩台。承上启下，政务繁忙。",
        sealChar: "荣"
    },
    {
        grade: "从三品",
        position: "知府、参议",
        monthlyLiang: 26,
        description: "太守之职，一府之主。教化百姓，兴利除弊。",
        sealChar: "达"
    },
    {
        grade: "正四品",
        position: "知州、同知",
        monthlyLiang: 24,
        description: "州官之任，承宣政令。民间疾苦，悉心关照。",
        sealChar: "正"
    },
    {
        grade: "从四品",
        position: "通判、佥事",
        monthlyLiang: 21,
        description: "佐贰之官，分理庶务。虽非正印，亦有实权。",
        sealChar: "佐"
    },
    {
        grade: "正五品",
        position: "知县、郎中",
        monthlyLiang: 16,
        description: "亲民之官，百里侯也。一县之事，皆赖此身。",
        sealChar: "治"
    },
    {
        grade: "从五品",
        position: "员外郎、州同",
        monthlyLiang: 14,
        description: "部院属官，办理政务。虽位不高，亦有作为。",
        sealChar: "理"
    },
    {
        grade: "正六品",
        position: "通判、主事",
        monthlyLiang: 10,
        description: "中层官员，承办公文。勤勉任事，渐入仕途。",
        sealChar: "勤"
    },
    {
        grade: "从六品",
        position: "县丞、推官",
        monthlyLiang: 8,
        description: "县中佐官，协理县务。刑名钱粮，各有分管。",
        sealChar: "勉"
    },
    {
        grade: "正七品",
        position: "县令、知事",
        monthlyLiang: 7.5,
        description: "芝麻小官，却是起点。古人云：不积跬步，无以至千里。",
        sealChar: "始"
    },
    {
        grade: "从七品",
        position: "主簿、判官",
        monthlyLiang: 7,
        description: "掌管文书，记录在案。虽是末吏，亦需谨慎。",
        sealChar: "记"
    },
    {
        grade: "正八品",
        position: "县丞佐官",
        monthlyLiang: 6.5,
        description: "小小官职，初入仕林。前路漫漫，尚需努力。",
        sealChar: "初"
    },
    {
        grade: "从八品",
        position: "训导、司狱",
        monthlyLiang: 6,
        description: "末流小吏，勉强糊口。但求无过，安稳度日。",
        sealChar: "末"
    },
    {
        grade: "正九品",
        position: "典史、巡检",
        monthlyLiang: 5.5,
        description: "九品芝麻官，亦是朝廷命官。虽卑微，胜于白丁。",
        sealChar: "卑"
    },
    {
        grade: "从九品",
        position: "驿丞、河泊",
        monthlyLiang: 5,
        description: "末等官员，勉强入品。驿站河道，各司其职。",
        sealChar: "微"
    },
    {
        grade: "未入流",
        position: "小吏、书办",
        monthlyLiang: 3,
        description: "不入品级，但有公职。衙门差事，混口饭吃。",
        sealChar: "吏"
    },
    {
        grade: "富农",
        position: "殷实之家",
        monthlyLiang: 2,
        description: "家有薄产，衣食无忧。虽非官宦，亦是乡绅。",
        sealChar: "农"
    },
    {
        grade: "自耕农",
        position: "普通农户",
        monthlyLiang: 1.5,
        description: "一亩三分地，日出而作。勤劳节俭，养家糊口。",
        sealChar: "耕"
    },
    {
        grade: "佃户",
        position: "租田为生",
        monthlyLiang: 0.8,
        description: "无田可耕，租种他人。辛苦一年，所剩无几。",
        sealChar: "佃"
    },
    {
        grade: "贫民",
        position: "打零工者",
        monthlyLiang: 0.5,
        description: "无田无业，做工度日。今朝有酒今朝醉，明日愁来明日忧。",
        sealChar: "贫"
    },
    {
        grade: "乞丐",
        position: "沿街乞讨",
        monthlyLiang: 0,
        description: "身无分文，沿街讨饭。世态炎凉，尝尽人间苦。",
        sealChar: "丐"
    }
];

// 获取匹配的官职等级
function matchRank(monthlyLiang) {
    // 从高到低遍历，找到第一个月俸小于等于用户月俸的等级
    for (let i = 0; i < RANK_DATA.length; i++) {
        if (monthlyLiang >= RANK_DATA[i].monthlyLiang) {
            return RANK_DATA[i];
        }
    }
    // 如果比最低的还低，返回最后一个（乞丐）
    return RANK_DATA[RANK_DATA.length - 1];
}

// 将克转换为两、钱
function gramToLiangQian(gram) {
    const totalLiang = gram / CONVERSION.GRAM_PER_LIANG;
    const liang = Math.floor(totalLiang);
    const qian = Math.round((totalLiang - liang) * CONVERSION.QIAN_PER_LIANG);

    return {
        liang: liang,
        qian: qian,
        totalLiang: totalLiang.toFixed(2)
    };
}

// 导出供 script.js 使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONVERSION,
        DEFAULT_SILVER_PRICE,
        RANK_DATA,
        matchRank,
        gramToLiangQian
    };
}
