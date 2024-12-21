import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { parseEther } from 'ethers/lib/utils';
import {
  getMNTIsolationModeVaultFactoryConstructorParams,
  getMNTRegistryConstructorParams,
  getMNTUnwrapperTraderV2ConstructorParams,
  getMNTWrapperTraderV2ConstructorParams,
} from 'packages/mantle/src/mnt-constructors';
import {
  MNTIsolationModeTokenVaultV1__factory,
  MNTIsolationModeVaultFactory__factory,
  MNTRegistry__factory,
} from 'packages/mantle/src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2__factory,
} from 'packages/base/src/types';

/**
 * This script encodes the following transactions:
 * - Update the interest rate model for all stables to use optimal rate of 14%
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const mntRegistryImplementationAddress = await deployContractAndSave(
    'MNTRegistry',
    [],
    'MNTRegistryImplementationV1',
  );
  const mntRegistryImplementation = MNTRegistry__factory.connect(mntRegistryImplementationAddress, core.hhUser1);

  const mntRegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getMNTRegistryConstructorParams(mntRegistryImplementation, core),
    'MNTRegistryProxy',
  );
  const mntRegistryProxy = MNTRegistry__factory.connect(mntRegistryProxyAddress, core.hhUser1);

  const vaultImplementationAddress = await deployContractAndSave(
    'MNTIsolationModeTokenVaultV1',
    [],
    'MNTIsolationModeTokenVaultV1',
    { ...core.libraries.tokenVaultActionsImpl },
  );
  const vaultImplementation = MNTIsolationModeTokenVaultV1__factory.connect(vaultImplementationAddress, core.hhUser1);

  const factoryAddress = await deployContractAndSave(
    'MNTIsolationModeVaultFactory',
    getMNTIsolationModeVaultFactoryConstructorParams(mntRegistryProxy, vaultImplementation, core.tokens.wmnt, core),
  );
  const factory = MNTIsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

  const unwrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeUnwrapperTraderV2',
    getMNTUnwrapperTraderV2ConstructorParams(factory, core),
    'MNTIsolationModeUnwrapperTraderV2',
  );
  const unwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.hhUser1);

  const wrapperAddress = await deployContractAndSave(
    'SimpleIsolationModeWrapperTraderV2',
    getMNTWrapperTraderV2ConstructorParams(factory, core),
    'MNTIsolationModeWrapperTraderV2',
  );
  const wrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.hhUser1);

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const oracleInfos = await core.oracleAggregatorV2.getOraclesByToken(core.tokens.wmnt.address);
  assertHardhatInvariant(oracleInfos.length === 1, 'Invalid WMNT oracle infos');

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: factoryAddress,
          decimals: 18,
          oracleInfos: [{
            oracle: oracleInfos[0].oracle,
            tokenPair: oracleInfos[0].tokenPair,
            weight: oracleInfos[0].weight,
          }],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chroniclePriceOracleV3: core.chroniclePriceOracleV3 },
      'chroniclePriceOracleV3',
      'ownerInsertOrUpdateOracleToken',
      [
        factoryAddress,
        await core.chroniclePriceOracleV3.getScribeByToken(core.tokens.wmnt.address),
        false,
      ],
    ),
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      marketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${15_000_000}`),
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxSupplyWei',
      [
        core.marketIds.wmnt,
        parseEther(`${10_000_000}`),
      ],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      assertHardhatInvariant(
        marketId.eq(await core.dolomiteMargin.getMarketIdByTokenAddress(factoryAddress)),
        'Invalid market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPrice(marketId)).value.eq(
          (await core.dolomiteMargin.getMarketPrice(core.marketIds.wmnt)).value
        ),
        'Invalid sMNT price ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxSupplyWei(marketId)).value.eq(parseEther(`${15_000_000}`)),
        'Invalid supply cap for sMNT',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxSupplyWei(core.marketIds.wmnt)).value.eq(parseEther(`${10_000_000}`)),
        'Invalid supply cap for MNT',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
