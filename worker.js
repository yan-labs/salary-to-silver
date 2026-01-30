/**
 * 几斤几两 - Cloudflare Worker
 * 服务端渲染，所有数据实时计算
 */

// ============ 数据配置 ============
const CONVERSION = {
    GRAM_PER_LIANG: 37.3,
    LIANG_PER_JIN: 16,
    QIAN_PER_LIANG: 10,
};

const DEFAULT_SILVER_PRICE = 22.5;

const RANK_DATA = [
    { grade: "正一品", position: "太师、太傅、太保", monthlyLiang: 87, description: "位极人臣，一人之下万人之上。掌国家大政，辅佐天子。", sealChar: "极" },
    { grade: "从一品", position: "少师、少傅、少保", monthlyLiang: 74, description: "朝廷重臣，参与机要。虽非宰执，亦为国之栋梁。", sealChar: "贵" },
    { grade: "正二品", position: "六部尚书、都御史", monthlyLiang: 61, description: "执掌一部，统领百官。国家大事，皆需过目。", sealChar: "尊" },
    { grade: "从二品", position: "布政使、按察使", monthlyLiang: 48, description: "封疆大吏，一省之长。民生刑狱，皆在掌中。", sealChar: "显" },
    { grade: "正三品", position: "参政、副使", monthlyLiang: 35, description: "省级要员，辅佐藩台。承上启下，政务繁忙。", sealChar: "荣" },
    { grade: "从三品", position: "知府、参议", monthlyLiang: 26, description: "太守之职，一府之主。教化百姓，兴利除弊。", sealChar: "达" },
    { grade: "正四品", position: "知州、同知", monthlyLiang: 24, description: "州官之任，承宣政令。民间疾苦，悉心关照。", sealChar: "正" },
    { grade: "从四品", position: "通判、佥事", monthlyLiang: 21, description: "佐贰之官，分理庶务。虽非正印，亦有实权。", sealChar: "佐" },
    { grade: "正五品", position: "知县、郎中", monthlyLiang: 16, description: "亲民之官，百里侯也。一县之事，皆赖此身。", sealChar: "治" },
    { grade: "从五品", position: "员外郎、州同", monthlyLiang: 14, description: "部院属官，办理政务。虽位不高，亦有作为。", sealChar: "理" },
    { grade: "正六品", position: "通判、主事", monthlyLiang: 10, description: "中层官员，承办公文。勤勉任事，渐入仕途。", sealChar: "勤" },
    { grade: "从六品", position: "县丞、推官", monthlyLiang: 8, description: "县中佐官，协理县务。刑名钱粮，各有分管。", sealChar: "勉" },
    { grade: "正七品", position: "县令、知事", monthlyLiang: 7.5, description: "芝麻小官，却是起点。古人云：不积跬步，无以至千里。", sealChar: "始" },
    { grade: "从七品", position: "主簿、判官", monthlyLiang: 7, description: "掌管文书，记录在案。虽是末吏，亦需谨慎。", sealChar: "记" },
    { grade: "正八品", position: "县丞佐官", monthlyLiang: 6.5, description: "小小官职，初入仕林。前路漫漫，尚需努力。", sealChar: "初" },
    { grade: "从八品", position: "训导、司狱", monthlyLiang: 6, description: "末流小吏，勉强糊口。但求无过，安稳度日。", sealChar: "末" },
    { grade: "正九品", position: "典史、巡检", monthlyLiang: 5.5, description: "九品芝麻官，亦是朝廷命官。虽卑微，胜于白丁。", sealChar: "卑" },
    { grade: "从九品", position: "驿丞、河泊", monthlyLiang: 5, description: "末等官员，勉强入品。驿站河道，各司其职。", sealChar: "微" },
    { grade: "未入流", position: "小吏、书办", monthlyLiang: 3, description: "不入品级，但有公职。衙门差事，混口饭吃。", sealChar: "吏" },
    { grade: "富农", position: "殷实之家", monthlyLiang: 2, description: "家有薄产，衣食无忧。虽非官宦，亦是乡绅。", sealChar: "农" },
    { grade: "自耕农", position: "普通农户", monthlyLiang: 1.5, description: "一亩三分地，日出而作。勤劳节俭，养家糊口。", sealChar: "耕" },
    { grade: "佃户", position: "租田为生", monthlyLiang: 0.8, description: "无田可耕，租种他人。辛苦一年，所剩无几。", sealChar: "佃" },
    { grade: "贫民", position: "打零工者", monthlyLiang: 0.5, description: "无田无业，做工度日。今朝有酒今朝醉，明日愁来明日忧。", sealChar: "贫" },
    { grade: "乞丐", position: "沿街乞讨", monthlyLiang: 0, description: "身无分文，沿街讨饭。世态炎凉，尝尽人间苦。", sealChar: "丐" },
];

