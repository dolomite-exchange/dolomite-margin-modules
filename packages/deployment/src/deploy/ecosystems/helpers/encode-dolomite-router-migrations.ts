import { DeployedVault } from 'packages/base/test/utils/ecosystem-utils/deployed-vaults';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import ModuleDeployments from '../../deployments.json';
import { PAYABLE_TOKEN_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { DepositWithdrawalRouter } from '@dolomite-exchange/modules-base/src/types';

const INITIALIZED_NETWORKS = [
  Network.ArbitrumOne,
  Network.Berachain,
  Network.Mantle,
  Network.PolygonZkEvm,
  Network.XLayer,
];

export async function encodeDolomiteRouterMigrations(
  core: CoreProtocolType<any>,
  depositWithdrawalRouter: DepositWithdrawalRouter,
  routers: string[],
  deployedVaults: DeployedVault[],
  transactions: EncodedTransaction[],
) {
  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  if (!INITIALIZED_NETWORKS.some(n => n === core.config.network) && !(core.depositWithdrawalProxy.g_initialized())) {
    if (numMarkets.gt(ZERO_BI)) {
      await core.depositWithdrawalProxy.initializePayableMarket(PAYABLE_TOKEN_MAP[core.config.network].address);
    } else {
      console.warn('\tCould not initialize the depositWithdrawalProxy because not payable market has been added yet');
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

  const oldRouters = [
    (ModuleDeployments.DepositWithdrawalRouterV1 as any)[core.config.network]?.address as string | undefined,
    (ModuleDeployments.BorrowPositionRouterV1 as any)[core.config.network]?.address as string | undefined,
  ].filter((v): v is string => v !== undefined);
  for (const deployedVault of deployedVaults) {
    for (const routerAddress of routers) {
      if (!(await deployedVault.factory.isTokenConverterTrusted(routerAddress))) {
        transactions.push(await deployedVault.encodeSetTrustedTokenConverter(core, routerAddress, true));
      }
    }
    for (const oldRouterAddress of oldRouters) {
      if (await deployedVault.factory.isTokenConverterTrusted(oldRouterAddress)) {
        transactions.push(await deployedVault.encodeSetTrustedTokenConverter(core, oldRouterAddress, false));
      }
    }
  }
  for (const oldRouterAddress of oldRouters) {
    if (await core.dolomiteMargin.getIsGlobalOperator(oldRouterAddress)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'dolomiteMargin',
          'ownerSetGlobalOperator',
          [oldRouterAddress, false],
        ),
      );
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
      console.warn('\tCould not initialize the depositWithdrawalProxy because not payable market has been added yet');
    }
  }
}
