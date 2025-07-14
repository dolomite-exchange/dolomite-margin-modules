import { RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetupDolomite4626Token,
} from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  getDolomiteErc20ImplementationConstructorParams,
  getDolomiteErc20PayableImplementationConstructorParams,
  getDolomiteErc4626ImplementationConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

/**
 * This script encodes the following transactions:
 * - Deploys new 4626 dToken implementation contracts
 * - Upgrades each existing 4626 dToken to the new implementation
 *
 * - Deploys new ERC20 implementation contracts
 * - Upgrades each existing ERC20 to the new implementation
 * - Gives appropriate DolomiteOwnerV2 roles to each ERC20 contract
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const erc4626Implementation = await deployContractAndSave(
    'DolomiteERC4626',
    await getDolomiteErc4626ImplementationConstructorParams(core),
    'DolomiteERC4626ImplementationV4',
  );
  const erc4626PayableImplementation = await deployContractAndSave(
    'DolomiteERC4626WithPayable',
    await getDolomiteErc4626ImplementationConstructorParams(core),
    'DolomiteERC4626WithPayableImplementationV4',
  );

  const erc20Implementation = await deployContractAndSave(
    'DolomiteERC20',
    getDolomiteErc20ImplementationConstructorParams(core),
    'DolomiteERC20ImplementationV4',
  );
  const erc20PayableImplementation = await deployContractAndSave(
    'DolomiteERC20WithPayable',
    getDolomiteErc20PayableImplementationConstructorParams(core),
    'DolomiteERC20WithPayableImplementationV4',
  );

  const transactions: EncodedTransaction[] = [];
  // Upgrade the 4626 dTokens
  for (let i = 0; i < core.dolomiteTokens.all.length; i += 1) {
    const dToken = core.dolomiteTokens.all[i];
    const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
    if ('depositFromPayable' in dToken) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, { proxy }, 'proxy', 'upgradeTo', [
          erc4626PayableImplementation,
        ]),
      );
    } else {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, { proxy }, 'proxy', 'upgradeTo', [erc4626Implementation]),
      );
    }

    transactions.push(...(await encodeSetupDolomite4626Token(core, dToken)));
  }

  // Upgrade and set up the ERC20 dTokens
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.dTokens,
      'wethProxy',
      'upgradeTo',
      [erc20PayableImplementation]
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.dTokens,
      'wbtcProxy',
      'upgradeTo',
      [erc20Implementation],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.dTokens,
      'usdcProxy',
      'upgradeTo',
      [erc20Implementation],
    ),
  );
  transactions.push(...(await encodeSetupDolomite4626Token(core, core.dTokens.weth as any)));
  transactions.push(...(await encodeSetupDolomite4626Token(core, core.dTokens.wbtc as any)));
  transactions.push(...(await encodeSetupDolomite4626Token(core, core.dTokens.usdc as any)));

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
