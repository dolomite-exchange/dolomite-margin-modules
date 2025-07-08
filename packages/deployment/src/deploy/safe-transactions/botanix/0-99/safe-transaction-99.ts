import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { parseEther } from 'ethers/lib/utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { BigNumber, BigNumberish } from 'ethers';
import { encodeModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { CoreProtocolBotanix } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-botanix';

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
        : interestSetters.modularLinearInterestSetter,
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
    // Interest setters
    await encodeModularInterestSetterParams(
      core,
      tokens.pUsd,
      LowerPercentage._12,
      UpperPercentage._80,
      OptimalUtilizationRate._90,
    ),
    await encodeModularInterestSetterParams(
      core,
      tokens.ypUsd,
      LowerPercentage._12,
      UpperPercentage._80,
      OptimalUtilizationRate._90,
    ),

    // Listings
    ...await encodeSimpleListing(
      core,
      tokens.pUsd,
      InterestSetter.Modular,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther(`${100_000}`),
      parseEther(`${90_000}`),
    ),
    ...await encodeSimpleListing(
      core,
      tokens.ypUsd,
      InterestSetter.AlwaysZero,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther(`${100_000}`),
    ),

    // Risk settings
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
