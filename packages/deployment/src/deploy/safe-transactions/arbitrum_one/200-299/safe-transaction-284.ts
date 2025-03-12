import { DolomiteERC20__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  getDolomiteErc20ProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys dUSDC and dWETH
 * - Sets the dTokens as global operators
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const implementationAddress = await deployContractAndSave(
    'DolomiteERC20',
    [],
    'DolomiteERC20ImplementationV1',
  );
  const implementation = DolomiteERC20__factory.connect(implementationAddress, core.hhUser1);

  const dolomiteUsdcAddress = await deployContractAndSave(
    'RegistryProxy',
    await getDolomiteErc20ProxyConstructorParams(core, implementation, core.marketIds.nativeUsdc),
    'DolomiteUsdcToken',
  );
  const dolomiteUsdc = DolomiteERC20__factory.connect(dolomiteUsdcAddress, core.hhUser1);

  const dolomiteWethAddress = await deployContractAndSave(
    'RegistryProxy',
    await getDolomiteErc20ProxyConstructorParams(core, implementation, core.marketIds.weth),
    'DolomiteWethToken',
  );
  const dolomiteWeth = DolomiteERC20__factory.connect(dolomiteWethAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [dolomiteUsdcAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [dolomiteWethAddress, true],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      expect(await core.dolomiteMargin.getIsGlobalOperator(dolomiteUsdcAddress)).to.eq(true);
      expect(await core.dolomiteMargin.getIsGlobalOperator(dolomiteWethAddress)).to.eq(true);

      expect(await dolomiteUsdc.name()).to.eq('Dolomite: USDC');
      expect(await dolomiteUsdc.symbol()).to.eq('dUSDC');
      expect(await dolomiteUsdc.decimals()).to.eq(6);

      expect(await dolomiteWeth.name()).to.eq('Dolomite: WETH');
      expect(await dolomiteWeth.symbol()).to.eq('dWETH');
      expect(await dolomiteWeth.decimals()).to.eq(18);
    },
  };
}

doDryRunAndCheckDeployment(main);