// ============ 工具函数 ============
function matchRank(monthlyLiang) {
    for (const rank of RANK_DATA) {
        if (monthlyLiang >= rank.monthlyLiang) return rank;
    }
    return RANK_DATA[RANK_DATA.length - 1];
}

function gramToLiangQian(gram) {
    const totalLiang = gram / CONVERSION.GRAM_PER_LIANG;
    return {
        liang: Math.floor(totalLiang),
        qian: Math.round((totalLiang - Math.floor(totalLiang)) * CONVERSION.QIAN_PER_LIANG),
        totalLiang: totalLiang.toFixed(2)
    };
}

// ============ 获取银价 ============
async function getSilverPrice() {
    try {
        const response = await fetch('https://data-asg.goldprice.org/dbXRates/CNY');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data?.items?.[0]?.xagPrice) {
            return {
                price: parseFloat((data.items[0].xagPrice / 31.1035).toFixed(2)),
                source: 'GoldPrice.org',
                change: data.items[0].pcXag
            };
        }
    } catch (e) {
        console.error('获取银价失败:', e);
    }
    return { price: DEFAULT_SILVER_PRICE, source: '参考价格', change: 0 };
}

// ============ 主处理函数 ============
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // API 路由
        if (url.pathname === '/api/silver-price') {
            const priceData = await getSilverPrice();
            return new Response(JSON.stringify(priceData), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 静态资源
        if (url.pathname !== '/' && !url.pathname.endsWith('.html')) {
            return env.ASSETS.fetch(request);
        }

        // 主页面 - 服务端渲染
        const priceData = await getSilverPrice();
        const html = renderHTML(priceData);

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'public, max-age=300' // 5分钟缓存
            }
        });
    }
};

