// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import { IGmxDataStore } from "@dolomite-exchange/modules-gmx-v2/contracts/interfaces/IGmxDataStore.sol";
import { Glv } from "../lib/Glv.sol";
import { GlvDeposit } from "../lib/GlvDeposit.sol";
import { GlvPrice } from "../lib/GlvPrice.sol";
import { GlvShift } from "../lib/GlvShift.sol";
import { GlvWithdrawal } from "../lib/GlvWithdrawal.sol";


interface IGlvReader {

    struct GlvInfo {
        Glv.Props glv;
        address[] markets;
    }

    function getGlvValue(
        IGmxDataStore dataStore,
        address[] memory marketAddresses,
        GlvPrice.Props[] memory indexTokenPrices,
        GlvPrice.Props memory longTokenPrice,
        GlvPrice.Props memory shortTokenPrice,
        address glv,
        bool maximize
    ) external view returns (uint256);

    function getGlvTokenPrice(
        IGmxDataStore dataStore,
        address[] memory marketAddresses,
        GlvPrice.Props[] memory indexTokenPrices,
        GlvPrice.Props memory longTokenPrice,
        GlvPrice.Props memory shortTokenPrice,
        address glv,
        bool maximize
    ) external view returns (uint256, uint256, uint256);

    function getGlv(IGmxDataStore dataStore, address glv) external view returns (Glv.Props memory);

    function getGlvInfo(IGmxDataStore dataStore, address glv) external view returns (GlvInfo memory);

    function getGlvBySalt(IGmxDataStore dataStore, bytes32 salt) external view returns (Glv.Props memory);

    function getGlvs(IGmxDataStore dataStore, uint256 start, uint256 end) external view returns (Glv.Props[] memory);

    function getGlvInfoList(IGmxDataStore dataStore, uint256 start, uint256 end) external view returns (GlvInfo[] memory);

    function getGlvDeposit(IGmxDataStore dataStore, bytes32 key) external view returns (GlvDeposit.Props memory);

    function getGlvDeposits(
        IGmxDataStore dataStore,
        uint256 start,
        uint256 end
    ) external view returns (GlvDeposit.Props[] memory);

    function getAccountGlvDeposits(
        IGmxDataStore dataStore,
        address account,
        uint256 start,
        uint256 end
    ) external view returns (GlvDeposit.Props[] memory);

    function getGlvWithdrawal(IGmxDataStore dataStore, bytes32 key) external view returns (GlvWithdrawal.Props memory);

    function getGlvWithdrawals(
        IGmxDataStore dataStore,
        uint256 start,
        uint256 end
    ) external view returns (GlvWithdrawal.Props[] memory);

    function getAccountGlvWithdrawals(
        IGmxDataStore dataStore,
        address account,
        uint256 start,
        uint256 end
    ) external view returns (GlvWithdrawal.Props[] memory);

    function getGlvShift(IGmxDataStore dataStore, bytes32 key) external view returns (GlvShift.Props memory);

    function getGlvShifts(
        IGmxDataStore dataStore,
        uint256 start,
        uint256 end
    ) external view returns (GlvShift.Props[] memory);
}
