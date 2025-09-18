import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from '../../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../../base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../../utils/encoding/base-encoder-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';
import { encodeAddMarket } from '../../../../../utils/encoding/add-market-encoder-utils';
import { parseEther } from 'ethers/lib/utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../../utils/encoding/oracle-encoder-utils';
import { IERC20 } from '../../../../../../../base/src/types';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../../base/src/utils/constructors/dolomite';
import { BigNumber, BigNumberish } from 'ethers';
import { encodeModularInterestSetterParams } from '../../../../../utils/encoding/interest-setter-encoder-utils';
import { CoreProtocolBotanix } from '../../../../../../../base/test/utils/core-protocols/core-protocol-botanix';
import { parseUsdc, parseUsdt } from '../../../../../../../base/src/utils/math-utils';

enum InterestSetter {
  AlwaysZero,
  Modular,
}

async function encodeSimpleListing(
  core: CoreProtocolBotanix,
  token: IERC20,
  interestSetter: InterestSetter,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish = ZERO_BI,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction[]> {
  if (interestSetter === InterestSetter.Modular) {
    assertHardhatInvariant(!BigNumber.from(maxBorrowWei).eq(ZERO_BI), 'Invalid max borrow wei');
  }

  const interestSetters = core.interestSetters;
  return [
    ...(await encodeInsertChainlinkOracleV3(core, token, undefined, undefined, undefined, options)),
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
 * - Adds the first markets
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const tokens = core.tokens;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetEarningsRate',
      [{ value: parseEther(`${0.8}`) }],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetCallbackGasLimit',
      [ZERO_BI],
    ),

    // Interest setters
    await encodeModularInterestSetterParams(
      core,
      tokens.weth,
      LowerPercentage._3,
      UpperPercentage._125,
      OptimalUtilizationRate._70,
    ),
    await encodeModularInterestSetterParams(
      core,
      tokens.pbtc,
      LowerPercentage._10,
      UpperPercentage._80,
      OptimalUtilizationRate._70,
    ),
    await encodeModularInterestSetterParams(
      core,
      tokens.usdc,
      LowerPercentage._12,
      UpperPercentage._80,
      OptimalUtilizationRate._90,
    ),
    await encodeModularInterestSetterParams(
      core,
      tokens.stBtc,
      LowerPercentage._10,
      UpperPercentage._70,
      OptimalUtilizationRate._70,
    ),
    await encodeModularInterestSetterParams(
      core,
      tokens.usdt,
      LowerPercentage._12,
      UpperPercentage._80,
      OptimalUtilizationRate._90,
    ),

    // Listings
    ...await encodeSimpleListing(
      core,
      tokens.weth,
      InterestSetter.Modular,
      TargetCollateralization._133,
      TargetLiquidationPenalty._10,
      parseEther(`${1_000}`),
      parseEther(`${900}`),
    ),
    ...await encodeSimpleListing(
      core,
      tokens.pbtc,
      InterestSetter.Modular,
      TargetCollateralization._133,
      TargetLiquidationPenalty._9,
      parseEther(`${1_000}`),
      parseEther(`${900}`),
    ),
    ...await encodeSimpleListing(
      core,
      tokens.usdc,
      InterestSetter.Modular,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${5_000_000}`),
      parseUsdc(`${4_500_000}`),
      { ignoreDescription: true },
    ),
    ...await encodeSimpleListing(
      core,
      tokens.stBtc,
      InterestSetter.Modular,
      TargetCollateralization._133,
      TargetLiquidationPenalty._9,
      parseEther(`${1_000}`),
      parseEther(`${500}`),
    ),
    ...await encodeSimpleListing(
      core,
      tokens.usdt,
      InterestSetter.Modular,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdt(`${5_000_000}`),
      parseUsdt(`${4_500_000}`),
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
    },
  };
}

doDryRunAndCheckDeployment(main);
