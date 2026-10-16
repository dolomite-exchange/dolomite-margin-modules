import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { setupCoreProtocol, setupTestMarket, setupWETHBalance } from '../utils/setup';
import {
  RouterProxy__factory,
  StewardsRainAuthRouter,
  StewardsRainAuthRouter__factory,
  TestEIP3009Token,
  TestEIP3009Token__factory,
} from 'packages/base/src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { BigNumber, ethers } from 'ethers';
import { expectEvent, expectThrow } from '../utils/assertions';
import { expect } from 'chai';

describe('StewardsRainAuthRouter', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let router: StewardsRainAuthRouter;
  let usdcToken: TestEIP3009Token;
  let usdcMarketId: BigNumber;

  const defaultVaultAccountNumber = BigNumber.from('1234');
  const merchantId1 = BigNumber.from('1001');
  const merchantId2 = BigNumber.from('1002');
  const factor130Bps = BigNumber.from('13000'); // 1.30x

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 412_717_690,
    });

    usdcToken = await createContractWithAbi<TestEIP3009Token>(
      TestEIP3009Token__factory.abi,
      TestEIP3009Token__factory.bytecode,
      ['USD Coin', 'USDC', 6],
    );

    usdcMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(
      usdcToken.address,
      '1000000000000000000000000000000', // $1.00 for 6-decimal token
    );
    await setupTestMarket(core, usdcToken, false);

    const implementation = await createContractWithAbi<StewardsRainAuthRouter>(
      StewardsRainAuthRouter__factory.abi,
      StewardsRainAuthRouter__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    const initCalldata = await implementation.populateTransaction['initialize(address,address,address,uint256,uint256)'](
      core.hhUser1.address, // owner
      core.hhUser3.address, // rainFloat
      core.hhUser1.address, // stewardsVaultOwner
      defaultVaultAccountNumber,
      usdcMarketId,
    );

    const proxy = await createContractWithAbi(
      RouterProxy__factory.abi,
      RouterProxy__factory.bytecode,
      [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
    );

    router = StewardsRainAuthRouter__factory.connect(proxy.address, core.hhUser1);

    // Set router as global operator on Dolomite Margin so it can borrow/withdraw and deposit
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(router.address, true);

    // Deposit collateral (e.g. WETH) into Stewards vault account so it has borrow capacity
    await setupWETHBalance(core, core.hhUser1, ethers.utils.parseEther('100'), core.dolomiteMargin);
    await depositIntoDolomiteMargin(
      core,
      core.hhUser1,
      defaultVaultAccountNumber,
      core.marketIds.weth,
      ethers.utils.parseEther('100'),
    );

    // Mint USDC liquidity into Dolomite Margin so it can be borrowed
    await usdcToken.mint('1000000000000', core.governance.address);
    await usdcToken.connect(core.governance).approve(core.dolomiteMargin.address, ethers.constants.MaxUint256);
    await depositIntoDolomiteMargin(
      core,
      core.governance,
      0,
      usdcMarketId,
      '1000000000000',
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should revert if already initialized', async () => {
      await expectThrow(
        router['initialize(address,address,address,uint256,uint256)'](
          core.hhUser1.address,
          core.hhUser3.address,
          core.hhUser1.address,
          defaultVaultAccountNumber,
          usdcMarketId,
        ),
        'Initializable: contract is already initialized',
      );
    });

    it('should set initial state properly', async () => {
      expect(await router.owner()).to.equal(core.hhUser1.address);
      expect(await router.isRelayer(core.hhUser1.address)).to.be.true;
      expect(await router.rainFloat()).to.equal(core.hhUser3.address);
      expect(await router.stewardsVaultOwner()).to.equal(core.hhUser1.address);
      expect(await router.stewardsVaultAccountNumber()).to.equal(defaultVaultAccountNumber);
      expect(await router.usdcMarketId()).to.equal(usdcMarketId);
    });
  });

  describe('Admin functions', () => {
    it('setOwner should work and revert for non-owner or zero address', async () => {
      await expectThrow(
        router.connect(core.hhUser2).setOwner(core.hhUser2.address),
        'NotOwner()',
      );
      await expectThrow(
        router.connect(core.hhUser1).setOwner(ADDRESS_ZERO),
        'ZeroAddress()',
      );

      const res = await router.connect(core.hhUser1).setOwner(core.hhUser2.address);
      await expectEvent(router, res, 'OwnerUpdated', {
        oldOwner: core.hhUser1.address,
        newOwner: core.hhUser2.address,
      });
      expect(await router.owner()).to.equal(core.hhUser2.address);
    });

    it('setRelayer should work and revert for non-owner or zero address', async () => {
      await expectThrow(
        router.connect(core.hhUser2).setRelayer(core.hhUser2.address, true),
        'NotOwner()',
      );
      await expectThrow(
        router.connect(core.hhUser1).setRelayer(ADDRESS_ZERO, true),
        'ZeroAddress()',
      );

      const res = await router.connect(core.hhUser1).setRelayer(core.hhUser2.address, true);
      await expectEvent(router, res, 'RelayerUpdated', {
        relayer: core.hhUser2.address,
        isRelayer: true,
      });
      expect(await router.isRelayer(core.hhUser2.address)).to.be.true;
    });

    it('setRainFloat should work and revert for non-owner or zero address', async () => {
      await expectThrow(
        router.connect(core.hhUser2).setRainFloat(core.hhUser2.address),
        'NotOwner()',
      );
      await expectThrow(
        router.connect(core.hhUser1).setRainFloat(ADDRESS_ZERO),
        'ZeroAddress()',
      );

      const res = await router.connect(core.hhUser1).setRainFloat(core.hhUser2.address);
      await expectEvent(router, res, 'RainFloatUpdated', {
        oldFloat: core.hhUser3.address,
        newFloat: core.hhUser2.address,
      });
      expect(await router.rainFloat()).to.equal(core.hhUser2.address);
    });

    it('setStewardsVault should work and revert for non-owner or zero address', async () => {
      await expectThrow(
        router.connect(core.hhUser2).setStewardsVault(core.hhUser2.address, 1, usdcMarketId),
        'NotOwner()',
      );
      await expectThrow(
        router.connect(core.hhUser1).setStewardsVault(ADDRESS_ZERO, 1, usdcMarketId),
        'ZeroAddress()',
      );

      const res = await router.connect(core.hhUser1).setStewardsVault(core.hhUser2.address, 999, usdcMarketId);
      await expectEvent(router, res, 'StewardsVaultUpdated', {
        vaultOwner: core.hhUser2.address,
        vaultAccountNumber: 999,
        usdcMarketId: usdcMarketId,
      });
      expect(await router.stewardsVaultOwner()).to.equal(core.hhUser2.address);
      expect(await router.stewardsVaultAccountNumber()).to.equal(999);
    });

    it('configureMerchantAccount should configure merchant and validate factor', async () => {
      await expectThrow(
        router.connect(core.hhUser2).configureMerchantAccount(merchantId1, 10000, 13000, 0, 0, 0, 0, true),
        'NotOwner()',
      );
      // factor < 10000 (1.00x) is invalid
      await expectThrow(
        router.connect(core.hhUser1).configureMerchantAccount(merchantId1, 10000, 9999, 0, 0, 0, 0, true),
        'InvalidFactor()',
      );

      const res = await router.connect(core.hhUser1).configureMerchantAccount(
        merchantId1,
        '10000000000', // $10,000 limit (6 decimals)
        factor130Bps,
        0,
        0,
        0,
        '2000000000', // $2,000 daily limit
        true,
      );

      await expectEvent(router, res, 'MerchantConfigured', {
        merchantId: merchantId1,
        merchantLimit: '10000000000',
        factorBps: factor130Bps,
        outstandingPrincipal: 0,
        outstandingFactor: 0,
        dailySpent: 0,
        dailyLimit: '2000000000',
        enabled: true,
      });

      const acct = await router.getMerchantAccount(merchantId1);
      expect(acct.merchantLimit).to.equal('10000000000');
      expect(acct.factorBps).to.equal(factor130Bps);
      expect(acct.enabled).to.be.true;
    });
  });

  describe('#fundAuth', () => {
    beforeEach(async () => {
      await router.connect(core.hhUser1).configureMerchantAccount(
        merchantId1,
        '10000000000', // $10,000
        factor130Bps, // 1.30x
        0,
        0,
        0,
        '2000000000', // $2,000 daily limit
        true,
      );
    });

    it('should revert if called by non-relayer', async () => {
      const authId = ethers.utils.formatBytes32String('auth-1');
      const authHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-1'));

      await expectThrow(
        router.connect(core.hhUser2).fundAuth(authId, merchantId1, '200000000', authHash),
        'NotRelayer()',
      );
    });

    it('should decline if merchant account is disabled', async () => {
      await router.connect(core.hhUser1).configureMerchantAccount(
        merchantId1,
        '10000000000',
        factor130Bps,
        0,
        0,
        0,
        '2000000000',
        false, // disabled
      );

      const authId = ethers.utils.formatBytes32String('auth-1');
      const authHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-1'));

      const res = await router.connect(core.hhUser1).fundAuth(authId, merchantId1, '200000000', authHash);
      await expectEvent(router, res, 'AuthDeclined', {
        authId: authId,
        merchantId: merchantId1,
        amount: '200000000',
        authHash: authHash,
        reason: 3, // DeclineReason.ACCOUNT_DISABLED
      });

      const record = await router.getAuthRecord(authId);
      expect(record.status).to.equal(2); // DECLINED
      expect(record.reason).to.equal(3); // ACCOUNT_DISABLED
    });

    it('should decline if amount exceeds available merchant limit', async () => {
      const authId = ethers.utils.formatBytes32String('auth-1');
      const authHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-1'));

      // Request $15,000 when limit is $10,000
      const res = await router.connect(core.hhUser1).fundAuth(authId, merchantId1, '15000000000', authHash);
      await expectEvent(router, res, 'AuthDeclined', {
        authId: authId,
        merchantId: merchantId1,
        amount: '15000000000',
        authHash: authHash,
        reason: 1, // DeclineReason.INSUFFICIENT_BALANCE
      });
    });

    it('should decline if amount exceeds daily velocity limit', async () => {
      const authId = ethers.utils.formatBytes32String('auth-1');
      const authHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-1'));

      // Request $2,500 when daily limit is $2,000
      const res = await router.connect(core.hhUser1).fundAuth(authId, merchantId1, '2500000000', authHash);
      await expectEvent(router, res, 'AuthDeclined', {
        authId: authId,
        merchantId: merchantId1,
        amount: '2500000000',
        authHash: authHash,
        reason: 4, // DeclineReason.VELOCITY_LIMIT_EXCEEDED
      });
    });

    it('should fund successfully, update merchant accounting, and transfer USDC to float', async () => {
      const authId = ethers.utils.formatBytes32String('auth-1');
      const authHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-1'));
      const spendAmount = new BigNumber.from('200000000'); // $200 (6 decimals)
      const expectedFactorCost = new BigNumber.from('60000000'); // $60 (6 decimals, 30% of $200)

      const initialFloatBalance = await usdcToken.balanceOf(core.hhUser3.address);

      const res = await router.connect(core.hhUser1).fundAuth(authId, merchantId1, spendAmount, authHash);
      await expectEvent(router, res, 'AuthFunded', {
        authId: authId,
        merchantId: merchantId1,
        amount: spendAmount,
        authHash: authHash,
      });

      // Float should receive the USDC
      const finalFloatBalance = await usdcToken.balanceOf(core.hhUser3.address);
      expect(finalFloatBalance.sub(initialFloatBalance)).to.equal(spendAmount);

      // Merchant account state updated
      const acct = await router.getMerchantAccount(merchantId1);
      expect(acct.outstandingPrincipal).to.equal(spendAmount);
      expect(acct.outstandingFactor).to.equal(expectedFactorCost);
      expect(acct.dailySpent).to.equal(spendAmount);

      // Idempotent retry with exact same params
      const retryRes = await router.connect(core.hhUser1).fundAuth(authId, merchantId1, spendAmount, authHash);
      await expectEvent(router, retryRes, 'AuthAlreadyResolved', {
        authId: authId,
        merchantId: merchantId1,
        status: 1, // FUNDED
        reason: 0,
        amount: spendAmount,
        authHash: authHash,
      });

      // Balances did not change on retry
      const retryFloatBalance = await usdcToken.balanceOf(core.hhUser3.address);
      expect(retryFloatBalance).to.equal(finalFloatBalance);

      // Replay with different params should revert
      await expectThrow(
        router.connect(core.hhUser1).fundAuth(authId, merchantId1, '300000000', authHash),
        `AuthReplayConflict("${authId}")`,
      );
    });
  });

  describe('#repayBatch', () => {
    beforeEach(async () => {
      // Configure two merchant accounts
      await router.connect(core.hhUser1).configureMerchantAccount(
        merchantId1,
        '10000000000',
        factor130Bps,
        0,
        0,
        0,
        0,
        true,
      );
      await router.connect(core.hhUser1).configureMerchantAccount(
        merchantId2,
        '10000000000',
        factor130Bps,
        0,
        0,
        0,
        0,
        true,
      );

      // Fund card swipes for both merchants
      const authId1 = ethers.utils.formatBytes32String('auth-1');
      const authHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-1'));
      await router.connect(core.hhUser1).fundAuth(authId1, merchantId1, '500000000', authHash1); // $500

      const authId2 = ethers.utils.formatBytes32String('auth-2');
      const authHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('payload-2'));
      await router.connect(core.hhUser1).fundAuth(authId2, merchantId2, '1000000000', authHash2); // $1,000
    });

    it('should validate batch parameters', async () => {
      const dummyAuth = {
        from: core.hhUser2.address,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        v: 0,
        r: ethers.constants.HashZero,
        s: ethers.constants.HashZero,
      };

      // Empty batch
      await expectThrow(
        router.repayBatch(1, [], [], dummyAuth),
        'InvalidBatchSize()',
      );

      // Length mismatch
      await expectThrow(
        router.repayBatch(1, [merchantId1], [100, 200], dummyAuth),
        'ArrayLengthMismatch()',
      );

      // Zero amount
      await expectThrow(
        router.repayBatch(1, [merchantId1], [0], dummyAuth),
        'InvalidRepaymentAmount()',
      );

      // Unordered or duplicate merchant IDs
      await expectThrow(
        router.repayBatch(1, [merchantId2, merchantId1], [100, 200], dummyAuth),
        'InvalidBatchOrder()',
      );
      await expectThrow(
        router.repayBatch(1, [merchantId1, merchantId1], [100, 200], dummyAuth),
        'InvalidBatchOrder()',
      );

      // Zero address from
      await expectThrow(
        router.repayBatch(1, [merchantId1], [100], { ...dummyAuth, from: ADDRESS_ZERO }),
        'ZeroAddress()',
      );
    });

    it('should execute batch repayment and update merchant accounting proportionally', async () => {
      const batchId = 123;
      const merchantIds = [merchantId1, merchantId2];
      const repaymentAmounts = [new BigNumber.from('250000000'), new BigNumber.from('500000000')]; // $250 and $500
      const totalRepayment = repaymentAmounts[0].add(repaymentAmounts[1]); // $750

      // Mint USDC to payer (e.g. Stewards settlement wallet)
      await usdcToken.mint(totalRepayment, core.hhUser2.address);

      const authParams = {
        from: core.hhUser2.address,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        v: 27,
        r: ethers.utils.formatBytes32String('r'),
        s: ethers.utils.formatBytes32String('s'),
      };

      const digest = await router.calculateBatchDigest(batchId, merchantIds, repaymentAmounts);

      const res = await router.connect(core.hhUser1).repayBatch(batchId, merchantIds, repaymentAmounts, authParams);

      await expectEvent(router, res, 'BatchRepaid', {
        batchId: batchId,
        batchDigest: digest,
        totalAmount: totalRepayment,
        merchantCount: 2,
      });

      expect(await router.isBatchProcessed(batchId)).to.be.true;

      // Merchant 1: $250 weekly payment with 1.30x factor:
      // principal portion = $250 * 10000 / 13000 = $192.307692
      // factor portion = $250 - principal portion = $57.692308
      const acct1 = await router.getMerchantAccount(merchantId1);
      const expectedPrincipalPaid1 = repaymentAmounts[0].mul(10000).div(13000);
      const expectedFactorPaid1 = repaymentAmounts[0].sub(expectedPrincipalPaid1);

      expect(acct1.outstandingPrincipal).to.equal(new BigNumber.from('500000000').sub(expectedPrincipalPaid1));
      const initialFactor1 = new BigNumber.from('500000000').mul(3000).div(10000);
      expect(acct1.outstandingFactor).to.equal(initialFactor1.sub(expectedFactorPaid1));

      // Cannot re-process the same batch
      await expectThrow(
        router.connect(core.hhUser1).repayBatch(batchId, merchantIds, repaymentAmounts, authParams),
        `BatchAlreadyProcessed(${batchId})`,
      );
    });
  });
});
