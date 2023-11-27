import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPIsolationModeVaultFactory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeUnwrapperTraderV2,
  GMXIsolationModeVaultFactory,
  GMXIsolationModeWrapperTraderV2,
  GmxRegistryV1,
  IERC20,
} from '../../../src/types';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createGLPIsolationModeTokenVaultV1,
  createGLPIsolationModeTokenVaultV2,
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGMXUnwrapperTraderV2,
  createGMXWrapperTraderV2,
  createGmxRegistry,
} from '../../utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';
import { AccountInfoStruct } from 'src/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('GMXIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let gmxMarketId: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let unwrapper: GMXIsolationModeUnwrapperTraderV2;
  let wrapper: GMXIsolationModeWrapperTraderV2;
  let factory: GMXIsolationModeVaultFactory;
  let glpFactory: GLPIsolationModeVaultFactory;
  let vault: GMXIsolationModeTokenVaultV1;
  let defaultAccount: AccountInfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.gmxEcosystem!.gmx;

    const gmxVaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxRegistry = await createGmxRegistry(core);
    factory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, gmxVaultImplementation);
    const glpVaultImplementation = await createGLPIsolationModeTokenVaultV2();
    glpFactory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, glpVaultImplementation);

    // Setup GMX market
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '1000000000000000000');
    await setupTestMarket(core, factory, true);

    gmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(core.gmxEcosystem!.gmx.address, '1000000000000000000');
    await setupTestMarket(core, core.gmxEcosystem!.gmx, false);

    unwrapper = await createGMXUnwrapperTraderV2(core, factory, gmxRegistry);
    wrapper = await createGMXWrapperTraderV2(core, factory, gmxRegistry);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(factory.address);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
      vaultAddress,
      GMXIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe.only('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      await setupGMXBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await core.gmxEcosystem!.gmx.connect(core.hhUser1).transfer(core.dolomiteMargin.address, amountWei);
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        underlyingMarketId,
        gmxMarketId,
        ZERO_BI,
        amountWei,
        BYTES_EMPTY,
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);

      // const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      // expect(underlyingBalanceWei.value).to.eq(amountWei.add(TEN));
      // expect(await vault.underlyingBalanceOf()).to.eq(amountWei.add(TEN));

      // const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, otherMarketId);
      // expect(otherBalanceWei.sign).to.eq(false);
      // expect(otherBalanceWei.value).to.eq(otherAmountWei);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.gmxEcosystem!.gmx.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.dfsGlp!.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.gmxEcosystem!.gmx.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.gmxEcosystem!.gmx.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work with gmx token', async () => {
      expect(await wrapper.isValidInputToken(core.gmxEcosystem!.gmx.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.usdc.address)).to.eq(false);
    });
  });

  describe('#GMX_REGISTRY', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await wrapper.getExchangeCost(core.gmxEcosystem!.gmx.address, factory.address, amountWei, BYTES_EMPTY))
        .to
        .eq(amountWei);
    });
  });
});
