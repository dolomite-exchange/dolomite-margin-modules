import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { increaseToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { TokenInfo } from '../src';
import { ERC4626PriceOracle, ERC4626PriceOracle__factory, IERC4626, IERC4626__factory } from '../src/types';

const ORI_BGT_PRICE = BigNumber.from('4095320890051707522'); // ~ $4

// Sample ERC4626
const X_FAT_BERA = '0xcAc89B3F94eD6BAb04113884deeE2A55293c2DD7';
const FAT_BERA = '0xBAE11292A3E693aF73651BDa350D752AE4A391D4';

describe('ERC4626PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let oracle: ERC4626PriceOracle;
  let vault: IERC4626;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 7_768_500,
    });

    oracle = await createContractWithAbi<ERC4626PriceOracle>(
      ERC4626PriceOracle__factory.abi,
      ERC4626PriceOracle__factory.bytecode,
      [[core.tokens.oriBgt.address], core.dolomiteMargin.address],
    );
    vault = IERC4626__factory.connect(core.tokens.oriBgt.address, core.hhUser1);

    const tokenInfo: TokenInfo = {
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.iBgt.address, weight: 100 }],
      decimals: 18,
      token: core.tokens.oriBgt.address,
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      const info = await oracle.tokenInfo(core.tokens.oriBgt.address);
      expect(info.vault).to.eq(core.tokens.oriBgt.address);
      expect(info.vaultDecimals).to.eq(18);
      expect(info.asset).to.eq(core.tokens.iBgt.address);
      expect(info.assetDecimals).to.eq(18);
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#ownerInsertOrUpdateToken', () => {
    it('should work normally to add token', async () => {
      const res = await oracle.connect(core.governance).ownerInsertOrUpdateToken(
        X_FAT_BERA,
        true
      );
      await expectEvent(oracle, res, 'TokenInsertedOrUpdated', {
        token: X_FAT_BERA,
        isSupported: true,
      });
      const info = await oracle.tokenInfo(X_FAT_BERA);
      expect(info.vault).to.eq(X_FAT_BERA);
      expect(info.vaultDecimals).to.eq(18);
      expect(info.asset).to.eq(FAT_BERA);
      expect(info.assetDecimals).to.eq(18);
    });

    it('should work normally to remove token', async () => {
      const res = await oracle.connect(core.governance).ownerInsertOrUpdateToken(
        core.tokens.oriBgt.address,
        false
      );
      await expectEvent(oracle, res, 'TokenInsertedOrUpdated', {
        token: core.tokens.oriBgt.address,
        isSupported: false,
      });
      const info = await oracle.tokenInfo(core.tokens.oriBgt.address);
      expect(info.vault).to.eq(ADDRESS_ZERO);
      expect(info.vaultDecimals).to.eq(0);
      expect(info.asset).to.eq(ADDRESS_ZERO);
      expect(info.assetDecimals).to.eq(0);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateToken(core.tokens.beraEth.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('should work normally to get iBgt asset amount', async () => {
      await increaseToTimestamp(1752595000);
      const price = await oracle.getPrice(core.tokens.oriBgt.address);
      expect(price.value).to.eq(await vault.convertToAssets(ONE_ETH_BI));
    });

    it('should work normally with oracle aggregator', async () => {
      await increaseToTimestamp(1752595000);
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.oriBgt.address);
      expect(price.value).to.eq(ORI_BGT_PRICE);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).getPrice(core.tokens.iBgt.address),
        `ERC4626PriceOracle: Invalid token <${core.tokens.iBgt.address.toLowerCase()}>`,
      );
    });
  });
});
