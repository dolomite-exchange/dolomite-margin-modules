import { IERC20__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  CoreProtocolType,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { getChainlinkPriceOracleConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracle__factory,
  IChainlinkAggregator__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork() as T;
  const core = await setupCoreProtocol(getDefaultCoreProtocolConfig(network)) as CoreProtocolType<T>;

  const tokens = [
    core.tokens.weth,
    core.tokens.dai,
    core.tokens.usdc,
    core.tokens.link,
  ];
  const aggregators = tokens.map(t => IChainlinkAggregator__factory.connect(
    core.constants.chainlinkAggregators[t.address],
    t.signer,
  ));
  const tokenPairs = tokens.map(() => IERC20__factory.connect(ADDRESS_ZERO, core.hhUser1));
  const chainlinkPriceOracleAddress = await deployContractAndSave(
    'ChainlinkPriceOracle',
    await getChainlinkPriceOracleConstructorParams<T>(tokens, aggregators, tokenPairs, core),
  );
  const chainlinkPriceOracle = ChainlinkPriceOracle__factory.connect(chainlinkPriceOracleAddress, core.hhUser1);

  // TODO: adjust these prices to reflect the time of deployment
  const ethPrice = (await chainlinkPriceOracle.getPrice(core.tokens.weth.address)).value;
  assertHardhatInvariant(
    ethPrice.gt(parseEther('2400')) && ethPrice.lt(parseEther('2500')),
    'Invalid ETH price',
  );

  const daiPrice = (await chainlinkPriceOracle.getPrice(core.tokens.dai.address)).value;
  assertHardhatInvariant(
    daiPrice.gt(parseEther('0.99')) && daiPrice.lt(parseEther('1.01')),
    'Invalid DAI price',
  );

  const usdcPrice = (await chainlinkPriceOracle.getPrice(core.tokens.usdc.address)).value;
  const scaleDiff = '1000000000000';
  assertHardhatInvariant(
    usdcPrice.div(scaleDiff).gt(parseEther('0.99')) && usdcPrice.div(scaleDiff).lt(parseEther('1.01')),
    'Invalid USDC price',
  );

  const linkPrice = (await chainlinkPriceOracle.getPrice(core.tokens.link.address)).value;
  assertHardhatInvariant(
    linkPrice.gt(parseEther('18')) && linkPrice.lt(parseEther('20')),
    'Invalid LINK price',
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      chainId: network,
      transactions: [],
    },
  };
}

doDryRunAndCheckDeployment(main);
