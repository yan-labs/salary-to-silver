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

// ============ OG 图片生成 ============
async function generateOGImage(priceData, salary = null) {
    const price = priceData.price;

    // 计算示例数据
    const targetSalary = salary || 10000;
    const gram = targetSalary / price;
    const liangNum = gram / CONVERSION.GRAM_PER_LIANG;
    const liang = Math.floor(liangNum);
    const qian = Math.round((liangNum - liang) * 10);
    const rank = matchRank(liangNum);

    // 格式化显示
    const liangDisplay = qian > 0 ? `${liang}两${qian}钱` : `${liang}两`;
    const salaryDisplay = targetSalary >= 10000
        ? `${(targetSalary/10000).toFixed(targetSalary % 10000 === 0 ? 0 : 1)}万`
        : targetSalary.toLocaleString();

    // SVG 模板 - 简洁古风设计
    const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8f4ef"/>
      <stop offset="100%" style="stop-color:#ebe5dc"/>
    </linearGradient>
    <filter id="seal-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#1a1612" flood-opacity="0.2"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="1200" height="630" fill="url(#bg-gradient)"/>

  <!-- 装饰性竖线 -->
  <line x1="80" y1="80" x2="80" y2="550" stroke="#d4ccc0" stroke-width="1"/>
  <line x1="1120" y1="80" x2="1120" y2="550" stroke="#d4ccc0" stroke-width="1"/>

  <!-- 左侧：印章区域 -->
  <g transform="translate(160, 180)">
    <!-- 印章 -->
    <g transform="rotate(-6)" filter="url(#seal-shadow)">
      <rect x="0" y="0" width="140" height="140" rx="8" fill="#c73e3a"/>
      <text x="70" y="95" font-family="Georgia, serif" font-size="80" fill="#f4ede4" text-anchor="middle" font-weight="bold">${rank.sealChar}</text>
    </g>
    <!-- 品级标签 -->
    <text x="70" y="200" font-family="Georgia, serif" font-size="32" fill="#c73e3a" text-anchor="middle" font-weight="bold">${rank.grade}</text>
    <text x="70" y="240" font-family="Arial, sans-serif" font-size="20" fill="#6b6358" text-anchor="middle">${rank.position.split('、')[0]}</text>
  </g>

  <!-- 右侧：核心内容 -->
  <g transform="translate(380, 0)">
    <!-- 标题 -->
    <text x="340" y="120" font-family="Georgia, serif" font-size="52" fill="#1a1612" text-anchor="middle" font-weight="bold" letter-spacing="8">几斤几两</text>
    <text x="340" y="165" font-family="Arial, sans-serif" font-size="20" fill="#8a8279" text-anchor="middle" letter-spacing="4">以今度古，量你几何</text>

    <!-- 分隔线 -->
    <line x1="140" y1="200" x2="540" y2="200" stroke="#c73e3a" stroke-width="2" opacity="0.3"/>

    <!-- 换算公式 -->
    <text x="340" y="270" font-family="Arial, sans-serif" font-size="24" fill="#6b6358" text-anchor="middle">月薪 ¥${salaryDisplay} =</text>

    <!-- 核心数字 -->
    <text x="340" y="370" font-family="Georgia, serif" font-size="100" fill="#1a1612" text-anchor="middle" font-weight="bold">${liangDisplay}</text>
    <text x="340" y="420" font-family="Arial, sans-serif" font-size="24" fill="#8a8279" text-anchor="middle">白银</text>

    <!-- 银价标签 -->
    <g transform="translate(200, 470)">
      <rect x="0" y="0" width="280" height="40" rx="20" fill="#1a1612" opacity="0.05"/>
      <text x="140" y="27" font-family="Arial, sans-serif" font-size="16" fill="#6b6358" text-anchor="middle">今日银价 ¥${price.toFixed(2)}/克</text>
    </g>
  </g>

  <!-- 底部网址 - 书法卷轴式 -->
  <g transform="translate(600, 580)">
    <line x1="-160" y1="-15" x2="-75" y2="-15" stroke="#c73e3a" stroke-width="1" opacity="0.4"/>
    <line x1="75" y1="-15" x2="160" y2="-15" stroke="#c73e3a" stroke-width="1" opacity="0.4"/>
    <circle cx="-170" cy="-15" r="3" fill="#c73e3a" opacity="0.6"/>
    <circle cx="170" cy="-15" r="3" fill="#c73e3a" opacity="0.6"/>
    <text x="0" y="0" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="#1a1612" text-anchor="middle" letter-spacing="4" font-weight="500">JJJL.lol</text>
    <line x1="-70" y1="18" x2="70" y2="18" stroke="#c73e3a" stroke-width="1.5" opacity="0.3"/>
  </g>
</svg>`;

    return svg;
}

// SVG 转 PNG 备选方案：使用 Cloudflare Browser Rendering（需要付费）
// 或者使用外部服务如 https://svg2png.com/api
// 目前先使用 SVG，大多数现代平台已支持

// ============ 主处理函数 ============
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // OG 图片路由 - 动态生成 SVG
        // 支持参数: ?salary=10000 自定义月薪
        if (url.pathname === '/og-image.svg') {
            const priceData = await getSilverPrice();
            const salary = url.searchParams.get('salary') ? parseInt(url.searchParams.get('salary')) : null;
            const svg = await generateOGImage(priceData, salary);

            return new Response(svg, {
                headers: {
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'public, max-age=3600', // 1小时缓存
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

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
    <link rel="canonical" href="https://jjjl.lol/">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    <!-- Open Graph (实时计算) -->
    <meta property="og:type" content="website">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:site_name" content="几斤几两">
    <meta property="og:title" content="几斤几两 | 你的月薪在明朝值多少两白银？">
    <meta property="og:description" content="当前银价${price}元/克，月薪1万≈${liang10k}两白银≈明朝${rank10k.grade}${rank10k.position.split('、')[0]}">
    <meta property="og:url" content="https://jjjl.lol/">
    <meta property="og:image" content="https://jjjl.lol/og-image.svg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="几斤几两 - 月薪${Math.round(salary10k/1000)}k换算${liang10k}两白银，相当于明朝${rank10k.grade}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="几斤几两 | 你的月薪在明朝值多少两白银？">
    <meta name="twitter:description" content="当前银价${price}元/克，月薪1万≈${liang10k}两白银≈明朝${rank10k.grade}">
    <meta name="twitter:image" content="https://jjjl.lol/og-image.svg">
    <meta name="twitter:image:alt" content="几斤几两 - 月薪换算白银工具">

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

    <!-- JSON-LD (实时计算 + GEO优化) -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "name": "几斤几两 - 月薪换算白银",
                "description": "将现代月薪换算成古代白银重量，匹配明朝官职等级",
                "url": "https://jjjl.lol/",
                "inLanguage": "zh-CN",
                "dateModified": "${today}",
                "speakable": {
                    "@type": "SpeakableSpecification",
                    "cssSelector": ["h1", ".summary", "#rankDescription", ".faq-answer"]
                },
                "mainEntity": {
                    "@type": "SoftwareApplication",
                    "name": "几斤几两 - 俸禄换算器",
                    "applicationCategory": "UtilityApplication",
                    "operatingSystem": "Any",
                    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CNY" }
                }
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
        @keyframes modalIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes backdropIn { from { opacity:0; } to { opacity:1; } }
        .animate-modalIn { animation: modalIn 0.3s ease-out both; }
        .animate-backdropIn { animation: backdropIn 0.2s ease-out both; }
        /* 印章盖章 loading 动画 */
        @keyframes sealStamp {
            0% { transform: translateY(-30px) rotate(-8deg) scale(1.1); opacity: 0; }
            50% { transform: translateY(0) rotate(-8deg) scale(0.95); opacity: 1; }
            60% { transform: translateY(0) rotate(-8deg) scale(1); }
            100% { transform: translateY(0) rotate(-8deg) scale(1); opacity: 0.6; }
        }
        @keyframes sealGlow { 0%, 100% { box-shadow: 0 0 0 rgba(199,62,58,0); } 50% { box-shadow: 0 0 20px rgba(199,62,58,0.4); } }
        .seal-loading { position: relative; width: 70px; height: 70px; }
        .seal-stamp {
            width: 70px; height: 70px; background: #c73e3a; border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            animation: sealStamp 1.5s ease-in-out infinite, sealGlow 1.5s ease-in-out infinite;
            transform: rotate(-8deg);
        }
        .seal-stamp::after {
            content: '印'; color: #f4ede4; font-size: 36px;
            font-family: "STXingkai", "Xingkai SC", "华文行楷", "KaiTi", cursive; font-weight: bold;
        }
        @keyframes dotPulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        .loading-dots { display: flex; gap: 6px; }
        .loading-dots span {
            width: 6px; height: 6px; background: #c73e3a; border-radius: 50%;
            animation: dotPulse 1.2s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        #rankTableBody tr { transition: background 0.2s; }
        #rankTableBody tr:hover { background: rgba(199,62,58,0.05); }
        #rankTableBody tr.highlight { background: rgba(199,62,58,0.12); }
        #rankTableBody tr.highlight td { font-weight: 600; }
        #rankTableBody .rank-grade { color: #c73e3a; font-family: 'ZCOOL XiaoWei', serif; }
        #rankTableBody .rank-salary { font-family: 'Ma Shan Zheng', cursive; font-size: 1.1em; }
        #rankTableBody td { padding: 0.5rem 0.75rem; }
    </style>

    <!-- Microsoft Clarity -->
    <script type="text/javascript">
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "v9hn688xbe");
    </script>

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-P72ZZGYV58"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-P72ZZGYV58');
    </script>
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

        <section class="summary bg-paper-200/50 border border-paper-300 rounded-lg p-4 mb-8 text-sm text-ink-700 leading-relaxed animate-fadeUp">
            <p><strong>月薪1万元 ≈ ${liang10k}两白银 ≈ 明朝${rank10k.grade}${rank10k.position.split('、')[0]}。</strong>基于<a href="https://goldprice.org" class="text-vermilion hover:underline" target="_blank" rel="noopener">GoldPrice.org</a>实时银价（${price}元/克），我们将你的月薪换算成古代白银重量，并参照《明史·职官志》匹配官职品级。</p>
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
                    <button id="sharePosterBtn" type="button" class="w-full mt-4 py-3 bg-vermilion text-paper-100 font-song rounded hover:bg-vermilion-dark transition-colors flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        生成分享海报
                    </button>
                </div>
            </div>
        </section>

        <!-- 海报弹窗 -->
        <div id="posterModal" class="fixed inset-0 z-50 hidden">
            <div class="absolute inset-0 bg-ink-900/80 backdrop-blur-sm animate-backdropIn" onclick="closePosterModal()"></div>
            <div class="relative flex flex-col h-full max-h-screen p-3 sm:p-4">
                <!-- 顶部栏 -->
                <div class="flex items-center justify-between py-2 mb-2 flex-shrink-0">
                    <h3 class="font-display text-base text-paper-200 tracking-wider">分享海报</h3>
                    <button onclick="closePosterModal()" class="text-paper-300 hover:text-paper-100 transition-colors p-1">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <!-- 海报预览区 - 自适应高度 -->
                <div class="flex-1 flex items-center justify-center min-h-0 mb-3">
                    <div class="relative h-full max-h-full" style="aspect-ratio: 9/16; max-width: 100%;">
                        <canvas id="posterCanvas" class="h-full w-auto rounded-lg shadow-2xl hidden"></canvas>
                        <img id="posterImage" class="h-full w-auto rounded-lg shadow-2xl" style="max-height: 100%;" alt="分享海报">
                        <!-- 古风 Loading -->
                        <div id="posterLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-paper-200 rounded-lg">
                            <div class="seal-loading">
                                <div class="seal-stamp"></div>
                            </div>
                            <p class="mt-4 text-ink-600 font-display tracking-widest text-sm">文牒生成中</p>
                            <div class="loading-dots mt-2">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 底部操作区 - 固定 -->
                <div class="flex-shrink-0 bg-paper-100 rounded-lg p-4 animate-modalIn">
                    <p id="saveHint" class="text-sm text-vermilion text-center mb-3 font-medium"></p>
                    <div id="posterBtns" class="flex gap-3">
                        <button id="downloadPosterBtn" class="flex-1 py-3 bg-ink-800 text-paper-100 font-song rounded-lg hover:bg-ink-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            保存图片
                        </button>
                        <button id="shareBtn" class="flex-1 py-3 bg-vermilion text-paper-100 font-song rounded-lg hover:bg-vermilion-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                            <span id="shareBtnText">分享</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

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
                <div class="faq-answer px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>根据<a href="https://goldprice.org" class="text-vermilion hover:underline" target="_blank" rel="noopener">GoldPrice.org</a>实时数据，当前白银价格为<strong>${price}元/克</strong>，月薪1万元约等于<strong>${liang10k}两白银</strong>。参照《明史·职官志》记载的俸禄制度，这相当于${rank10k.grade}${rank10k.position.split('、')[0]}的月俸（${rank10k.monthlyLiang}两），是「${rank10k.description.split('。')[0]}」。</p>
                </div>
            </details>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">古代一两银子等于多少克？</summary>
                <div class="faq-answer px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>根据《清会典》和明清度量衡研究，<strong>1两银子约等于37.3克</strong>（库平两标准）。古代使用十六两制，即1斤=16两≈596.8克。换算公式：白银克数 = 月薪(元) ÷ 银价(元/克)。</p>
                </div>
            </details>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">明朝各品级官员月俸是多少？</summary>
                <div class="faq-answer px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>据《明史·食货志》记载，明朝官员俸禄从<strong>正一品太师年俸1044石（月俸87两）</strong>，到<strong>从九品驿丞年俸60石（月俸5两）</strong>不等。正七品县令月俸约7.5两，按当前银价折算约<strong>${salary7.toLocaleString()}元</strong>。未入流小吏月俸约3两，平民农户约1-2两。</p>
                </div>
            </details>
            <details class="bg-paper-200/50 border border-paper-300 rounded-lg">
                <summary class="px-4 py-3 cursor-pointer text-ink-800 font-medium hover:bg-paper-200 transition-colors">这个工具的换算公式是什么？</summary>
                <div class="faq-answer px-4 pb-4 text-sm text-ink-600 leading-relaxed">
                    <p>换算公式为：<strong>白银克数 = 月薪(元) ÷ 当前银价(元/克)</strong>，然后按明清库平两标准转换：1两=37.3克，1两=10钱。例如月薪10000元，银价${price}元/克，得到${Math.round(salary10k/price)}克，约<strong>${example.liang}两${example.qian}钱</strong>白银。</p>
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

        // ============ 海报生成功能 ============
        let currentPosterData = null;

        document.getElementById('sharePosterBtn').addEventListener('click', openPosterModal);
        document.getElementById('downloadPosterBtn').addEventListener('click', downloadPoster);
        document.getElementById('shareBtn').addEventListener('click', sharePoster);

        // 检测微信环境
        const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        function openPosterModal() {
            const salary = parseFloat(document.getElementById('salaryInput').value);
            if (!salary) return;

            const gram = salary / CURRENT_PRICE;
            const { liang, qian } = gramToLiangQian(gram);
            const rank = matchRank(gram / CONVERSION.GRAM_PER_LIANG);

            currentPosterData = { salary, gram, liang, qian, rank, price: CURRENT_PRICE };

            document.getElementById('posterModal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            document.getElementById('posterLoading').classList.remove('hidden');
            document.getElementById('posterImage').classList.add('hidden');

            // 根据环境调整 UI
            const saveHint = document.getElementById('saveHint');
            const downloadBtn = document.getElementById('downloadPosterBtn');
            const shareBtn = document.getElementById('shareBtn');
            const shareBtnText = document.getElementById('shareBtnText');

            if (isWeChat) {
                // 微信环境：隐藏下载按钮，提示长按保存
                saveHint.textContent = '👆 长按上方图片保存到相册';
                downloadBtn.classList.add('hidden');
                shareBtn.classList.remove('flex-1');
                shareBtn.classList.add('w-full');
                shareBtnText.textContent = '复制分享文案';
            } else if (isMobile) {
                // 其他移动端
                saveHint.textContent = '📱 长按图片保存，或点击按钮操作';
                shareBtnText.textContent = '分享';
            } else {
                // 桌面端
                saveHint.textContent = '';
                shareBtnText.textContent = '分享';
            }

            generatePoster(currentPosterData);
        }

        function closePosterModal() {
            document.getElementById('posterModal').classList.add('hidden');
            document.body.style.overflow = '';
            // 重置按钮状态
            const downloadBtn = document.getElementById('downloadPosterBtn');
            const shareBtn = document.getElementById('shareBtn');
            downloadBtn.classList.remove('hidden');
            shareBtn.classList.remove('w-full');
            shareBtn.classList.add('flex-1');
        }

        // 海报字体 - 仅使用系统字体
        const FONT_BRUSH = '"STXingkai", "Xingkai SC", "华文行楷", "STKaiti", "Kaiti SC", "楷体-简", "楷体", "KaiTi", cursive';
        const FONT_DISPLAY = '"STSong", "Songti SC", "华文宋体", "宋体", "SimSun", serif';
        const FONT_BODY = '"STSong", "Songti SC", "华文宋体", "宋体", "SimSun", serif';

        async function generatePoster(data) {
            const canvas = document.getElementById('posterCanvas');
            const ctx = canvas.getContext('2d');

            const dpr = window.devicePixelRatio || 2;
            const W = 540;
            const H = 960;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.scale(dpr, dpr);

            // ==================== 背景层 ====================
            // 古纸渐变
            const bgGrad = ctx.createLinearGradient(0, 0, W * 0.3, H);
            bgGrad.addColorStop(0, '#f7f0e3');
            bgGrad.addColorStop(0.5, '#f0e6d3');
            bgGrad.addColorStop(1, '#e8dcc6');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // 做旧斑点纹理
            ctx.globalAlpha = 0.04;
            for (let i = 0; i < 600; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#8B7355' : '#6B5344';
                ctx.beginPath();
                ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2 + 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // 边缘暗角
            const vignette = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.65);
            vignette.addColorStop(0, 'rgba(0,0,0,0)');
            vignette.addColorStop(1, 'rgba(80,60,40,0.12)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, W, H);

            // ==================== 边框 - 通缉令风格 ====================
            ctx.strokeStyle = '#2d2418';
            ctx.lineWidth = 6;
            ctx.strokeRect(18, 18, W - 36, H - 36);

            // ==================== 顶部标题区 ====================
            // 小标签
            ctx.fillStyle = '#8a7a66';
            ctx.font = '14px ' + FONT_BODY;
            ctx.textAlign = 'center';
            ctx.fillText('大明王朝', W/2, 65);

            // 主标题
            ctx.fillStyle = '#1a1612';
            ctx.font = 'bold 52px ' + FONT_BRUSH;
            ctx.fillText('身份文牒', W/2, 120);

            // 标题装饰线
            ctx.strokeStyle = '#c73e3a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(W/2 - 100, 138);
            ctx.lineTo(W/2 + 100, 138);
            ctx.stroke();

            // 装饰点
            ctx.fillStyle = '#c73e3a';
            ctx.beginPath();
            ctx.arc(W/2 - 110, 138, 4, 0, Math.PI * 2);
            ctx.arc(W/2 + 110, 138, 4, 0, Math.PI * 2);
            ctx.fill();

            // ==================== 印章区（视觉焦点）====================
            ctx.save();
            ctx.translate(W/2, 255);
            ctx.rotate(-8 * Math.PI / 180);

            // 印章阴影
            ctx.shadowColor = 'rgba(120, 40, 40, 0.4)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 6;
            ctx.shadowOffsetY = 6;

            // 印章主体
            const sealSize = 130;
            ctx.fillStyle = '#c73e3a';
            roundRect(ctx, -sealSize/2, -sealSize/2, sealSize, sealSize, 6);
            ctx.fill();

            // 印章内边框
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = '#f4ede4';
            ctx.lineWidth = 3;
            roundRect(ctx, -sealSize/2 + 8, -sealSize/2 + 8, sealSize - 16, sealSize - 16, 4);
            ctx.stroke();

            // 印章文字
            ctx.fillStyle = '#f4ede4';
            ctx.font = 'bold 88px ' + FONT_BRUSH;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(data.rank.sealChar, 0, -5);

            ctx.restore();

            // ==================== 品级信息（核心区）====================
            // 品级大字
            ctx.fillStyle = '#1a1612';
            ctx.font = 'bold 58px ' + FONT_BRUSH;
            ctx.textAlign = 'center';
            ctx.fillText(data.rank.grade, W/2, 400);

            // 官职
            ctx.fillStyle = '#c73e3a';
            ctx.font = '28px ' + FONT_DISPLAY;
            ctx.fillText(data.rank.position.split('、')[0], W/2, 445);

            // 描述文字（自动换行）
            ctx.fillStyle = '#5a5046';
            ctx.font = '16px ' + FONT_BODY;
            const descText = '「' + data.rank.description.split('。')[0] + '」';
            wrapText(ctx, descText, W/2, 490, 380, 26);

            // ==================== 俸禄信息框 ====================
            const boxX = 60;
            const boxY = 545;
            const boxW = W - 120;
            const boxH = 120;

            // 框背景
            ctx.fillStyle = 'rgba(199, 62, 58, 0.06)';
            roundRect(ctx, boxX, boxY, boxW, boxH, 8);
            ctx.fill();

            // 框边线
            ctx.strokeStyle = '#c73e3a';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4;
            roundRect(ctx, boxX, boxY, boxW, boxH, 8);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // 月俸标签
            ctx.fillStyle = '#8a7a66';
            ctx.font = '14px ' + FONT_BODY;
            ctx.fillText('月俸白银', W/2, boxY + 30);

            // 银两数字（核心数据，要大）
            const liangText = data.qian > 0 ? data.liang + ' 两 ' + data.qian + ' 钱' : data.liang + ' 两';
            ctx.fillStyle = '#1a1612';
            ctx.font = 'bold 44px ' + FONT_BRUSH;
            ctx.fillText(liangText, W/2, boxY + 78);

            // 今薪换算
            const salaryText = data.salary >= 10000
                ? '≈ 今 ¥' + (data.salary / 10000).toFixed(data.salary % 10000 === 0 ? 0 : 1) + '万'
                : '≈ 今 ¥' + data.salary.toLocaleString();
            ctx.fillStyle = '#6b6358';
            ctx.font = '15px ' + FONT_BODY;
            ctx.fillText(salaryText + '  ·  银价 ¥' + data.price.toFixed(2) + '/克', W/2, boxY + 105);

            // ==================== 趣味评语 ====================
            const funText = getFunText(data.rank.grade, data.liang);

            // 评语背景装饰
            ctx.fillStyle = '#c73e3a';
            ctx.globalAlpha = 0.1;
            roundRect(ctx, W/2 - 130, 680, 260, 36, 18);
            ctx.fill();
            ctx.globalAlpha = 1;

            ctx.fillStyle = '#c73e3a';
            ctx.font = 'bold 22px ' + FONT_BRUSH;
            ctx.fillText(funText, W/2, 705);

            // ==================== 底部二维码区 ====================
            // 分隔线
            ctx.strokeStyle = '#d0c4b4';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(80, 740);
            ctx.lineTo(W - 80, 740);
            ctx.stroke();

            // 二维码 - 背景匹配海报
            const qrSize = 90;
            const qrX = W/2 - qrSize/2;
            const qrY = 765;

            // 背景色匹配海报该位置的颜色（偏下位置更深）
            await drawQRCode(ctx, 'https://jjjl.lol', qrX, qrY, qrSize, '2d2418', 'e8dcc6');

            // 底部提示
            ctx.fillStyle = '#8a7a66';
            ctx.font = '13px ' + FONT_BODY;
            ctx.fillText('扫码测你几斤几两', W/2, 900);

            // ==================== 转换为图片 ====================
            const posterImage = document.getElementById('posterImage');
            posterImage.src = canvas.toDataURL('image/png');
            posterImage.onload = () => {
                document.getElementById('posterLoading').classList.add('hidden');
                posterImage.classList.remove('hidden');
            };
        }

        // 文字自动换行
        function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
            const chars = text.split('');
            let line = '';
            let currentY = y;
            for (let i = 0; i < chars.length; i++) {
                const testLine = line + chars[i];
                if (ctx.measureText(testLine).width > maxWidth && i > 0) {
                    ctx.fillText(line, x, currentY);
                    line = chars[i];
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, currentY);
        }

        // 趣味文案
        function getFunText(grade, liang) {
            if (grade.includes('一品') || grade.includes('二品')) return '✦ 位极人臣 · 羡煞旁人 ✦';
            if (grade.includes('三品') || grade.includes('四品')) return '✦ 封疆大吏 · 前途无量 ✦';
            if (grade.includes('五品') || grade.includes('六品')) return '✦ 朝廷命官 · 光宗耀祖 ✦';
            if (grade.includes('七品') || grade.includes('八品')) return '✦ 芝麻小官 · 也是官身 ✦';
            if (grade.includes('九品') || grade === '未入流') return '✦ 虽是末吏 · 胜于白丁 ✦';
            if (liang >= 1.5) return '✦ 家有薄产 · 小康人家 ✦';
            if (liang >= 0.5) return '✦ 勤劳耕作 · 自食其力 ✦';
            return '✦ 穿越需谨慎 · 搬砖保平安 ✦';
        }

        // 绘制圆角矩形
        function roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        // 简易二维码生成（使用第三方API）
        async function drawQRCode(ctx, url, x, y, size, color = '000000', bgcolor = 'ffffff') {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    ctx.drawImage(img, x, y, size, size);
                    resolve();
                };
                img.onerror = () => {
                    // 如果 API 失败，绘制占位符
                    ctx.fillStyle = '#e8dfd3';
                    ctx.fillRect(x, y, size, size);
                    ctx.fillStyle = '#6b6358';
                    ctx.font = '12px "Noto Serif SC", serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('JJJL.lol', x + size / 2, y + size / 2 + 4);
                    resolve();
                };
                const colorHex = color.replace('#', '');
                const bgHex = bgcolor.replace('#', '');
                img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + (size*2) + 'x' + (size*2) + '&data=' + encodeURIComponent(url) + '&margin=0&color=' + colorHex + '&bgcolor=' + bgHex;
            });
        }

        function downloadPoster() {
            const canvas = document.getElementById('posterCanvas');
            const link = document.createElement('a');
            link.download = '几斤几两-' + currentPosterData.salary + '元.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        async function sharePoster() {
            const canvas = document.getElementById('posterCanvas');
            const shareBtn = document.getElementById('shareBtn');
            const shareBtnText = document.getElementById('shareBtnText');
            const originalText = shareBtnText.textContent;

            const shareText = '我在明朝是【' + currentPosterData.rank.grade + ' · ' + currentPosterData.rank.position.split('、')[0] + '】！月俸' + currentPosterData.liang + '两白银。来测测你是几斤几两？ jjjl.lol';

            // 微信环境或不支持 Web Share，直接复制文案
            if (isWeChat) {
                try {
                    await navigator.clipboard.writeText(shareText);
                    showCopied();
                } catch (err) {
                    fallbackCopy(shareText);
                }
                return;
            }

            // 尝试 Web Share API（支持分享图片）
            if (navigator.share && navigator.canShare) {
                try {
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    const file = new File([blob], '几斤几两.png', { type: 'image/png' });

                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: '我在明朝是' + currentPosterData.rank.grade,
                            text: shareText,
                            files: [file]
                        });
                        return;
                    }
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }

            // 尝试分享链接
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: '几斤几两 - 月薪换算白银',
                        text: shareText,
                        url: 'https://jjjl.lol'
                    });
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }

            // 兜底：复制文案
            try {
                await navigator.clipboard.writeText(shareText);
                showCopied();
            } catch (err) {
                fallbackCopy(shareText);
            }

            function showCopied() {
                shareBtnText.textContent = '已复制 ✓';
                shareBtn.classList.add('bg-green-600');
                shareBtn.classList.remove('bg-vermilion', 'hover:bg-vermilion-dark');
                setTimeout(() => {
                    shareBtnText.textContent = originalText;
                    shareBtn.classList.remove('bg-green-600');
                    shareBtn.classList.add('bg-vermilion', 'hover:bg-vermilion-dark');
                }, 2000);
            }

            function fallbackCopy(text) {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showCopied();
                } catch (e) {
                    alert('复制失败，请手动复制：' + text);
                }
                document.body.removeChild(textarea);
            }
        }

        // ESC 键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('posterModal').classList.contains('hidden')) {
                closePosterModal();
            }
        });
    </script>
</body>
</html>`;
}
