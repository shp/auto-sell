require("dotenv").config();

const fs = require("fs");

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const DEFAULT_CONFIG = {
	"MIN_VALUE": 1000,
	"MIN_PERCENTAGE": 1,
	"MAX_PERCENTAGE": 2,
	"MINIMUM_OWNERS": 200,
	"BLOCK_SELLING_RARES": true,
	"MAX_ROBLOX_REQUESTS_PER_MINUTE": 30,
	"RATELIMIT_DELAY_IN_SECONDS": 5,
	"SCAN_INTERVAL_IN_SECONDS": 60
}

async function main() {
	let config = fs.readFileSync("config.json")
	if (!config) {
		fs.writeFileSync("config.json", JSON.stringify(DEFAULT_CONFIG));
		config = DEFAULT_CONFIG;
	}
	config = JSON.parse(config);
	let isConfigMissingSomething;
	for (const [key, val] of Object.entries(DEFAULT_CONFIG)) {
		if (config[key] == null) {
			config[key] = val;
			isConfigMissingSomething = true;
		}
	}
	if (isConfigMissingSomething) {
		fs.writeFileSync("config.json", JSON.stringify(config));
	}
	const { MIN_VALUE, MIN_PERCENTAGE, MAX_PERCENTAGE, MINIMUM_OWNERS, BLOCK_SELLING_RARES, MAX_ROBLOX_REQUESTS_PER_MINUTE, SCAN_INTERVAL_IN_SECONDS, RATELIMIT_DELAY_IN_SECONDS } = config;

	const ROBLOSECURITY = process.env.ROBLOSECURITY
	const ROLIMON_NAME_INDEX = 0;
	const ROLIMON_ABBREVIATION_INDEX = 1;
	const ROLIMON_VALUE_INDEX = 4;
	const ROLIMON_RARE_INDEX = 9;

	let robloxRequests = 0;
	let userId;
	let userName;
	let rolimonsChart;
	let routilityChart;
	let idMappings = {};
	let collMappings = {};

	async function addRobloxReq() {
		async function addr() {
			if (robloxRequests >= MAX_ROBLOX_REQUESTS_PER_MINUTE) return false;
			robloxRequests++;
			setTimeout(() => { robloxRequests-- }, 60000);
			return true;
		}
		while (!(await addr())) {  // over set ratelimit
			await sleep(RATELIMIT_DELAY_IN_SECONDS * 1000);
		}
	}

	async function getCollectibleId(id) {
		if (idMappings[id]) return idMappings[id];
		await addRobloxReq();
		const res = await fetch(`https://catalog.roblox.com/v1/catalog/items/${id}/details?itemType=Asset`);
		if (!res.ok) return;
		const data = await res.json()
		const collId = data.collectibleItemId;
		idMappings[id] = collId;
		collMappings[collId] = id;
		return collId;
	}

	async function getCollectibles() {
		let collectibles = {}
		let cursor = '';
		do {
			await addRobloxReq();
			const res = await fetch(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100&cursor=${cursor}`);
			if (!res.ok) break;
			const data = await res.json();
			for (const coll of data.data) {
				if (coll.isOnHold) continue;
				const id = String(coll.assetId);
				const roliData = rolimonsChart[id];
				if (!roliData) continue;
				const val = Math.max(coll.recentAveragePrice, roliData[ROLIMON_VALUE_INDEX]);
				if (val < MIN_VALUE) continue;
				const routilData = routilityChart[id];
				if (!routilData) continue;
				if (routilData.copies < MINIMUM_OWNERS) continue;
				if (BLOCK_SELLING_RARES && (routilData.rare || roliData[ROLIMON_RARE_INDEX] == 1)) continue;
				collectibles[await getCollectibleId(id)] = val;
			}
			cursor = data.nextPageCursor
		} while (cursor)
		return collectibles;
	}

	async function getCSRFToken() {
		await addRobloxReq();
		const res = await fetch("https://auth.roblox.com/v1/authentication-ticket", {
			method: "POST",
			headers: {
				Cookie: `.ROBLOSECURITY=${ROBLOSECURITY}`
			}
		});

		return res.headers.get("x-csrf-token");
	}

	async function getResellAmount(collectibleId, value) {
		await addRobloxReq();
		const res = await fetch(`https://apis.roblox.com/marketplace-sales/v1/item/${collectibleId}/resellers?limit=100`);
		if (!res.ok) return;
		const data = await res.json();
		let lowestAmount = MAX_PERCENTAGE * value;
		const minPrice = Math.max(MIN_VALUE, MIN_PERCENTAGE * value)
		for (const resellInfo of data.data) {
			const price = resellInfo.price;
			if (resellInfo.seller.sellerId == userId || price < minPrice) continue;
			lowestAmount = price - 1;
			break;
		}
		return lowestAmount;
	}

	function timestamp() {
		return new Date().toLocaleTimeString();
	}

	async function listCollectible(collectibleId, instanceId, productId, price) {
		await addRobloxReq();
		const token = await getCSRFToken();
		await fetch(`https://apis.roblox.com/marketplace-sales/v1/item/${collectibleId}/instance/${instanceId}/resale`, {
			method: "PATCH",
			headers: {
				Cookie: `.ROBLOSECURITY=${ROBLOSECURITY}`,
				"X-CSRF-TOKEN": token,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(
				{
					collectibleProductId: productId,
					isOnSale: true,
					sellerId: userId,
					sellerType: "User",
					price: price
				}
			)
		});
		const limitedId = collMappings[collectibleId];
		const limitedInfo = rolimonsChart[limitedId];
		const limitedName = limitedInfo[ROLIMON_NAME_INDEX];
		let limitedAbbreviation = limitedInfo[ROLIMON_ABBREVIATION_INDEX];
		if (limitedAbbreviation != '') limitedAbbreviation = " (" + limitedAbbreviation + ")";
		console.log(`[${timestamp()} : LIST] Listed ${limitedName}${limitedAbbreviation} (${limitedId}) at ${price} robux.`);
	}

	async function resellItem(collectibleId, value) {
		const resellAmount = await getResellAmount(collectibleId, value);
		if (!resellAmount) return;
		await addRobloxReq();
		const res = await fetch(`https://apis.roblox.com/marketplace-sales/v1/item/${collectibleId}/resellable-instances?ownerType=User&ownerId=${userId}&limit=500`, {
			headers: {
				Cookie: `.ROBLOSECURITY=${ROBLOSECURITY}`
			}
		});
		if (!res.ok) return;
		const data = await res.json();
		for (const instance of data.itemInstances) {
			if (instance.price == resellAmount || instance.isHeld) continue;
			const instanceId = instance.collectibleInstanceId;
			const productId = instance.collectibleProductId;
			await listCollectible(collectibleId, instanceId, productId, resellAmount)
		}
	}

	async function getInfo() {
		await addRobloxReq();
		const res = await fetch("https://users.roblox.com/v1/users/authenticated", {
			headers: { Cookie: `.ROBLOSECURITY=${ROBLOSECURITY}` }
		});
		if (!res.ok) throw new Error("Couldn't authenticate cookies to get user info.");
		const data = await res.json();
		return data;
	}

	async function loadRolimonsChart() {
		const res = await fetch("https://www.rolimons.com/itemapi/itemdetails");
		if (!res.ok) throw new Error("Couldn't load the rolimons item database.");
		const data = await res.json();
		return data.items;
	}

	async function loadRoutilityChart() {
		const res = await fetch("https://routility.io/api/public/items");
		if (!res.ok) throw new Error("Couldn't load the routility item database.");
		const data = await res.json();
		let chart = {};
		for (const item of data.items) {
			chart[item.id] = item;
		}
		return chart;
	}
	do {
		try {
			const userInfo = await getInfo();
			userId = userInfo.id;
			userName = userInfo.name;

		} catch (err) {
			console.error(`[${timestamp()} : ERROR] ${err}`);
		}
	} while (!userId && await sleep(3000))
	console.log(`[${timestamp()} : INIT] Initialized sell bot as @${userName} (${userId})`);

	async function run() {
		try {
			rolimonsChart = await loadRolimonsChart();
			routilityChart = await loadRoutilityChart();
			const collectibles = await getCollectibles();
			for (const [collectibleId, value] of Object.entries(collectibles)) {
				await resellItem(collectibleId, value);
			}
		} catch (err) {
			console.error(`[${timestamp()} : ERROR] ${err}`);
		}
	}
	await run();
	setInterval(async () => {
		await run();
	}, SCAN_INTERVAL_IN_SECONDS * 1000);
}

main();
