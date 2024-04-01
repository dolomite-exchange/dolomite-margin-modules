import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV3ConstructorParams
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const rEthJun2025WrapperAddress = '0x78BBFe4e48E20B1e6016afB7e9Bc8a1D1A51266A';
const rEthJun2025UnwrapperAddress = '0xc16A0611DA04181AaaA2C750479aC0d8F17F6898';
const wsEthJun2024UnwrapperAddress = '0x5BFEE4e3853d499e4B149C4F18c91F59A45C422E';
const wsEthJun2024WrapperAddress = '0x0196D6e6c2879fac66307d877b033463A23A1740';
const wsEthJun2025UnwrapperAddress = '0x4673B24a8C3c7A6EaaAF32D520bf88A52a21d81a';
const wsEthJun2025WrapperAddress = '0xc8475C99bcCC93Bafb7A211CF339c8C07A628527';
const weEthApr2024UnwrapperAddress = '0x422c8E352461e35d80106519636A657C35986203';
const weEthApr2024WrapperAddress = '0x80aE22E33Fc6066ACA9F9da6621Feeb0C86Ad426';

/**
 * This script encodes the following transactions:
 * - Deploys PendleV3Router unwrapper and wrapper for the following markets:
 *      rEthJun2025
 *      wstEthJun2024
 *      wstEthJun2025
 *      eEthApr2024
 * - Disables the old wrapper and unwrappers for those markets
 * - Enables the new wrapper and unwrappers for those markets
 * - Update pendle router
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  const factories = [
    {
      name: 'dPtREthJun2025',
      market: core.pendleEcosystem.rEthJun2025,
      factory: core.pendleEcosystem.rEthJun2025.dPtREthJun2025,
      underlyingToken: core.tokens.rEth,
      wrapper: '0x78BBFe4e48E20B1e6016afB7e9Bc8a1D1A51266A',
      unwrapper: '0xc16A0611DA04181AaaA2C750479aC0d8F17F6898',
      newWrapper: '',
      newUnwrapper: '',
    },
    {
      name: 'dPtWstEthJun2024',
      market: core.pendleEcosystem.wstEthJun2024,
      factory: core.pendleEcosystem.wstEthJun2024.dPtWstEthJun2024,
      underlyingToken: core.tokens.wstEth,
      wrapper: '0x0196D6e6c2879fac66307d877b033463A23A1740',
      unwrapper: '0x5BFEE4e3853d499e4B149C4F18c91F59A45C422E',
      newWrapper: '',
      newUnwrapper: '',
    },
    {
      name: 'dPtWstEthJun2025',
      market: core.pendleEcosystem.wstEthJun2025,
      factory: core.pendleEcosystem.wstEthJun2025.dPtWstEthJun2025,
      underlyingToken: core.tokens.wstEth,
      wrapper: '0xc8475C99bcCC93Bafb7A211CF339c8C07A628527',
      unwrapper: '0x4673B24a8C3c7A6EaaAF32D520bf88A52a21d81a',
      newWrapper: '',
      newUnwrapper: '',
    },
    {
      name: 'dPtWeEthApr2024',
      market: core.pendleEcosystem.weEthApr2024,
      factory: core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024,
      underlyingToken: core.tokens.weEth,
      wrapper: '0x80aE22E33Fc6066ACA9F9da6621Feeb0C86Ad426',
      unwrapper: '0x422c8E352461e35d80106519636A657C35986203',
      newWrapper: '',
      newUnwrapper: '',
    },
  ];

  for (let i = 0; i < factories.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        factories[i].market,
        factories[i].name as any,
        'ownerSetIsTokenConverterTrusted',
        [factories[i].wrapper, false],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        factories[i].market,
        factories[i].name as any,
        'ownerSetIsTokenConverterTrusted',
        [factories[i].unwrapper, false],
      ),
    );
    factories[i].newUnwrapper = await deployContractAndSave(
      'PendlePtIsolationModeUnwrapperTraderV3',
      getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams(
        core,
        factories[i].market.pendleRegistry,
        factories[i].underlyingToken,
        factories[i].factory
      )
    );

    factories[i].newWrapper = await deployContractAndSave(
      'PendlePtIsolationModeWrapperTraderV3',
      getPendlePtIsolationModeWrapperTraderV3ConstructorParams(
        core,
        factories[i].market.pendleRegistry,
        factories[i].underlyingToken,
        factories[i].factory
      )
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        factories[i].market,
        factories[i].name as any,
        'ownerSetIsTokenConverterTrusted',
        [factories[i].newWrapper, true],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        factories[i].market,
        factories[i].name as any,
        'ownerSetIsTokenConverterTrusted',
        [factories[i].newUnwrapper, true],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      for (let i = 0; i < factories.length; i++) {
        assertHardhatInvariant(
          await factories[i].factory.isTokenConverterTrusted(factories[i].newWrapper),
          'New wrapper is not trusted'
        );
        assertHardhatInvariant(
          await factories[i].factory.isTokenConverterTrusted(factories[i].newUnwrapper),
          'New unwrapper is not trusted'
        );
        assertHardhatInvariant(
          !(await factories[i].factory.isTokenConverterTrusted(factories[i].wrapper)),
          'Old wrapper is trusted'
        );
        assertHardhatInvariant(
          !(await factories[i].factory.isTokenConverterTrusted(factories[i].unwrapper)),
          'Old unwrapper is trusted'
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
