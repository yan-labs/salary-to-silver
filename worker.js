/**
 * 几斤几两 - Cloudflare Worker
 * 实时银价 API
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // API 路由：获取实时银价
        if (url.pathname === '/api/silver-price') {
            return handleSilverPrice(env);
        }

        // 其他请求交给 Assets 处理（静态文件）
        return env.ASSETS.fetch(request);
    }
};

// 使用 KV 或内存缓存（1小时）
const CACHE_KEY = 'silver-price';
const CACHE_DURATION = 60 * 60; // 1小时（秒）

async function handleSilverPrice(env) {
    // 尝试从 Cache API 获取
    const cache = caches.default;
    const cacheKey = new Request('https://cache/silver-price');

    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        const data = await cachedResponse.json();
        return jsonResponse({ ...data, cached: true });
    }

    try {
        // 从 goldprice.org 获取实时银价
        const response = await fetch('https://data-asg.goldprice.org/dbXRates/CNY', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SilverPriceBot/1.0)',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data && data.items && data.items[0]) {
            const item = data.items[0];
            // xagPrice 是 CNY/盎司，转换为 CNY/克（1盎司 = 31.1035克）
            const pricePerGram = (item.xagPrice / 31.1035).toFixed(2);

            const result = {
                price: parseFloat(pricePerGram),
                currency: 'CNY',
                unit: 'gram',
                source: 'GoldPrice.org',
                timestamp: new Date().toISOString(),
                raw: {
                    xagPrice: item.xagPrice,
                    change: item.chgXag,
                    changePercent: item.pcXag
                }
            };

            // 缓存结果
            const responseToCache = new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
            await cache.put(cacheKey, responseToCache.clone());

            return jsonResponse({ ...result, cached: false });
        }

        throw new Error('Invalid data format');

    } catch (error) {
        console.error('获取银价失败:', error);

        // 返回默认值（使用最新的参考价格）
        return jsonResponse({
            price: 22.5,
            currency: 'CNY',
            unit: 'gram',
            source: '参考价格',
            timestamp: new Date().toISOString(),
            cached: false,
            error: '获取实时价格失败，使用参考价'
        });
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
