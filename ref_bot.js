require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Configuration from Environment Variables with sensible fallbacks
const TARGET_URL = process.env.TARGET_URL || 'https://comradeconnectback.onrender.com/api/auth/register';
const REFERRAL_CODE = process.env.REFERRAL_CODE || 'ogollatech';
const TOTAL_ATTEMPTS = parseInt(process.env.TOTAL_ATTEMPTS || '5', 10);
const DELAY_BETWEEN_REQUESTS_MS = parseInt(process.env.DELAY_BETWEEN_REQUESTS_MS || '3000', 10);

let proxyPool = [];

/**
 * Step 1: Fetch free working proxies (or use a dedicated proxy if configured)
 */
async function fetchFreeProxies() {
    if (process.env.PROXY_URL) {
        console.log('[*] Using custom proxy from environment variable.');
        return [process.env.PROXY_URL];
    }

    console.log('[*] Fetching free public proxies...');
    try {
        const response = await axios.get('https://raw.githubusercontent.com/theonlyicebear/free-proxy-list/main/proxies/http.json', { timeout: 8000 });
        if (Array.isArray(response.data) && response.data.length > 0) {
            console.log(`[+] Loaded ${response.data.length} proxies into pool.`);
            return response.data.map(p => `${p.ip}:${p.port}`);
        }
    } catch (error) {
        console.warn(`[!] Failed to fetch proxy list: ${error.message}. Running direct connection fallback.`);
    }
    return [];
}

/**
 * Step 2: Get a working proxy from the pool, rotating if necessary
 */
function getNextProxy() {
    if (proxyPool.length === 0) return null;
    const proxy = proxyPool.shift();
    proxyPool.push(proxy);
    return proxy;
}

/**
 * Step 3: Send single registration request with a proxy and unique payload
 */
async function sendRegistrationRequest(accountIndex) {
    const workingProxy = getNextProxy();
    let agent = null;

    if (workingProxy) {
        agent = new HttpsProxyAgent(`http://${workingProxy}`);
    }

    // Generate fully unique credentials to avoid 400 "already used" errors
    const uniqueTimestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 90000) + 10000;
    
    const payload = {
        username: `testuser_${uniqueTimestamp}_${randomSuffix}`,
        email: `test_${uniqueTimestamp}_${randomSuffix}@example.com`,
        phone: `+2547${Math.floor(10000000 + Math.random() * 90000000)}`, // Unique phone number format
        password: 'TestPassword123!',
        ref: REFERRAL_CODE // Passes your target referral code/sponsor tag
    };

    try {
        console.log(`[*] Sending account #${accountIndex} (${payload.username}) using proxy ${workingProxy || 'Direct Connection'}...`);
        const response = await axios.post(TARGET_URL, payload, {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                'Content-Type': 'application/json',
            },
        });

        console.log(`[SUCCESS] Account #${accountIndex} created! Status: ${response.status}`);
        return true;
    } catch (error) {
        if (error.response) {
            console.error(`[FAILED] #${accountIndex} Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`[FAILED] #${accountIndex} Connection error: ${error.message}`);
        }
        return false;
    }
}

/**
 * Step 4: Main execution loop
 */
async function startBot() {
    console.log('==============================================');
    console.log(' Starting RefBot with Unique Data & Rotation ');
    console.log('==============================================');
    console.log(`Target API: ${TARGET_URL}`);
    console.log(`Referral Code: ${REFERRAL_CODE}`);

    proxyPool = await fetchFreeProxies();

    for (let i = 1; i <= TOTAL_ATTEMPTS; i++) {
        await sendRegistrationRequest(i);
        // Delay interval to prevent socket exhaustion and rate limiting
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
    }
    console.log('==============================================');
    console.log(' All registration attempts completed. ');
    console.log('==============================================');
}

startBot();
