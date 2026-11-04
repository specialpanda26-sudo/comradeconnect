const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Configuration
const TARGET_URL = 'https://yoursite.com/api/auth/register'; // Replace with your target registration API endpoint
const TOTAL_ATTEMPTS = 50;
const DELAY_BETWEEN_REQUESTS_MS = 3000;

let proxyPool = [];

/**
 * Step 1: Scrape free public HTTP proxies from a public API list
 */
async function fetchFreeProxies() {
    console.log('[+] Fetching fresh free public proxies...');
    try {
        const response = await axios.get(
            'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all'
        );
        const rawList = response.data.split('\r\n').filter((p) => p.trim() !== '');
        console.log(`[+] Found ${rawList.length} raw proxies.`);
        return rawList;
    } catch (error) {
        console.error('[-] Failed to fetch proxy list:', error.message);
        return [];
    }
}

/**
 * Step 2: Test if a proxy is alive before using it
 */
async function testProxy(proxyUrl) {
    try {
        const agent = new HttpsProxyAgent(`http://${proxyUrl}`);
        const res = await axios.get('https://httpbin.org/ip', {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 4000,
        });
        if (res.status === 200) {
            return true;
        }
    } catch (err) {
        return false;
    }
    return false;
}

/**
 * Step 3: Pick a working proxy from the pool
 */
async function getWorkingProxy() {
    while (proxyPool.length > 0) {
        const proxyCandidate = proxyPool.shift();
        const isWorking = await testProxy(proxyCandidate);
        if (isWorking) {
            console.log(`[✓] Proxy working: ${proxyCandidate}`);
            return proxyCandidate;
        }
    }
    return null;
}

/**
 * Step 4: Execute registration request with proxy rotation
 */
async function sendRegistrationRequest(accountIndex) {
    if (proxyPool.length < 5) {
        proxyPool = await fetchFreeProxies();
    }

    const workingProxy = await getWorkingProxy();
    if (!workingProxy) {
        console.log('[-] No working proxies available right now. Retrying pool fetch...');
        return false;
    }

    const agent = new HttpsProxyAgent(`http://${workingProxy}`);

    // Generate test user payload
    const payload = {
        username: `testuser_${Date.now()}_${accountIndex}`,
        email: `test_${Date.now()}_${accountIndex}@example.com`,
        password: 'TestPassword123!',
    };

    try {
        console.log(`[*] Sending account #${accountIndex} attempt using proxy ${workingProxy}...`);
        const response = await axios.post(TARGET_URL, payload, {
            httpsAgent: agent,
            httpAgent: agent,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/json',
            },
        });

        console.log(`[SUCCESS] Account #${accountIndex} created! Status: ${response.status}`);
        return true;
    } catch (error) {
        if (error.response) {
            console.error(`[FAILED] Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`[FAILED] Connection error via proxy: ${error.message}`);
        }
        return false;
    }
}

/**
 * Step 5: Main execution loop
 */
async function startBot() {
    console.log('==============================================');
    console.log(' Starting Bot with Free Proxy Auto-Rotation ');
    console.log('==============================================');

    proxyPool = await fetchFreeProxies();

    for (let i = 1; i <= TOTAL_ATTEMPTS; i++) {
        await sendRegistrationRequest(i);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
    }
}

startBot();
