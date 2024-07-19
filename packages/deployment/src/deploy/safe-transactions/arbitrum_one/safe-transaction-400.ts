import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20Metadata__factory } from 'packages/base/src/types';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';

const genericTraderProxyV1OldAddress = '0x905F3adD52F01A9069218c8D1c11E240afF61D2B';
const liquidatorProxyV4OldAddress = '0x34975624E992bF5c094EF0CF3344660f7AaB9CB3';

/**
 * This script encodes the following transactions:
 * - Sets the Generic Trader Proxy as a global operator of Dolomite Margin
 * - Sets the Liquidator Proxy V4 as a global operator of Dolomite Margin
 * - Sets the Generic Trader Proxy on the Dolomite Registry
 * - For each isolation mode asset, resets the Liquidator Asset Registry to use the new Liquidator Proxy V4
 */

async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [genericTraderProxyV1OldAddress, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [liquidatorProxyV4OldAddress, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [core.genericTraderProxy!.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [core.liquidatorProxyV4!.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetGenericTraderProxy',
      [core.genericTraderProxy!.address],
    ),
  );

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  for (let i = 0; numMarkets.gt(i); i++) {
    const tokenName = await IERC20Metadata__factory.connect(
      await core.dolomiteMargin.getMarketTokenAddress(i),
      core.governance
    ).name();

    if (tokenName.startsWith('Dolomite Isolation:') || tokenName.startsWith('Dolomite:')) {
      transactions.push(
        ...await getIsolationModeTokenVaultTransactions(
          core,
          i
        )
      );
    }
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        core.genericTraderProxy.address !== genericTraderProxyV1OldAddress,
        'Generic Trader Proxy not updated'
      );
      assertHardhatInvariant(
        core.liquidatorProxyV4.address !== liquidatorProxyV4OldAddress,
        'Liquidator Proxy not updated'
      );
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(genericTraderProxyV1OldAddress)),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(core.genericTraderProxy.address),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(liquidatorProxyV4OldAddress)),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(core.liquidatorProxyV4.address),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteRegistry.genericTraderProxy() === core.genericTraderProxy.address,
        'Invalid generic trader proxy'
      );

      const numMarkets = await core.dolomiteMargin.getNumMarkets();
      for (let i = 0; numMarkets.gt(i); i++) {
        const tokenName = await IERC20Metadata__factory.connect(
          await core.dolomiteMargin.getMarketTokenAddress(i),
          core.governance
        ).name();

        if (tokenName.startsWith('Dolomite Isolation:') || tokenName.startsWith('Dolomite:')) {
          assertHardhatInvariant(
            !(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(i, liquidatorProxyV4OldAddress)),
            'Invalid liquidator proxy'
          );
          assertHardhatInvariant(
            await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(i, core.liquidatorProxyV4.address),
            'Invalid liquidator proxy'
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);

async function getIsolationModeTokenVaultTransactions(
  core: CoreProtocolArbitrumOne,
  marketId: BigNumberish,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4!.address],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerRemoveLiquidatorFromAssetWhitelist',
      [marketId, liquidatorProxyV4OldAddress],
    ),
  );
  return transactions;
}
