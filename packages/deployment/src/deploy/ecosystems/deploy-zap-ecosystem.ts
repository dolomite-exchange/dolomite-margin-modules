import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolType, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { isIsolationMode } from 'packages/base/test/utils/dolomite';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const OLD_ADDRESSES: Record<'GenericTraderProxyV1' | 'LiquidatorProxyV4WithGenericTrader', Record<string, string>> = {
  GenericTraderProxyV1: {
    196: '0xE355Df372C4FAaeDf895B958De5D7FB89215aeEa',
    1101: '0x660bd80f67Aa9C7bFB82933e1068F8F616D88255',
    5000: '0x8A13C00facd1971FBb7CED5EbF88f9e900419D5C',
    8453: '0x4C08681c6D8E9857fE6FBD0ba39C427199Ea32d0',
    42161: '0xe50c3118349f09abafc1bb01ad5cb946b1de83f6',
    80084: '0xbE6c38709FAb83c8e0FE4319a5Ee1440cf128f52',
  },
  LiquidatorProxyV4WithGenericTrader: {
    196: '0x277118ca98f7A8C26Afeb12928D0A37eDb382D7e',
    1101: '0x66D4D46B140149DfA603DE01Aac4b33723495001',
    5000: '0x17b8bcF4B7Cc3782d4c67407dE6144A904a77F2C',
    8453: '0x22dd9f4393a3cc698D6C09AD14B0b9D515084FC7',
    42161: '0x34975624E992bF5c094EF0CF3344660f7AaB9CB3',
    80084: '0x21EbaF74f534d9aC9270DFA5ff9612123D677689',
  },
};

async function isGlobalOperator<T extends NetworkType>(core: CoreProtocolType<T>, operator: string): Promise<boolean> {
  return core.dolomiteMargin.getIsGlobalOperator(operator);
}

async function isAssetWhitelistedForLiquidation<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  liquidator: string,
): Promise<boolean> {
  return core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(marketId, liquidator);
}

/**
 * This script encodes the following transactions:
 * - Sets the GenericTraderProxy as a global operator of Dolomite Margin
 * - Sets the LiquidatorProxyV4 as a global operator of Dolomite Margin
 * - Unsets the old GenericTraderProxy as a global operator of Dolomite Margin
 * - Unsets the old LiquidatorProxyV4 as a global operator of Dolomite Margin
 * - For each isolation mode asset, adds the LiquidatorProxyV4 to the LiquidatorAssetRegistry
 * - For each isolation mode asset, removes the old LiquidatorProxyV4 from the LiquidatorAssetRegistry
 */
async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  const oldGenericTraderAddress = OLD_ADDRESSES.GenericTraderProxyV1[network];
  const oldLiquidatorAddress = OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader[network];

  if (await isGlobalOperator(core, OLD_ADDRESSES.GenericTraderProxyV1[network])) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [oldGenericTraderAddress, false],
      ),
    );
  }
  if (!(await isGlobalOperator(core, core.genericTraderProxy.address))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [core.genericTraderProxy.address, true],
      ),
    );
  }

  if (await isGlobalOperator(core, oldLiquidatorAddress)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [oldLiquidatorAddress, false],
      ),
    );
  }
  if (!(await isGlobalOperator(core, core.liquidatorProxyV4.address))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [core.liquidatorProxyV4.address, true],
      ),
    );
  }

  if ((await core.dolomiteRegistry.genericTraderProxy()) !== core.genericTraderProxy.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry: core.dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetGenericTraderProxy',
        [core.genericTraderProxy.address],
      ),
    );
  }

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; numMarkets.gt(i); i++) {
    if (await isIsolationMode(i, core)) {
      if (!(await isAssetWhitelistedForLiquidation(core, i, core.liquidatorProxyV4.address))) {
        transactions.push(
          await prettyPrintEncodedDataWithTypeSafety(
            core,
            { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
            'liquidatorAssetRegistry',
            'ownerAddLiquidatorToAssetWhitelist',
            [i, core.liquidatorProxyV4.address],
          ),
        );
      }

      if (await isAssetWhitelistedForLiquidation(core, i, oldLiquidatorAddress)) {
        transactions.push(
          await prettyPrintEncodedDataWithTypeSafety(
            core,
            { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
            'liquidatorAssetRegistry',
            'ownerRemoveLiquidatorFromAssetWhitelist',
            [i, oldLiquidatorAddress],
          ),
        );
      }
    }
  }

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
        name: 'Migrate Zap Ecosystem',
      },
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await isGlobalOperator(core, oldGenericTraderAddress)),
        'Old GenericTraderProxyV1 must not be operator',
      );
      assertHardhatInvariant(
        await isGlobalOperator(core, core.genericTraderProxy.address),
        'GenericTraderProxyV1 must be operator',
      );

      assertHardhatInvariant(
        !(await isGlobalOperator(core, oldLiquidatorAddress)),
        'Old LiquidatorProxyV4WithGenericTrader must not be operator',
      );
      assertHardhatInvariant(
        await isGlobalOperator(core, core.liquidatorProxyV4.address),
        'LiquidatorProxyV4WithGenericTrader must be operator',
      );

      assertHardhatInvariant(
        (await core.dolomiteRegistry.genericTraderProxy()) === core.genericTraderProxy.address,
        'GenericTraderProxyV1 must be set on dolomiteRegistry',
      );
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
