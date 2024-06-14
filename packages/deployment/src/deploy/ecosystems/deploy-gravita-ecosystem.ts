import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';
import {
  getExternalOARBConstructorParams,
  getExternalVesterImplementationConstructorParams,
  getExternalVesterInitializationCalldata
} from '@dolomite-exchange/modules-liquidity-mining/src/liquidity-mining-constructors';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expect } from 'chai';
import {
  ExternalOARB__factory,
  ExternalVesterImplementationV1__factory,
  VesterDiscountCalculatorV1__factory
} from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { getUpgradeableProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  CoreProtocolArbitrumOne
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';

const ownerAddress = '0xfB0214D7Ac08ed0D2D9cA920EA6D4f4be2654EA5';
const baseUri = 'ipfs://QmXKCDcuSPrxadMa6shPPVLDtBcwrhAqA73xdemhP4rqqv';
const name = 'Gravita goARB Vesting';
const symbol = 'vgoARB';

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork() as T;
  const core = await setupCoreProtocol<T>({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  if (!(core instanceof CoreProtocolArbitrumOne)) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  const oArbAddress = await deployContractAndSave(
    'ExternalOARB',
    getExternalOARBConstructorParams(ownerAddress, 'Gravita: oARB Token', 'goARB'),
    'GravitaOArbToken',
  );
  const oToken = ExternalOARB__factory.connect(oArbAddress, core.hhUser1);

  const discountCalculatorAddress = await deployContractAndSave(
    'VesterDiscountCalculatorV1',
    [],
    'GravitaVesterDiscountCalculatorV1',
  );
  const discountCalculator = VesterDiscountCalculatorV1__factory.connect(discountCalculatorAddress, core.hhUser1);

  const vesterImplementationAddress = await deployContractAndSave(
    'ExternalVesterImplementationV1',
    getExternalVesterImplementationConstructorParams(core, core.tokens.grai, core.tokens.grai, core.tokens.arb),
    'GravitaExternalVesterImplementationV1',
  );
  const vesterImplementation = ExternalVesterImplementationV1__factory.connect(
    vesterImplementationAddress,
    core.hhUser1
  );
  const vesterImplementationCalldata = await vesterImplementation.populateTransaction.initialize(
    getExternalVesterInitializationCalldata(discountCalculator, oToken, ownerAddress, baseUri, name, symbol),
  );

  const vesterProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(
      vesterImplementationAddress,
      vesterImplementationCalldata,
      core.dolomiteMargin
    ),
    'GravitaExternalVesterProxy',
  );
  const vesterProxy = ExternalVesterImplementationV1__factory.connect(vesterProxyAddress, core.hhUser1);

  return {
    core,
    invariants: async () => {
      const owner = await impersonate(ownerAddress);
      expect(await oToken.owner()).to.eq(owner.address);

      expect(await vesterProxy.discountCalculator()).to.eq(discountCalculator.address);
      expect(await vesterProxy.oToken()).to.eq(oToken.address);
      expect(await vesterProxy.owner()).to.eq(owner.address);
      expect(await vesterProxy.name()).to.eq(name);
      expect(await vesterProxy.symbol()).to.eq(symbol);
      expect(await vesterProxy.symbol()).to.eq(symbol);
    },
    scriptName: getScriptName(__filename),
    upload: {
      chainId: core.network,
      transactions: [],
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
