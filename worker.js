/**
 * 几斤几两 - Cloudflare Worker
 * 处理实时银价 API
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // API 路由：获取实时银价
        if (url.pathname === '/api/silver-price') {
            return handleSilverPrice(ctx);
        }

        // 其他请求交给 Assets 处理（静态文件）
        return env.ASSETS.fetch(request);
    }
};

// 缓存银价（1小时）
let cachedPrice = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时

async function handleSilverPrice(ctx) {
    const now = Date.now();

    // 检查缓存
    if (cachedPrice && (now - cacheTime) < CACHE_DURATION) {
        return jsonResponse({
            price: cachedPrice.price,
            currency: 'CNY',
            unit: 'gram',
            source: cachedPrice.source,
            timestamp: cachedPrice.timestamp,
            cached: true
        });
    }

    try {
        // 方案1: 从金投网获取银价（人民币/克）
        const price = await fetchSilverPriceFromJT();

        if (price) {
            cachedPrice = {
                price: price,
                source: '金投网',
                timestamp: new Date().toISOString()
            };
            cacheTime = now;

            return jsonResponse({
                price: price,
                currency: 'CNY',
                unit: 'gram',
                source: '金投网',
                timestamp: cachedPrice.timestamp,
                cached: false
            });
        }

        // 方案2: 备用 - 从其他源获取
        const backupPrice = await fetchSilverPriceBackup();

        if (backupPrice) {
            cachedPrice = {
                price: backupPrice.price,
                source: backupPrice.source,
                timestamp: new Date().toISOString()
            };
            cacheTime = now;

            return jsonResponse({
                price: backupPrice.price,
                currency: 'CNY',
                unit: 'gram',
                source: backupPrice.source,
                timestamp: cachedPrice.timestamp,
                cached: false
            });
        }

        throw new Error('无法获取银价');

    } catch (error) {
        console.error('获取银价失败:', error);

        // 返回默认值
        return jsonResponse({
            price: 6.5,
            currency: 'CNY',
            unit: 'gram',
            source: '默认参考价',
            timestamp: new Date().toISOString(),
            cached: false,
            error: '获取实时价格失败，使用参考价'
        });
    }
}

// 从金投网获取银价
async function fetchSilverPriceFromJT() {
    try {
        // 金投网白银 TD 价格接口
        const response = await fetch('https://api.jintou.com/api/silver/price?key=silver_td', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SilverBot/1.0)',
                'Referer': 'https://www.cngold.org/'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // 解析返回的数据
        if (data && data.data && data.data.price) {
            // 金投网返回的是元/千克，需要转换为元/克
            return (parseFloat(data.data.price) / 1000).toFixed(2);
        }

        return null;
    } catch (e) {
        console.log('金投网 API 失败:', e.message);
        return null;
    }
}

// 备用方案：从新浪财经获取
async function fetchSilverPriceBackup() {
    try {
        // 新浪财经贵金属数据
        const response = await fetch('https://hq.sinajs.cn/list=hf_AG', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SilverBot/1.0)',
                'Referer': 'https://finance.sina.com.cn/'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        // 格式: var hf_AG="...,价格,...";
        const match = text.match(/hf_AG="([^"]+)"/);

        if (match && match[1]) {
            const parts = match[1].split(',');
            // 新浪返回的是美元/盎司，需要转换
            const usdPerOz = parseFloat(parts[0]);
            if (!isNaN(usdPerOz)) {
                // 1盎司 = 31.1035克，假设汇率约7.2
                const cnyPerGram = (usdPerOz * 7.2 / 31.1035).toFixed(2);
                return {
                    price: parseFloat(cnyPerGram),
                    source: '新浪财经'
                };
            }
        }

        return null;
    } catch (e) {
        console.log('新浪 API 失败:', e.message);
        return null;
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
