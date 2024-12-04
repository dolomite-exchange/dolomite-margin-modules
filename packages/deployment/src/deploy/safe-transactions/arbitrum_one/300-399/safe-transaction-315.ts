import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';
import {
  DolomiteERC20__factory,
  DolomiteERC20WithPayable__factory,
  RegistryProxy__factory
} from '@dolomite-exchange/modules-base/src/types';
import { getRegistryProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

const OLD_WETH = '0xb67534C6eB4D38391D4d61eFB1EcAee167010E4C';

/**
 * This script encodes the following transactions:
 * - Disables the old dWETH as a global operator
 * - Deploys a new implementation for dTokens
 * - Deploys dWETH (payable compatible)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dolomiteERC20ImplementationV2Address = await deployContractAndSave(
    'DolomiteERC20',
    [],
    'DolomiteERC20ImplementationV2',
  );
  const dolomiteERC20WithPayableImplementationV2Address = await deployContractAndSave(
    'DolomiteERC20WithPayable',
    [core.tokens.weth.address],
    'DolomiteERC20WithPayableImplementationV2',
  );
  const dolomiteERC20WithPayableImplementationV2 = DolomiteERC20WithPayable__factory.connect(
    dolomiteERC20WithPayableImplementationV2Address,
    core.hhUser1
  );

  const dUsdcProxy = RegistryProxy__factory.connect(ModuleDeployments.DolomiteUsdcToken[network].address, core.hhUser1);
  const dUsdc = DolomiteERC20__factory.connect(ModuleDeployments.DolomiteUsdcToken[network].address, core.hhUser1);

  const wbtcInitData = await dolomiteERC20WithPayableImplementationV2.populateTransaction.initialize(
    'Dolomite: WBTC',
    'dWBTC',
    8,
    core.marketIds.wbtc,
  );
  const dolomiteWbtcAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      dolomiteERC20ImplementationV2Address,
      wbtcInitData.data!,
      core.dolomiteMargin
    ),
    'DolomiteWbtcToken',
  );
  const dolomiteWbtc = DolomiteERC20__factory.connect(dolomiteWbtcAddress, core.hhUser1);

  const wethInitData = await dolomiteERC20WithPayableImplementationV2.populateTransaction.initialize(
    'Dolomite: WETH',
    'dWETH',
    18,
    core.marketIds.weth,
  );
  const dolomiteWethAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      dolomiteERC20WithPayableImplementationV2Address,
      wethInitData.data!,
      core.dolomiteMargin
    ),
    'DolomiteWethToken',
  );
  const dolomiteWeth = DolomiteERC20__factory.connect(dolomiteWethAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [OLD_WETH, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [dolomiteWbtcAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [dolomiteWethAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dUsdcProxy },
      'dUsdcProxy',
      'upgradeTo',
      [dolomiteERC20ImplementationV2Address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dUsdc },
      'dUsdc',
      'initializeVersion2',
      [],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteWbtc },
      'dolomiteWbtc',
      'initializeVersion2',
      [],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteWeth },
      'dolomiteWeth',
      'initializeVersion2',
      [],
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
      const dolomiteMargin = core.dolomiteMargin;
      assertHardhatInvariant(
        !(await dolomiteMargin.getIsGlobalOperator(OLD_WETH)),
        'OLD_WETH must be unset as a global operator',
      );
      assertHardhatInvariant(
        await dolomiteMargin.getIsGlobalOperator(dolomiteWbtcAddress),
        'wbtc must be set as a global operator',
      );
      assertHardhatInvariant(
        await dolomiteMargin.getIsGlobalOperator(dolomiteWethAddress),
        'weth must be set as a global operator',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
