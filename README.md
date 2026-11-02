# Auto Sell Bot

This was made as a quick thing, this currently doesn't support mass accs or proxies as it was just made to my current situation.
None of your info is sent through any self owned telemetry of mine and only goes through roblox.com and rolimons.com.
All items "values" are considered from their rolimons value and rap, taking whichever one is higher.

## Install
> git clone https://github.com/shp/auto-sell

## Run
This was made using Node and NPM so it is recommended to use that to run and package manage.
```bash
npm start
```
```bash
node index.js
```

## Config

### Personal Info (.env)

```env
ROBLOSECURITY=COOKIES
```

Replace the "COOKIES" with your .ROBLOSECURITY, which you can find in inspect element under the Application tab.
Also make sure there are no spaces between the value and the equals or trailing spaces or anything extra yk.

### Settings (config.json)

```json
{
    "MIN_VALUE": 1000,
    "MIN_PERCENTAGE": 1,
    "MAX_PERCENTAGE": 2,
    "MINIMUM_OWNERS": 200,
    "BLOCK_SELLING_RARES": false,
    "MAX_ROBLOX_REQUESTS_PER_MINUTE": 30,
    "SCAN_INTERVAL_IN_SECONDS": 60,
    "RATELIMIT_DELAY_IN_SECONDS": 5
}
```

#### MIN_VALUE
- type: integer
- The minimum amount of value for it to consider selling + lowest it can sell

#### MIN_PERCENTAGE
- type: float
- The minimum amount when multiplied by the value of the item for it to be able to sell for.
- i.e. a 10,000 value item with a 0.8 MIN_PERCENTAGE can only be listed as low as 8,000.

#### MAX_PERCENTAGE
- type: float
- The maximum amount when multiplied by the value of the item for it to be able to sell for. 
- i.e. a 10,000 value item with a 2 MAX_PERCENTAGE with all sellers selling below MIN_PERCENTAGE would sell for 20,000.

#### MINIMUM_OWNERS
- type: integer
- The minimum owners of the limited for it to be sold, anything under wont be sold.
- This is fetched from routility (i couldn't figure out how to on rolimons without some sort of web scraping)

#### BLOCK_SELLING_RARES
- type: boolean
- If an item is marked as rare it won't be sold.
- This is fetched from routility and rolimons.

#### MAX_ROBLOX_REQUESTS_PER_MINUTE
- type: integer
- Ratelimits roblox to a certain amount of requests per minute
- Roblox has a default cap of 50 and I do NOT take into account http fails (so always keep under 50, reccomended to 30 or below)

#### RATELIMIT_DELAY_IN_SECONDS
- type: float
- The amount of time to wait before seeing if the ratelimit is gone

#### SCAN_INTERVAL_IN_SECONDS
- type: float
- Determines the minimum amount of time between scans

