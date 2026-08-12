import { ActionType } from '@dolomite-exchange/dolomite-margin/dist/src';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BYTES_EMPTY } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import { AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';
import { IDolomiteStructs } from '../../../../../../base/src/types/contracts/protocol/interfaces/IDolomiteMargin';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Final settlement for XAI
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const filtered = SUPPLIERS.filter((s) => parseFloat(s.valuePar) > 0.1);

  const accounts = filtered.map((s) => ({ owner: s.marginAccount.user.id, number: s.marginAccount.accountNumber }));
  const actions = filtered.map(
    (s, i) =>
      ({
        actionType: ActionType.Withdraw,
        accountId: i,
        amount: { value: 0, sign: false, ref: AmountReference.Target, denomination: AmountDenomination.Wei },
        primaryMarketId: core.marketIds.xai,
        secondaryMarketId: 0,
        otherAddress: s.marginAccount.user.id,
        otherAccountId: 0,
        data: BYTES_EMPTY,
      } as IDolomiteStructs.ActionArgsStruct),
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'operate',
      [accounts, actions],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
  );

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      logGasUsage: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      // loop through borrow and supply, call expiry and check expiration timestamp
    },
  };
}

doDryRunAndCheckDeployment(main);

const SUPPLIERS = [
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xa60eb863192ab74b80519b47344b4807c331ce72',
      },
    },
    valuePar: '11813.444822839717677329',
  },
  {
    marginAccount: {
      accountNumber: '62539437832142269592142594319750486629807187907822399685004857395176990627454',
      user: {
        id: '0x0d64823746506e52e74eff356dd638b291089109',
      },
    },
    valuePar: '11158.337499711148750672',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x9a76ec6cdfd8981ece4fe23107612e2a48ee9f87',
      },
    },
    valuePar: '8788.378598879690541052',
  },
  {
    marginAccount: {
      accountNumber: '41615920521526601451885587979757495603036851022799782520563205141918238634018',
      user: {
        id: '0x70322c562cb66b57c0c9f12c0e0227dbdc3b20a4',
      },
    },
    valuePar: '8366.136266884858774364',
  },
  {
    marginAccount: {
      accountNumber: '50179922947356562420409755891388058229498773599968049910809307563202803167916',
      user: {
        id: '0x7e4b9c72238e3bc71406be2444a75db8145e3fa1',
      },
    },
    valuePar: '4445.55386155619792515',
  },
  {
    marginAccount: {
      accountNumber: '89567983060220098807795814972600282105476485713052785946639993318130660017941',
      user: {
        id: '0xecc424f835fbe864577c3f0b4bf4886614859b31',
      },
    },
    valuePar: '3966.324813454050911209',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x7741c6fe7621e6d61fe759ab4d5670abefe52fda',
      },
    },
    valuePar: '3360.836545867672950549',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xd27ada59961e327ea73bf49aceb9fe6547e44df6',
      },
    },
    valuePar: '2866.995163012285754561',
  },
  {
    marginAccount: {
      accountNumber: '68224694560898714742691099988247687528501822810344828564050405899216682554460',
      user: {
        id: '0x97be2c665c72847c3d26dd216a481d09e31f41bb',
      },
    },
    valuePar: '2615.366598066234406646',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x92cbe89b5cb1c22c2c16bc465caf34e3c80b617d',
      },
    },
    valuePar: '2500',
  },
  {
    marginAccount: {
      accountNumber: '36658926526663191190714725164084410055253604185181399675070126843866499961221',
      user: {
        id: '0x4600b2e30607d2fe9624d150c8f526b530949bbe',
      },
    },
    valuePar: '2285.304735737300907623',
  },
  {
    marginAccount: {
      accountNumber: '85119259519740670305342618935801253940419301982119043961288602411198011776059',
      user: {
        id: '0xe4f0e1873e1ec602fdf6c51f0ddc0b8be17fefa2',
      },
    },
    valuePar: '1973.263811383542231048',
  },
  {
    marginAccount: {
      accountNumber: '102831979474979729688742344077683537015102055280618495743961775045103571293348',
      user: {
        id: '0xee205f027a3e31dbe3e6ea5df048886c4c10e133',
      },
    },
    valuePar: '1858.40412648263627156',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x3684576d4bc48ea02070e1a48e9e9eebd6c94dd4',
      },
    },
    valuePar: '1504',
  },
  {
    marginAccount: {
      accountNumber: '55279060049723755032464600864038483272004585270661827525839513535356960599954',
      user: {
        id: '0x165f871f9a726fc703007da8c1189e32977dacdf',
      },
    },
    valuePar: '1222.218743697649689712',
  },
  {
    marginAccount: {
      accountNumber: '66570160677945307242025643918568649547521904748879042866827771907614302837832',
      user: {
        id: '0xa398674a63bff2a14d60e5a9ec9e23ae871deb51',
      },
    },
    valuePar: '1109.175251622186053557',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x61cd1eb8434aabdd38a0abd62dc8665e958e41d1',
      },
    },
    valuePar: '1102.794284913128845652',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x37f2c2c38a263e2e2b22b7d36d727e9027607feb',
      },
    },
    valuePar: '977.066840529967798601',
  },
  {
    marginAccount: {
      accountNumber: '96223408819474933987991279285954417693802808709550414085684176258640621642908',
      user: {
        id: '0x6b1d89de6442be42129c3d408231e6031b0d39ad',
      },
    },
    valuePar: '846.08165187406608972',
  },
  {
    marginAccount: {
      accountNumber: '92182021568757029422296302397575800252477754044240130291758879213238801553505',
      user: {
        id: '0x7cd04f513821c22dfe1bd03f79a21d84dead7260',
      },
    },
    valuePar: '766.098505544192017726',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x35856d76f488dde751ccc213e1c8c5b836f10d3d',
      },
    },
    valuePar: '736.270882706960194933',
  },
  {
    marginAccount: {
      accountNumber: '112799985549549762107159910180651488513006955301857019660369130482498220832000',
      user: {
        id: '0xd202b913da55310c05a640e587932579f548764a',
      },
    },
    valuePar: '646.58705635996921396',
  },
  {
    marginAccount: {
      accountNumber: '1507863912588491310654134366129291597795036738563446172368635183038847093853',
      user: {
        id: '0x9ec6fc4201df32c1c1155fcbff153500991bb520',
      },
    },
    valuePar: '603.167101140418935053',
  },
  {
    marginAccount: {
      accountNumber: '80360958423584322857597532703075394487022612653231115879173331533262095470682',
      user: {
        id: '0x7621ed391febdb60a9db8b0ee3c65997502fc74b',
      },
    },
    valuePar: '554.766201924743219084',
  },
  {
    marginAccount: {
      accountNumber: '72822881508277850119899244506438604756048890347655394975364023411498140278119',
      user: {
        id: '0xb61f2cbe563d31af205e174254cf4f9949e381b4',
      },
    },
    valuePar: '466.603519534603505722',
  },
  {
    marginAccount: {
      accountNumber: '79349648050851474708880785672123170944584840003341178623932050861337802326185',
      user: {
        id: '0x26467e6599be5952c5a7dc0760958fac24b8f948',
      },
    },
    valuePar: '451.487000771904945446',
  },
  {
    marginAccount: {
      accountNumber: '66201697729739516874291558936982112794603630400147614825841696927369899632390',
      user: {
        id: '0x152fa38ffa947a7fe081a8a7d80d7cc402b5bf9e',
      },
    },
    valuePar: '421.74412240088427095',
  },
  {
    marginAccount: {
      accountNumber: '22509690024354041667419217539338876035186908457375467057297670086069919153747',
      user: {
        id: '0xdd810f6d6b8f16090745a6e5fe44bfea4c1533ae',
      },
    },
    valuePar: '391.337163150289303993',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xb6f5de39742eeca134a2b4cda5ad4f43617e8f65',
      },
    },
    valuePar: '337.665148615354060371',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x710541e9b9d900b9e340aae7e3f90e208d129458',
      },
    },
    valuePar: '287.727398110177073975',
  },
  {
    marginAccount: {
      accountNumber: '73288294132928013465556005417755029711469883336904357753675684197077019693529',
      user: {
        id: '0xc7f3a66f240b174cd4687854bc5cb90b592a58d2',
      },
    },
    valuePar: '233.006046501374479663',
  },
  {
    marginAccount: {
      accountNumber: '10445082188018755261598903669585382851985882867522624057321876600071496554000',
      user: {
        id: '0x4f5838148b52d7739139332c05f9af354228a174',
      },
    },
    valuePar: '169.283453009490506375',
  },
  {
    marginAccount: {
      accountNumber: '25469557579878606335636325112652804150221060193138411020405829567054979205890',
      user: {
        id: '0x2f5d37a469952e81ba42cce90df9362c0cfa26b9',
      },
    },
    valuePar: '99.332104324210618859',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xd9a0a16e5a634bf5a02962b667f17c65bae14086',
      },
    },
    valuePar: '89.35934446907184632',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xd1d1f716ead02c264d6dc574840c611e0fd6dd45',
      },
    },
    valuePar: '79.829167143726934676',
  },
  {
    marginAccount: {
      accountNumber: '11523906741601611899435001339169062166427708212966807076209736272253799775411',
      user: {
        id: '0xea329420c80e584c67873d9cfbb452ad78f78631',
      },
    },
    valuePar: '63.105537238353700733',
  },
  {
    marginAccount: {
      accountNumber: '28328269910173273283146581387495774094901952907372501629898872994960685022762',
      user: {
        id: '0x791e4c2ad3ea89f7183e6b010ac41e632a3c323a',
      },
    },
    valuePar: '50.009386016145862798',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x7c1987289a01392e719b269c711150b6db92a349',
      },
    },
    valuePar: '31.669108874726803477',
  },
  {
    marginAccount: {
      accountNumber: '65805305167024257829973276043479260382183023360558110054695207025513885323339',
      user: {
        id: '0x177ac42684c7fe12636d2745187196d634d78ed5',
      },
    },
    valuePar: '28.909365454427862578',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xa4a47f85089402989b0d9ce470ed9a6a6eb67ecb',
      },
    },
    valuePar: '27.284610498943029691',
  },
  {
    marginAccount: {
      accountNumber: '102168060277588188060259684692972691206069185819783182607529363861311231249579',
      user: {
        id: '0xfd5854eb0c451d970130a4babb567572e76fa11a',
      },
    },
    valuePar: '13.299933706664424669',
  },
  {
    marginAccount: {
      accountNumber: '79903182481857875463822703459481747972619087016611792189461506300922378494651',
      user: {
        id: '0x99d112cc5c9fcbbfcb8c29ddcfff3be8fb0a6ef8',
      },
    },
    valuePar: '9.99926519308643021',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x4bbe0fd0bdec55e074c5e6ea9f4f627aff31e93a',
      },
    },
    valuePar: '9',
  },
  {
    marginAccount: {
      accountNumber: '53510485592996248668713309158540911398107814235591856005852501286733056375343',
      user: {
        id: '0x312191196ee79e01c38dc3c83f5dfd4bf42fb440',
      },
    },
    valuePar: '7.308130363460301366',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xdfaa204f863b750744c2754f83c410d85ba75f2b',
      },
    },
    valuePar: '5.890565279011795175',
  },
  {
    marginAccount: {
      accountNumber: '79843523638879943056701972754573082175853054362511397809550711849397413529954',
      user: {
        id: '0xdb47b39e2fe61ba6a0f82abf07daa38d358134c5',
      },
    },
    valuePar: '5.650242430374894096',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xc4137cd4fe5b811c77cb3f0f0eba28755e96099e',
      },
    },
    valuePar: '4.845870576488955687',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x7e4b9c72238e3bc71406be2444a75db8145e3fa1',
      },
    },
    valuePar: '3.307695532005763077',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xe18574afe358fae6f802b1fe57fd691e48a03ddf',
      },
    },
    valuePar: '3.103278979749310678',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xbcbeac56eef250e8a4859be46c6cbfd93aae5d2f',
      },
    },
    valuePar: '2.572449268603279689',
  },
  {
    marginAccount: {
      accountNumber: '18159271231557196625027028956441976405054866848728084816092078500854382509913',
      user: {
        id: '0x20ead2f46da0db4bb3debe92f0b1b71b7849ea7d',
      },
    },
    valuePar: '2.351371545557120944',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x412aaf8da5f6acf6b78ee7e67aa1b5cd99fadbe1',
      },
    },
    valuePar: '1.962176739189558425',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x5b977ce6ae6de2947d32ebd3ec1ee7f57e30a82f',
      },
    },
    valuePar: '1.100407753472179659',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x52256ef863a713ef349ae6e97a7e8f35785145de',
      },
    },
    valuePar: '0.975618133295797599',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xff1fc55b3b5d2cc62b82d1f77da88355e8175254',
      },
    },
    valuePar: '0.776883223959522111',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x109604ea48c699e9ff49feb4017c818175c234f8',
      },
    },
    valuePar: '0.46603781436022669',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xecc424f835fbe864577c3f0b4bf4886614859b31',
      },
    },
    valuePar: '0.446404385355146108',
  },
  {
    marginAccount: {
      accountNumber: '1917366436867269478823327651876543940975331660132877175000731510464057992410',
      user: {
        id: '0x8d106c747cd21272d4c9ff0af8d53a9c9aca25d2',
      },
    },
    valuePar: '0.076296178369944963',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xd516c9877578f3d21c4221fbd3cb8d2a17312ebe',
      },
    },
    valuePar: '0.032419659081431764',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x1270388b431a353082df5747ee6e72687467d603',
      },
    },
    valuePar: '0.01341685799169878',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x213fbe7864ef4f8545c5b83a625c3cdc42ea7a3c',
      },
    },
    valuePar: '0.013402385112557703',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x0c0ca03f2f3f6c3fd915f060a71c29ca86897dba',
      },
    },
    valuePar: '0.013387935638820065',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xa10a132f20d76ff9537e87286891eec36f7efac7',
      },
    },
    valuePar: '0.013373509520045059',
  },
  {
    marginAccount: {
      accountNumber: '64882249609291248482435149931085237165569752000954406891057607798220685264188',
      user: {
        id: '0xf0a6c5738b85cbf8ee89b5f52797d4c9ae5842e6',
      },
    },
    valuePar: '0.009323455043550203',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xb0e0515c10b255c1f33fb06921e35528c23ff2a6',
      },
    },
    valuePar: '0.005355371589781863',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x4e724089956d474c2bee62dabfd9b0b1c1aa272c',
      },
    },
    valuePar: '0.004005239972386887',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xa5a8c343eaebdf2d6170e0a1e56089aa18b29ceb',
      },
    },
    valuePar: '0.000973265546107707',
  },
  {
    marginAccount: {
      accountNumber: '110857725950098209540308623018191113756081865203820725868065969191041734373100',
      user: {
        id: '0xb0e0515c10b255c1f33fb06921e35528c23ff2a6',
      },
    },
    valuePar: '0.000387906028861743',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x6b1d89de6442be42129c3d408231e6031b0d39ad',
      },
    },
    valuePar: '0.000209681014672291',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x26467e6599be5952c5a7dc0760958fac24b8f948',
      },
    },
    valuePar: '0.000163538864803516',
  },
  {
    marginAccount: {
      accountNumber: '23354831286562830980033819025664056470521933218076820924270798157394123646296',
      user: {
        id: '0xc4644f5e136f5c44ee407520eac303d565372702',
      },
    },
    valuePar: '0.000132426561420699',
  },
  {
    marginAccount: {
      accountNumber: '84008160217885864004857466091988314821831650043629698035437510136470861014894',
      user: {
        id: '0x4475e0c536ccbbadfaf393f7af43db3773b99a6d',
      },
    },
    valuePar: '0.000125521741893641',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x70322c562cb66b57c0c9f12c0e0227dbdc3b20a4',
      },
    },
    valuePar: '0.000097432513608606',
  },
  {
    marginAccount: {
      accountNumber: '57225795315235293323548364660450066537250122516413929210803097886633145282324',
      user: {
        id: '0x37f3be5d3c1340b252784f65aa88ce9900badf4e',
      },
    },
    valuePar: '0.000094606176263108',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x1a245fa866932731631e1ec8edcdbb0c6a402559',
      },
    },
    valuePar: '0.00007039107937329',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x17de124661151a1ebed7998eb2b2e9fc6c00b81c',
      },
    },
    valuePar: '0.000061211525083995',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x4600b2e30607d2fe9624d150c8f526b530949bbe',
      },
    },
    valuePar: '0.000046726532894256',
  },
  {
    marginAccount: {
      accountNumber: '70039391684779990869192197844140260804382329103215270435477386683212542806790',
      user: {
        id: '0x17de124661151a1ebed7998eb2b2e9fc6c00b81c',
      },
    },
    valuePar: '0.000045015187904409',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x4475e0c536ccbbadfaf393f7af43db3773b99a6d',
      },
    },
    valuePar: '0.000044752418735313',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xd202b913da55310c05a640e587932579f548764a',
      },
    },
    valuePar: '0.000041991708847338',
  },
  {
    marginAccount: {
      accountNumber: '72507145646980239813652876774199064039000645593238719069199909792144973712423',
      user: {
        id: '0x29cf8553c4efcf049c95c4e500bd9468396050db',
      },
    },
    valuePar: '0.000038092881080851',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x29cf8553c4efcf049c95c4e500bd9468396050db',
      },
    },
    valuePar: '0.000037804300085077',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x165f871f9a726fc703007da8c1189e32977dacdf',
      },
    },
    valuePar: '0.000036721300058663',
  },
  {
    marginAccount: {
      accountNumber: '88800278452137119858355772227791266160821388848702419555204947634522525943502',
      user: {
        id: '0x520159894aa9921bd2180d1f390d27ed91b473b8',
      },
    },
    valuePar: '0.000036428913904298',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x2dfddc72b4a0b6027282539ed22e6239268c1cfb',
      },
    },
    valuePar: '0.000035262156844108',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xea329420c80e584c67873d9cfbb452ad78f78631',
      },
    },
    valuePar: '0.000029584641494507',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xa7dcc1e8789c9ef53b0e9522519064015ec21690',
      },
    },
    valuePar: '0.000027652227270727',
  },
  {
    marginAccount: {
      accountNumber: '31408579720565932346027931538124857303023382245946947471286211758367115540182',
      user: {
        id: '0x7741c6fe7621e6d61fe759ab4d5670abefe52fda',
      },
    },
    valuePar: '0.000027638252330348',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xf9ed3e500abd6c8fadb0d366d44242b8b64bf29b',
      },
    },
    valuePar: '0.000027603429748398',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xa122aec4bab024ccd6f2d46e9474539101054e78',
      },
    },
    valuePar: '0.000022310388341677',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x8f3a5edf65ca82321cb5fbc05fd8d06b5ae55d3b',
      },
    },
    valuePar: '0.000021620317404145',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x7621ed391febdb60a9db8b0ee3c65997502fc74b',
      },
    },
    valuePar: '0.000020318181262207',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x1ee0fd5d06c5e28b0f917069084d6b5a3e06a44b',
      },
    },
    valuePar: '0.000020125518280394',
  },
  {
    marginAccount: {
      accountNumber: '102890455027648388327395358030665311234467180641246656528710058028452907051681',
      user: {
        id: '0x17de124661151a1ebed7998eb2b2e9fc6c00b81c',
      },
    },
    valuePar: '0.0000190172431523',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x29cf2074d472f019f5e8afdc42b7e05ee26ef963',
      },
    },
    valuePar: '0.000016682565232808',
  },
  {
    marginAccount: {
      accountNumber: '99921020722771359941702073246995609227131348529115406799907942938284491917058',
      user: {
        id: '0x001ecf112c3dd6bce77578f34f126f64c188d250',
      },
    },
    valuePar: '0.000016264479221594',
  },
  {
    marginAccount: {
      accountNumber: '37951935268733364434878772942403392610979014097650858056215359204630301062170',
      user: {
        id: '0xee94295d91b6ef67bc928c97a18ad6a9250ae718',
      },
    },
    valuePar: '0.000015165910466747',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x37f3be5d3c1340b252784f65aa88ce9900badf4e',
      },
    },
    valuePar: '0.000014261985890823',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0x9387f71f3928ebe9ce8b3d8cf37a8fb52739ae7d',
      },
    },
    valuePar: '0.000013658372742621',
  },
  {
    marginAccount: {
      accountNumber: '0',
      user: {
        id: '0xb39d9d81ce88aa1679f0570af6e452d50358ea3f',
      },
    },
    valuePar: '0.000011998286073756',
  },
];
