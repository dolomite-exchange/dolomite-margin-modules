import {
  AccountStatus,
  ActionType,
  AmountDenomination,
  AmountReference,
  BalanceCheckFlag,
} from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BaseContract, BigNumber, ethers } from 'ethers';
import {
  CustomTestToken, GLPPriceOracleV1, GLPPriceOracleV1__factory,
  GLPUnwrapperProxyV1,
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory, IERC20,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultV1,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { BORROW_POSITION_PROXY_V2, DOLOMITE_MARGIN, WETH_MARKET_ID } from '../../../src/utils/constants';
import { createContractWithAbi, createTestToken, depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectTotalSupply,
  expectWalletBalance,
} from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupGmxRegistry,
  setupTestMarket, setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createGlpUnwrapperProxy, createTestWrappedTokenFactory } from '../../utils/wrapped-token-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000
const borrowOtherAmountWei = BigNumber.from('170000000'); // $170

describe('WrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let unwrapper: GLPUnwrapperProxyV1;
  let wrapper: GLPWrapper;
  let factory: GLPWrappedTokenUserVaultFactory;
  let vault: GLPWrappedTokenUserVaultV1;
  let priceOracle: GLPPriceOracleV1;
  let defaultAccount: Account.InfoStruct;

  let solidUser: SignerWithAddress;
  let otherToken: IERC20;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = core.gmxEcosystem.fsGlp;
    const userVaultImplementation = await createContractWithAbi(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    const gmxRegistry = await setupGmxRegistry(core);
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        core.weth.address,
        core.marketIds.weth,
        gmxRegistry.address,
        underlyingToken.address,
        BORROW_POSITION_PROXY_V2.address,
        userVaultImplementation.address,
        DOLOMITE_MARGIN.address,
      ],
    );
    priceOracle = await createContractWithAbi<GLPPriceOracleV1>(
      GLPPriceOracleV1__factory.abi,
      GLPPriceOracleV1__factory.bytecode,
      [
        core.gmxEcosystem.glpManager,
        core.gmxEcosystem.gmxVault,
        core.gmxEcosystem.glp,
        factory.address,
      ],
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    unwrapper = await createGlpUnwrapperProxy(factory, gmxRegistry);
    await factory.initialize([unwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GLPWrappedTokenUserVaultV1>(
      vaultAddress,
      GLPWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    const usdcAmount = amountWei.div(1e12).mul(2);
    await setupUSDCBalance(core.hhUser1, usdcAmount, core.gmxEcosystem.glpRewardsRouter);
    await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(core.usdc.address, usdcAmount, 0, 0);
    await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#exchange', () => {
    it('should', async () => {});
  });

  describe('#token', () => {
    it('should', async () => {});
  });

  describe('#outputMarketId', () => {
    it('should', async () => {});
  });

  describe('#createActionsForUnwrappingForLiquidation', () => {
    it('should', async () => {});
  });

  describe('#actionsLength', () => {
    it('should', async () => {});
  });

  describe('#glp', () => {
    it('should', async () => {});
  });

  describe('#glpManager', () => {
    it('should', async () => {});
  });

  describe('#glpRewardsRouter', () => {
    it('should', async () => {});
  });

  describe('#gmxVault', () => {
    it('should', async () => {});
  });

  describe('#getExchangeCost', () => {
    it('should', async () => {});
  });
});
