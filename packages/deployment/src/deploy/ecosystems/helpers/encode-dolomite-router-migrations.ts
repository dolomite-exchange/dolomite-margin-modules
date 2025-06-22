import { DepositWithdrawalRouter, RouterProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { PAYABLE_TOKEN_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { DeployedVault } from 'packages/base/test/utils/ecosystem-utils/deployed-vaults';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

const INITIALIZED_NETWORKS = [
  Network.ArbitrumOne,
  Network.Berachain,
  Network.Botanix,
  Network.Ethereum,
  Network.Mantle,
  Network.PolygonZkEvm,
  Network.XLayer,
];

export async function encodeDolomiteRouterMigrations(
  core: CoreProtocolType<any>,
  depositWithdrawalRouter: DepositWithdrawalRouter,
  routers: string[],
  routerImplementations: string[],
  deployedVaults: DeployedVault[],
  transactions: EncodedTransaction[],
) {
  assertHardhatInvariant(
    routers.length > 0 && routers.length === routerImplementations.length,
    'Routers and implementations must be the same length',
  );

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  if (!(await core.depositWithdrawalProxy.g_initialized())) {
    const payableTokenAddress = PAYABLE_TOKEN_MAP[core.config.network].address;
    try {
      await core.dolomiteMargin.getMarketIdByTokenAddress(payableTokenAddress);
      await core.depositWithdrawalProxy.initializePayableMarket(payableTokenAddress);
    } catch (e) {
      console.warn('\tCould not initialize the depositWithdrawalProxy because not payable market has been added yet');
    }
  }

  for (let i = 0; i < routers.length; i += 1) {
    const proxy = RouterProxy__factory.connect(routers[i], core.hhUser1);
    if (await proxy.implementation() !== routerImplementations[i]) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { router: proxy },
          'router',
          'upgradeTo',
          [routerImplementations[i]],
        ),
      );
    }
  }

  for (const routerAddress of routers) {
    if (!await core.dolomiteMargin.getIsGlobalOperator(routerAddress)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'dolomiteMargin',
          'ownerSetGlobalOperator',
          [routerAddress, true],
        ),
      );
    }
  }

  for (const deployedVault of deployedVaults) {
    for (const routerAddress of routers) {
      if (deployedVault.isDepositWithdrawalRouterEnabled || routerAddress !== depositWithdrawalRouter.address) {
        // Some vaults don't use the deposit/withdrawal router
        if (!(await deployedVault.factory.isTokenConverterTrusted(routerAddress))) {
          transactions.push(await deployedVault.encodeSetTrustedTokenConverter(core, routerAddress, true));
        }
      }
    }
  }

  if (!(await depositWithdrawalRouter.isInitialized())) {
    if (numMarkets.gt(ZERO_BI)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { router: depositWithdrawalRouter },
          'router',
          'ownerLazyInitialize',
          [PAYABLE_TOKEN_MAP[core.config.network].address],
        ),
      );
    } else {
      console.warn('\tCould not initialize the depositWithdrawalRouter because not payable market has been added yet');
    }
  }
}
