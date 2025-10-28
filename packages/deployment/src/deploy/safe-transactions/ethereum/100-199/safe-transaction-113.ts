import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20, IERC20__factory } from '../../../../../../base/src/types';
import { BTC_PLACEHOLDER_MAP } from '../../../../../../base/src/utils/constants';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { parseBtc, parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { CoreProtocolEthereum } from '../../../../../../base/test/utils/core-protocols/core-protocol-ethereum';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket } from '../../../../utils/invariant-utils';

enum InterestSetter {
  AlwaysZero,
  Modular,
}

async function encodeSimpleListing(
  core: CoreProtocolEthereum,
  token: IERC20,
  interestSetter: InterestSetter,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish = ZERO_BI,
): Promise<EncodedTransaction[]> {
  if (interestSetter === InterestSetter.Modular) {
    assertHardhatInvariant(!BigNumber.from(maxBorrowWei).eq(ZERO_BI), 'Invalid max borrow wei');
  }

  const interestSetters = core.interestSetters;
  return [
    ...(await encodeInsertChainlinkOracleV3(core, token)),
    ...(await encodeAddMarket(
      core,
      token,
      core.oracleAggregatorV2,
      interestSetter === InterestSetter.AlwaysZero
        ? interestSetters.alwaysZeroInterestSetter
        : interestSetters.modularInterestSetter,
      targetCollateralization,
      targetLiquidationPremium,
      maxSupplyWei,
      maxBorrowWei,
      interestSetter === InterestSetter.AlwaysZero,
    )),
  ];
}

/**
 * This script encodes the following transactions:
 * - Lists first batch of markets
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const tokens = core.tokens;
  const btcPlaceholder = IERC20__factory.connect(BTC_PLACEHOLDER_MAP[network].address, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertChainlinkOracleV3(core, btcPlaceholder),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.weth,
      LowerPercentage._3,
      UpperPercentage._80,
      OptimalUtilizationRate._90,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usd1,
      LowerPercentage._11,
      UpperPercentage._60,
      OptimalUtilizationRate._92,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usdc,
      LowerPercentage._11,
      UpperPercentage._60,
      OptimalUtilizationRate._92,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.link,
      LowerPercentage._8,
      UpperPercentage._125,
      OptimalUtilizationRate._50,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.wbtc,
      LowerPercentage._4,
      UpperPercentage._100,
      OptimalUtilizationRate._90,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.usdt,
      LowerPercentage._11,
      UpperPercentage._60,
      OptimalUtilizationRate._92,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.crv,
      LowerPercentage._10,
      UpperPercentage._300,
      OptimalUtilizationRate._50,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      tokens.aave,
      LowerPercentage._10,
      UpperPercentage._300,
      OptimalUtilizationRate._50,
    ),
    // Listings
    ...(await encodeSimpleListing(
      core,
      tokens.weth,
      InterestSetter.Modular,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${1_000_000}`),
      parseEther(`${900_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.usd1,
      InterestSetter.Modular,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${100_000_000}`),
      parseEther(`${90_000_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.usdc,
      InterestSetter.Modular,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${1_000_000_000}`),
      parseUsdc(`${900_000_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.link,
      InterestSetter.Modular,
      TargetCollateralization._136,
      TargetLiquidationPenalty._7,
      parseEther(`${10_000_000}`),
      parseEther(`${6_500_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.wbtc,
      InterestSetter.Modular,
      TargetCollateralization._120,
      TargetLiquidationPenalty.Base,
      parseBtc(`${10_000}`),
      parseBtc(`${8_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.usdt,
      InterestSetter.Modular,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${1_000_000_000}`),
      parseUsdc(`${900_000_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.weEth,
      InterestSetter.AlwaysZero,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther(`${500_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.crv,
      InterestSetter.Modular,
      TargetCollateralization._200,
      TargetLiquidationPenalty._10,
      parseEther(`${15_000_000}`),
      parseEther(`${7_500_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.aave,
      InterestSetter.Modular,
      TargetCollateralization._136,
      TargetLiquidationPenalty._8,
      parseEther(`${1_000_000}`),
      parseEther(`${500_000}`),
    )),
    ...(await encodeSimpleListing(
      core,
      tokens.sUsde,
      InterestSetter.AlwaysZero,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8_5,
      parseEther(`${250_000_000}`),
    )),
  ];
  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      await checkMarket(core, core.marketIds.weth, tokens.weth);
      await checkMarket(core, core.marketIds.usd1, tokens.usd1);
      await checkMarket(core, core.marketIds.usdc, tokens.usdc);
      await checkMarket(core, core.marketIds.link, tokens.link);
      await checkMarket(core, core.marketIds.wbtc, tokens.wbtc);
      await checkMarket(core, core.marketIds.usdt, tokens.usdt);
      await checkMarket(core, core.marketIds.weEth, tokens.weEth);
      await checkMarket(core, core.marketIds.crv, tokens.crv);
      await checkMarket(core, core.marketIds.aave, tokens.aave);
      await checkMarket(core, core.marketIds.sUsde, tokens.sUsde);
    },
  };
}

doDryRunAndCheckDeployment(main);
