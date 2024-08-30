import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeTokenVaultV1__factory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { GenericEventEmissionType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, BYTES_EMPTY, Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const handlerAddress = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

/**
 * This script encodes the following transactions:
 * - Deploys the new GMX V2 token vault to each GM token
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const tokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultV13',
    { ...core.libraries.tokenVaultActionsImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );

  const factories = [
    core.gmxV2Ecosystem.live.gmArbUsd.factory,
    core.gmxV2Ecosystem.live.gmBtcUsd.factory,
    core.gmxV2Ecosystem.live.gmEthUsd.factory,
    core.gmxV2Ecosystem.live.gmLinkUsd.factory,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < factories.length; i++) {
    const factory = factories[i];
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory },
        'factory',
        'ownerSetUserVaultImplementation',
        [tokenVaultAddress],
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
    skipTimeDelay: true,
    invariants: async () => {
      for (let i = 0; i < factories.length; i++) {
        const factory = factories[i];
        expect(await factory.userVaultImplementation()).to.eq(tokenVaultAddress);
      }

      const account = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';
      const vault = GmxV2IsolationModeTokenVaultV1__factory.connect(
        await core.gmxV2Ecosystem.live.gmBtcUsd.factory.getVaultByAccount(account),
        await impersonate(account),
      );

      await expectThrow(
        vault.swapExactInputForOutput(
          123123,
          [2, 17, 32],
          100,
          1,
          [
            {
              trader: ADDRESS_ZERO,
              traderType: GenericTraderType.IsolationModeWrapper,
              tradeData: BYTES_EMPTY,
              makerAccountIndex: 0,
            },
          ],
          [],
          { deadline: 12312312311, eventType: GenericEventEmissionType.None, balanceCheckFlag: BalanceCheckFlag.None },
          { value: parseEther('0.01') },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid marketIds path for wrap',
      );
      await expectThrow(
        vault.addCollateralAndSwapExactInputForOutput(
          0,
          123123,
          [2, 17, 32],
          100,
          1,
          [
            {
              trader: ADDRESS_ZERO,
              traderType: GenericTraderType.IsolationModeWrapper,
              tradeData: BYTES_EMPTY,
              makerAccountIndex: 0,
            },
          ],
          [],
          { deadline: 12312312311, eventType: GenericEventEmissionType.None, balanceCheckFlag: BalanceCheckFlag.None },
          { value: parseEther('0.01') },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid marketIds path for wrap',
      );
      await expectThrow(
        vault.swapExactInputForOutputAndRemoveCollateral(
          0,
          123123,
          [2, 17, 32],
          100,
          1,
          [
            {
              trader: ADDRESS_ZERO,
              traderType: GenericTraderType.IsolationModeWrapper,
              tradeData: BYTES_EMPTY,
              makerAccountIndex: 0,
            },
          ],
          [],
          { deadline: 12312312311, eventType: GenericEventEmissionType.None, balanceCheckFlag: BalanceCheckFlag.None },
          { value: parseEther('0.01') },
        ),
        'IsolationVaultV1AsyncFreezable: Invalid marketIds path for wrap',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
