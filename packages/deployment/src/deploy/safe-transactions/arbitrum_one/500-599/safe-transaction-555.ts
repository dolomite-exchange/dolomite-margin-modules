import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { RegistryProxy__factory } from 'packages/base/src/types/factories/contracts/general/RegistryProxy__factory';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetupDolomite4626Token } from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new 4626 dToken implementation contracts
 * - Upgrades each existing 4626 dToken to the new implementation
 * - Gives appropriate DolomiteOwnerV2 roles to each 4626 contract
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const erc4626Implementation = await deployContractAndSave(
    'DolomiteERC4626',
    [core.dolomiteRegistryProxy.address, core.dolomiteMargin.address],
    'DolomiteERC4626ImplementationV2',
    {},
    { signer: core.hhUser1 },
  );
  const erc4626PayableImplementation = await deployContractAndSave(
    'DolomiteERC4626WithPayable',
    [core.dolomiteRegistryProxy.address, core.dolomiteMargin.address],
    'DolomiteERC4626WithPayableImplementationV2',
    {},
    { signer: core.hhUser1 },
  );

  const transactions: EncodedTransaction[] = [];

  /**
   * DTokens on Arbitrum One:
   *  bridged usdc
   *  dai
   *  usdc
   *  usdt
   *  wbtc
   *  weth
   */
  // TODO: move this to dolomite ecosystem
  for (const [key, dToken] of Object.entries(core.dolomiteTokens)) {
    // Upgrade the implementation
    const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
    // TODO: make dynamic based on payable for network
    if (key === 'weth') {
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

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      for (const [key, dToken] of Object.entries(core.dolomiteTokens)) {
        // Check all implementations were upgraded
        const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
        if (key === 'weth') {
          assertHardhatInvariant(
            (await proxy.implementation()) === erc4626PayableImplementation,
            `dToken ${key} is not upgraded to the new implementation`,
          );
        } else {
          assertHardhatInvariant(
            (await proxy.implementation()) === erc4626Implementation,
            `dToken ${key} is not upgraded to the new implementation`,
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