// ============ 渲染 HTML ============
function renderHTML(priceData) {
    const price = priceData.price;
    const source = priceData.source;

    // 计算示例数据（月薪1万）
    const salary10k = 10000;
    const gram10k = salary10k / price;
    const liang10k = (gram10k / CONVERSION.GRAM_PER_LIANG).toFixed(1);
    const rank10k = matchRank(gram10k / CONVERSION.GRAM_PER_LIANG);

    // 正七品县令换算
    const rank7 = RANK_DATA.find(r => r.grade === '正七品');
    const salary7 = Math.round(rank7.monthlyLiang * CONVERSION.GRAM_PER_LIANG * price);

    // 示例换算
    const example = gramToLiangQian(salary10k / price);

    // 生成品级表
    const tableRows = RANK_DATA.map(rank => {
        const modernSalary = Math.round(rank.monthlyLiang * CONVERSION.GRAM_PER_LIANG * price);
        return `<tr data-grade="${rank.grade}">
            <td class="rank-grade">${rank.grade}</td>
            <td>${rank.position.split('、')[0]}</td>
            <td class="rank-salary">${rank.monthlyLiang}</td>
            <td>≈ ¥${modernSalary.toLocaleString()}</td>
        </tr>`;
    }).join('');

    const today = new Date().toISOString().split('T')[0];

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- SEO Meta Tags (实时计算) -->
    <title>几斤几两 | 月薪换算白银 - 看看你的工资在明朝值多少两银子</title>
    <meta name="description" content="输入你的现代月薪，立即换算成明朝白银重量。当前银价${price}元/克，月薪1万元约等于${liang10k}两白银，相当于明朝${rank10k.grade}${rank10k.position.split('、')[0]}。">
    <meta name="keywords" content="月薪换算白银,古代俸禄计算器,明朝官职对照,工资换算银两,几斤几两,白银价格换算,古今收入对比">
    <meta name="author" content="几斤几两">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://salary-to-silver.kanchaishaoxia.workers.dev/">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    <!-- Open Graph (实时计算) -->
    <meta property="og:type" content="website">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:site_name" content="几斤几两">
    <meta property="og:title" content="几斤几两 | 你的月薪在明朝值多少两白银？">
    <meta property="og:description" content="当前银价${price}元/克，月薪1万≈${liang10k}两白银≈明朝${rank10k.grade}${rank10k.position.split('、')[0]}">
    <meta property="og:url" content="https://salary-to-silver.kanchaishaoxia.workers.dev/">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="几斤几两 | 你的月薪在明朝值多少两白银？">
    <meta name="twitter:description" content="当前银价${price}元/克，月薪1万≈${liang10k}两白银≈明朝${rank10k.grade}">

    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        ink: { 900: '#1a1612', 800: '#2d2821', 700: '#4a443c', 600: '#6b6358', 500: '#8a8279' },
                        paper: { 100: '#f4ede4', 200: '#e8dfd3', 300: '#d9cfc0', 400: '#c4b9a8' },
                        vermilion: { DEFAULT: '#c73e3a', dark: '#a32f2c', light: '#e85450' }
                    },
                    fontFamily: {
                        brush: ['Ma Shan Zheng', 'cursive'],
                        song: ['Noto Serif SC', 'Songti SC', 'serif'],
                        display: ['ZCOOL XiaoWei', 'serif']
                    }
                }
            }
        }
    </script>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;600;700&family=ZCOOL+XiaoWei&display=swap" rel="stylesheet">

    <!-- JSON-LD (实时计算) -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebApplication",
                "name": "几斤几两 - 俸禄换算器",
                "description": "将现代月薪换算成古代白银重量，匹配明朝官职等级",
                "applicationCategory": "UtilityApplication",
                "operatingSystem": "Any",
                "url": "https://salary-to-silver.kanchaishaoxia.workers.dev/",
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CNY" }
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "月薪1万元相当于多少两白银？",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "按照当前白银价格（${price}元/克）计算，月薪1万元约等于${liang10k}两白银。根据明朝俸禄制度，这相当于${rank10k.grade}${rank10k.position.split('、')[0]}的月俸（${rank10k.monthlyLiang}两）。"
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "古代一两银子等于多少克？",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "根据明清标准，1两银子约等于37.3克。古代使用十六两制，即1斤=16两≈596.8克。"
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "明朝各品级官员月俸是多少？",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "明朝官员俸禄从正一品太师月俸87两，到从九品驿丞月俸5两不等。正七品县令月俸约7.5两，按当前银价折算约${salary7.toLocaleString()}元。"
                        }
                    }
                ]
            }
        ]
    }
    </script>

    <style>
        .paper-texture {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @keyframes stamp { 0% { opacity:0; transform:rotate(-5deg) scale(1.5); } 50% { transform:rotate(-5deg) scale(0.95); } 100% { opacity:1; transform:rotate(-5deg) scale(1); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .animate-stamp { animation: stamp 0.5s ease-out both; }
        .animate-fadeUp { animation: fadeUp 0.6s ease-out both; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        #rankTableBody tr { transition: background 0.2s; }
        #rankTableBody tr:hover { background: rgba(199,62,58,0.05); }
        #rankTableBody tr.highlight { background: rgba(199,62,58,0.12); }
        #rankTableBody tr.highlight td { font-weight: 600; }
        #rankTableBody .rank-grade { color: #c73e3a; font-family: 'ZCOOL XiaoWei', serif; }
        #rankTableBody .rank-salary { font-family: 'Ma Shan Zheng', cursive; font-size: 1.1em; }
        #rankTableBody td { padding: 0.5rem 0.75rem; }
    </style>
</head>
<body class="bg-paper-100 text-ink-800 font-song min-h-screen relative overflow-x-hidden">
    <div class="fixed inset-0 paper-texture opacity-[0.03] pointer-events-none z-0"></div>
    <div class="fixed -top-48 -right-48 w-[500px] h-[500px] bg-ink-700/5 rounded-full blur-[100px] pointer-events-none"></div>
    <div class="fixed bottom-0 -left-32 w-80 h-80 bg-vermilion/5 rounded-full blur-[80px] pointer-events-none"></div>

    <main class="relative z-10 max-w-2xl mx-auto px-4 py-10 md:py-16">
        <header class="text-center mb-12 animate-fadeUp">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-vermilion text-paper-100 font-brush text-2xl rounded shadow-md rotate-[-3deg] mb-4 animate-stamp">俸</div>
            <h1 class="font-display text-3xl md:text-4xl tracking-wider text-ink-900 mb-2">
                几斤几两<span class="text-ink-600 mx-1">｜</span><span class="text-ink-700">俸禄换算</span>
            </h1>
            <p class="text-ink-500 tracking-[0.3em] text-sm">以今度古，量你几何</p>
        </header>

        <section class="bg-paper-200/50 border border-paper-300 rounded-lg p-4 mb-8 text-sm text-ink-700 leading-relaxed animate-fadeUp">
            <p><strong>月薪1万元 ≈ ${liang10k}两白银 ≈ 明朝${rank10k.grade}${rank10k.position.split('、')[0]}。</strong>输入你的月薪，我们根据实时银价换算成古代白银重量（两/钱），并匹配明朝官职品级。</p>
        </section>

        <div class="bg-gradient-to-br from-paper-200 to-paper-100 border border-paper-300 rounded-lg p-4 flex flex-wrap items-center gap-4 mb-8 animate-fadeUp delay-100">
            <div class="flex items-center gap-2 text-sm text-ink-600">
                <span class="w-2 h-2 bg-vermilion rounded-full animate-pulse"></span>今日银价
            </div>
            <div class="flex items-baseline gap-1">
                <span id="silverPrice" class="font-display text-2xl text-ink-900">${price.toFixed(2)}</span>
                <span class="text-ink-600 text-sm">元/克</span>
            </div>
            <span id="priceNote" class="text-xs text-ink-500 ml-auto">来源: ${source}</span>
        </div>

        <section class="relative border-2 border-ink-600 p-6 md:p-8 bg-paper-100 mb-10 animate-fadeUp delay-200">
            <div class="absolute -top-0.5 -left-0.5 w-3 h-3 border-l-[3px] border-t-[3px] border-ink-900"></div>
            <div class="absolute -top-0.5 -right-0.5 w-3 h-3 border-r-[3px] border-t-[3px] border-ink-900"></div>
            <div class="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-l-[3px] border-b-[3px] border-ink-900"></div>
            <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-r-[3px] border-b-[3px] border-ink-900"></div>
            <div class="flex flex-col items-center gap-6">
                <label class="text-center" for="salaryInput">
                    <span class="font-display text-xl tracking-[0.2em] text-ink-800">请书月俸</span>
                    <span class="block text-xs text-ink-500 mt-1">（单位：人民币元）</span>
                </label>
                <div class="flex items-center gap-2 bg-paper-200 border border-paper-300 border-b-2 border-b-ink-600 px-4 py-2 focus-within:border-b-vermilion focus-within:bg-paper-100 transition-colors">
                    <span class="font-display text-2xl text-ink-600">￥</span>
                    <input type="number" id="salaryInput" class="font-brush text-4xl md:text-5xl text-ink-900 bg-transparent outline-none w-40 text-center" placeholder="10000" min="0" inputmode="numeric">
                </div>
                <button id="calculateBtn" type="button" class="group relative px-8 py-3 bg-ink-800 text-paper-100 font-song overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all">
                    <span class="absolute inset-0 bg-vermilion -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></span>
                    <span class="relative flex items-center gap-2">开卷验算
                        <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </span>
                </button>
            </div>
        </section>

        <section id="resultSection" class="hidden mb-10">
            <div class="bg-gradient-to-b from-paper-200 via-paper-100 to-paper-200 border border-paper-300 border-t-4 border-b-4 border-t-ink-800 border-b-ink-800">
                <div class="text-center py-4 border-b border-dashed border-paper-400">
                    <h2 class="font-display text-ink-700 tracking-[0.3em]">换算明细</h2>
                </div>
                <div class="p-6 space-y-6">
                    <div class="text-center pb-6 border-b border-dashed border-paper-300">
                        <div class="text-sm text-ink-500 mb-2">折合白银</div>
                        <div class="flex items-baseline justify-center gap-1 mb-1">
                            <span id="silverLiang" class="font-brush text-5xl text-ink-900">--</span>
                            <span class="font-display text-xl text-ink-700">两</span>
                            <span id="silverQian" class="font-brush text-3xl text-ink-900 ml-2">--</span>
                            <span class="font-display text-lg text-ink-700">钱</span>
                        </div>
                        <div class="text-sm text-ink-500">约 <span id="silverGram">--</span> 克</div>
                    </div>
                    <div class="flex flex-col md:flex-row items-center gap-6 p-4 bg-vermilion/5 border border-vermilion/10 rounded">
                        <div id="rankSeal" class="w-20 h-20 bg-vermilion rounded shadow-md flex items-center justify-center rotate-[-5deg]">
                            <span id="rankText" class="font-brush text-4xl text-paper-100">品</span>
                        </div>
                        <div class="text-center md:text-left flex-1">
                            <div id="rankTitle" class="text-sm text-vermilion tracking-wider mb-1">--</div>
                            <div id="rankPosition" class="font-brush text-2xl text-ink-900 mb-2">--</div>
                            <p id="rankDescription" class="text-sm text-ink-600 leading-relaxed">--</p>
                        </div>
                    </div>
                    <div class="bg-paper-200 p-3 text-xs space-y-1">
                        <div class="flex justify-between"><span class="text-ink-500">换算公式</span><span id="formula" class="text-ink-700">--</span></div>
                        <div class="flex justify-between border-t border-dotted border-paper-300 pt-1"><span class="text-ink-500">古制换算</span><span class="text-ink-700">1两 ≈ 37.3克，16两 = 1斤</span></div>
                    </div>
                </div>
            </div>
        </section>

        <section class="animate-fadeUp delay-300">
            <div class="text-center mb-6">
                <h2 class="font-display text-xl tracking-[0.2em] text-ink-800 mb-1">明朝俸禄品级表</h2>
                <p class="text-xs text-ink-500">以下数据基于明朝官制，1石米约折银1两</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-paper-200 sticky top-0">
                        <tr>
                            <th class="font-display font-normal text-ink-700 text-left px-3 py-2">品级</th>
                            <th class="font-display font-normal text-ink-700 text-left px-3 py-2">官职</th>
                            <th class="font-display font-normal text-ink-700 text-left px-3 py-2">月俸(两)</th>
                            <th class="font-display font-normal text-ink-700 text-left px-3 py-2">今折(元)</th>
                        </tr>
                    </thead>
                    <tbody id="rankTableBody" class="divide-y divide-paper-300">${tableRows}</tbody>
                </table>
            </div>
        </section>

        <section class="mt-12 space-y-4 animate-fadeUp">
            <h2 class="font-display text-lg tracking-[0.15em] text-ink-800 text-center mb-6">常见问题</h2>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">月薪1万元相当于多少两白银？</summary>
                <div class="px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>按照当前白银价格（${price}元/克）计算，<strong>月薪1万元约等于${liang10k}两白银</strong>。根据明朝俸禄制度，这相当于${rank10k.grade}${rank10k.position.split('、')[0]}的月俸（${rank10k.monthlyLiang}两），是「${rank10k.description.split('。')[0]}」。</p>
                </div>
            </details>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">古代一两银子等于多少克？</summary>
                <div class="px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>根据明清标准，<strong>1两银子约等于37.3克</strong>。古代使用十六两制，即1斤=16两≈596.8克。换算公式：白银克数 = 月薪(元) ÷ 银价(元/克)。</p>
                </div>
            </details>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">明朝各品级官员月俸是多少？</summary>
                <div class="px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>明朝官员俸禄从<strong>正一品太师月俸87两</strong>，到<strong>从九品驿丞月俸5两</strong>不等。正七品县令月俸约7.5两，按现在银价折算约${salary7.toLocaleString()}元。未入流小吏月俸约3两，平民农户约1-2两。</p>
                </div>
            </details>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">这个工具的换算公式是什么？</summary>
                <div class="px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>换算公式为：<strong>白银克数 = 月薪(元) ÷ 当前银价(元/克)</strong>，然后转换为古制单位：1两=37.3克，1两=10钱。例如月薪10000元，银价${price}元/克，得到${Math.round(salary10k/price)}克，约${example.liang}两${example.qian}钱白银。</p>
                </div>
            </details>
        </section>

        <footer class="text-center mt-16 pt-8 border-t border-paper-300">
            <p class="text-xs text-ink-500 mb-2">本站仅供娱乐参考，历史数据取自明朝官制</p>
            <p class="font-display text-sm text-ink-600 tracking-[0.2em]">古今一算，方知斤两</p>
        </footer>
    </main>

    <script>
        const CURRENT_PRICE = ${price};
        const CONVERSION = ${JSON.stringify(CONVERSION)};
        const RANK_DATA = ${JSON.stringify(RANK_DATA)};

        function matchRank(monthlyLiang) {
            for (const rank of RANK_DATA) {
                if (monthlyLiang >= rank.monthlyLiang) return rank;
            }
            return RANK_DATA[RANK_DATA.length - 1];
        }

        function gramToLiangQian(gram) {
            const totalLiang = gram / CONVERSION.GRAM_PER_LIANG;
            return { liang: Math.floor(totalLiang), qian: Math.round((totalLiang - Math.floor(totalLiang)) * CONVERSION.QIAN_PER_LIANG) };
        }

        document.getElementById('calculateBtn').addEventListener('click', calculate);
        document.getElementById('salaryInput').addEventListener('keypress', e => { if (e.key === 'Enter') calculate(); });

        function calculate() {
            const salary = parseFloat(document.getElementById('salaryInput').value);
            if (!salary || salary < 0) return;

            const gram = salary / CURRENT_PRICE;
            const { liang, qian } = gramToLiangQian(gram);
            const rank = matchRank(gram / CONVERSION.GRAM_PER_LIANG);

            document.getElementById('silverGram').textContent = gram.toFixed(2);
            document.getElementById('silverLiang').textContent = liang;
            document.getElementById('silverQian').textContent = qian;
            document.getElementById('rankText').textContent = rank.sealChar;
            document.getElementById('rankTitle').textContent = rank.grade;
            document.getElementById('rankPosition').textContent = rank.position;
            document.getElementById('rankDescription').textContent = rank.description;
            document.getElementById('formula').textContent = salary + '元 ÷ ' + CURRENT_PRICE + '元/克 = ' + gram.toFixed(2) + '克';

            document.getElementById('resultSection').classList.remove('hidden');
            document.getElementById('resultSection').classList.add('animate-fadeUp');
            document.getElementById('rankSeal').classList.add('animate-stamp');

            document.querySelectorAll('#rankTableBody tr').forEach(r => r.classList.remove('highlight'));
            const row = document.querySelector('#rankTableBody tr[data-grade="' + rank.grade + '"]');
            if (row) row.classList.add('highlight');

            setTimeout(() => document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    </script>
</body>
</html>`;
}
