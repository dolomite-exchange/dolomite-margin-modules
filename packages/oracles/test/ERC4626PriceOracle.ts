import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { TokenInfo } from '../src';
import { ERC4626PriceOracle, ERC4626PriceOracle__factory, IERC4626, IERC4626__factory } from '../src/types';

const ORI_BGT_PRICE = BigNumber.from('4095315751369824094'); // ~ $4
const ORI_BGT = '0x69f1E971257419B1E9C405A553f252c64A29A30a';

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
      [ORI_BGT, core.dolomiteMargin.address],
    );
    vault = IERC4626__factory.connect(ORI_BGT, core.hhUser1);

    const tokenInfo: TokenInfo = {
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.iBgt.address, weight: 100 }],
      decimals: 18,
      token: ORI_BGT,
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.VAULT()).to.eq(ORI_BGT);
      expect(await oracle.VAULT_DECIMALS()).to.eq(18);
      expect(await oracle.ASSET()).to.eq(core.tokens.iBgt.address);
      expect(await oracle.ASSET_DECIMALS()).to.eq(18);
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getPrice', () => {
    it('should work normally to get iBgt asset amount', async () => {
      const price = await oracle.getPrice(ORI_BGT);
      expect(price.value).to.eq(await vault.convertToAssets(ONE_ETH_BI));
    });

    it('should work normally with oracle aggregator', async () => {
      const price = await core.oracleAggregatorV2.getPrice(ORI_BGT);
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
