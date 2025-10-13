import axios from "axios";
import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from "packages/base/src/utils/no-deps-constants";
import { revertToSnapshotAndCapture, snapshot } from "packages/base/test/utils";
import { CoreProtocolArbitrumOne } from "packages/base/test/utils/core-protocols/core-protocol-arbitrum-one";
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from "packages/base/test/utils/setup";
import { start } from "repl";

const JAN_1_2025 = 1735707600;
const MAY_10_2025 = 1746849600;
const JUN_1_2025 = 1748750400;
const JUL_1_2025 = 1751342400;
const JUL_15_2025 = 1752552000;
const JUL_20_2025 = 1753056000;
const AUG_1_2025 = 1754020800;
const AUG_15_2025 = 1755230400;
const SEP_1_2025 = 1756699200;
const SEP_15_2025 = 1757908800;

describe('GM Delta Neutral APR', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 388_391_800,
    });
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it('should get the GM Delta Neutral APR', async () => {
    const gmToken = core.gmxV2Ecosystem.gmTokens.linkUsd.marketToken.address;
    const token = core.tokens.link.address;
    const marketId = core.marketIds.link;
    const query = `
    query MyQuery {
      prices(where: {token_in: ["${gmToken}", "${token}"], snapshotTimestamp_gte: ${SEP_15_2025}, isSnapshot_eq: true}, orderBy: snapshotTimestamp_ASC) {
        token
        type
        maxPrice
        minPrice
        snapshotTimestamp
        isSnapshot
      }
    }`
    const response = await axios.post("https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql", {
      query,
    });

    let prevGmPrice = ZERO_BI;
    let prevTokenPrice = ZERO_BI;
    let prevBorrowIndex = ZERO_BI;
    let cumulativeDiff = ONE_ETH_BI;

    for (let i = 0; i < response.data.data.prices.length; i++) {
      let currentTokenPrice;
      let currentGmPrice;

      if (response.data.data.prices[i].token === token) {
        currentTokenPrice = BigNumber.from(response.data.data.prices[i].minPrice).add(BigNumber.from(response.data.data.prices[i].maxPrice)).div(2);
        currentGmPrice = BigNumber.from(response.data.data.prices[i+1].minPrice).add(BigNumber.from(response.data.data.prices[i+1].maxPrice)).div(2);
      } else {
        currentGmPrice = BigNumber.from(response.data.data.prices[i].minPrice).add(BigNumber.from(response.data.data.prices[i].maxPrice)).div(2);
        currentTokenPrice = BigNumber.from(response.data.data.prices[i+1].minPrice).add(BigNumber.from(response.data.data.prices[i+1].maxPrice)).div(2);
      }

      const timestamp = response.data.data.prices[i].snapshotTimestamp;
      const etherscanQuery = await axios.get(`https://api.etherscan.io/v2/api?chainid=42161&module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=DJA9MKCA55HEQ8744VX69KCDVVZ178RMVF`)
      const currentBorrowIndex = (await core.dolomiteMargin.getMarketCurrentIndex(marketId, { blockTag: parseInt(etherscanQuery.data.result, 10) })).borrow;
      i++;

      if (prevGmPrice.eq(ZERO_BI) && prevTokenPrice.eq(ZERO_BI)) {
        prevGmPrice = currentGmPrice;
        prevTokenPrice = currentTokenPrice;
        prevBorrowIndex = currentBorrowIndex;
        console.log(`Starting time: ${timestamp} -> ${new Date(timestamp * 1000).toLocaleString()}`);
        console.log();
        continue;
      }

      const term1 = currentGmPrice.mul(2).mul(ONE_ETH_BI).div(prevGmPrice);
      const term2 = currentTokenPrice.mul(ONE_ETH_BI).mul(currentBorrowIndex).div(prevBorrowIndex).div(prevTokenPrice);
      const rateOfChange = term1.sub(term2);
      cumulativeDiff = cumulativeDiff.mul(rateOfChange).div(ONE_ETH_BI);

      console.log(`${timestamp},${new Date(timestamp * 1000).toDateString()},${formatUnits(rateOfChange, 18)},${formatUnits(cumulativeDiff, 18)}`);

      prevGmPrice = currentGmPrice;
      prevTokenPrice = currentTokenPrice;
      prevBorrowIndex = currentBorrowIndex;

      await new Promise(res => setTimeout(res, 200)); // pause to not hit etherscan rate limit
    }
  });

  it.only('should log all info in csv', async () => {
    const gmToken = core.gmxV2Ecosystem.gmTokens.linkUsd.marketToken.address;
    const token = core.tokens.link.address;
    const marketId = core.marketIds.link;
    const query = `
    query MyQuery {
      prices(where: {token_in: ["${gmToken}", "${token}"], snapshotTimestamp_gte: ${SEP_15_2025}, isSnapshot_eq: true}, orderBy: snapshotTimestamp_ASC) {
        token
        type
        maxPrice
        minPrice
        snapshotTimestamp
        isSnapshot
      }
    }`
    const response = await axios.post("https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql", {
      query,
    });

    for (let i = 0; i < response.data.data.prices.length; i = i + 2) {
      let currentTokenPrice;
      let currentGmPrice;

      if (response.data.data.prices[i].token === token) {
        currentTokenPrice = BigNumber.from(response.data.data.prices[i].minPrice).add(BigNumber.from(response.data.data.prices[i].maxPrice)).div(2);
        currentGmPrice = BigNumber.from(response.data.data.prices[i+1].minPrice).add(BigNumber.from(response.data.data.prices[i+1].maxPrice)).div(2);
      } else {
        currentGmPrice = BigNumber.from(response.data.data.prices[i].minPrice).add(BigNumber.from(response.data.data.prices[i].maxPrice)).div(2);
        currentTokenPrice = BigNumber.from(response.data.data.prices[i+1].minPrice).add(BigNumber.from(response.data.data.prices[i+1].maxPrice)).div(2);
      }

      const timestamp = response.data.data.prices[i].snapshotTimestamp;
      const etherscanQuery = await axios.get(`https://api.etherscan.io/v2/api?chainid=42161&module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=DJA9MKCA55HEQ8744VX69KCDVVZ178RMVF`)
      const currentBorrowIndex = (await core.dolomiteMargin.getMarketCurrentIndex(marketId, { blockTag: parseInt(etherscanQuery.data.result, 10) })).borrow;

      console.log(`${timestamp},${new Date(timestamp * 1000).toDateString()},${formatUnits(currentGmPrice, 30)},${formatUnits(currentTokenPrice, 12)},${formatUnits(currentBorrowIndex, 18)}`);

      await new Promise(res => setTimeout(res, 200)); // pause to not hit etherscan rate limit
    }
  });
});