// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IVeArtProxy } from "./interfaces/IVeArtProxy.sol";
import { Base64 } from "./libraries/Base64.sol";


/**
 * @title   VeArt
 * @author  Dolomite
 * @author  RamsesExchange
 *
 * @notice  Creates an SVG for a user's locked veDOLO
 */
contract VeArt is IVeArtProxy {

    // ==================================================
    // ===================== Structs ====================
    // ==================================================

    struct DecimalStringParams {
        // significant figures of decimal
        uint256 sigfigs;
        // length of decimal string
        uint8 bufferLength;
        // ending index for significant figures (funtion works backwards when copying sigfigs)
        uint8 sigfigIndex;
        // index of decimal place (0 if no decimal)
        uint8 decimalIndex;
        // start index for trailing/leading 0's for very small/large numbers
        uint8 zerosStartIndex;
        // end index for trailing/leading 0's for very small/large numbers
        uint8 zerosEndIndex;
        // true if decimal number is less than one
        bool isLessThanOne;
        // true if string should include "%"
        bool isPercent;
    }

    // ==================================================
    // =============== External Functions ===============
    // ==================================================

    function _tokenURI(
        uint256 _tokenId,
        uint256 _balanceOf,
        uint256 _locked_end,
        uint256 _value
    ) external view returns (string memory output) {
        // solhint-disable max-line-length
        output = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" viewBox="0 0 387 476"><defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#14171b"/><stop offset="20%" style="stop-color:#1b272e"/><stop offset="56%" style="stop-color:#273945"/><stop offset="75%" style="stop-color:#253542"/><stop offset="100%" style="stop-color:#151719"/></linearGradient></defs><style>.venft{width:96px;height:108px;fill:#0000ff y:51px;x:136px;}.vr{font-family:Open Sans;font-style:normal;font-weight:400;fill:#F9F9F9;}.label{fill:#F9F9F9;font-family:Open Sans;font-style:normal;font-weight:500;font-size:16px;}.amount{fill:#F9F9F9;font-family:Open Sans;font-style:normal;font-weight:500;font-size:24px;}.app{fill:#F9F9F9;font-family:Open Sans;font-style:normal;font-weight:500;font-size:14px;}</style><path d="M0 16C0 7.16344 7.16344 0 16 0H371C379.837 0 387 7.16344 387 16V263H0V16Z" fill="url(#gg2)"/><path d="M0 263H387V460C387 468.837 379.837 476 371 476H16C7.16345 476 0 468.837 0 460V263Z" fill="#1e1c29"/><defs><linearGradient id="gg2" x1="0" y1="0" x2="373.573" y2="280.859" gradientUnits="userSpaceOnUse"><stop stop-color="#14171B"/><stop offset="0.382158" stop-color="#3d3e54"/><stop offset="0.566492" stop-color="#3f4056"/><stop offset="0.711953" stop-color="#3f4056"/><stop offset="1" stop-color="#292938"/></linearGradient></defs> <text y="240" x="50%" dominant-baseline="middle" text-anchor="middle" class="vr" font-size="24px"> veDOLO #';
        // solhint-enable max-line-length

        uint256 duration = 0;
        if (_locked_end > block.timestamp) {
            duration = _locked_end - block.timestamp;
        }

        // solhint-disable max-line-length
        output = string(
            abi.encodePacked(
                output,
                _decimalString(_tokenId, 0, false),
                '</text> <text y="308" x="16" dominant-baseline="middle" class="label" fill="#FFFFFF"> DOLO Locked: </text> <text y="308" x="370" dominant-baseline="middle" text-anchor="end" class="amount">',
                _decimalString(_value / 1e16, 2, false),
                '</text> <text y="356" x="16" dominant-baseline="middle" class="label" fill="#000000"> veDOLO Power: </text> <text y="356" x="370" dominant-baseline="middle" text-anchor="end" class="amount">',
                _decimalString(_balanceOf / 1e16, 2, false),
                '</text> <text y="404" x="16" dominant-baseline="middle" class="label" fill="#FFFFFF">Expires:</text> <text y="404" x="370" dominant-baseline="middle" text-anchor="end" class="amount">',
                _decimalString(duration / 8640, 1, false),
                ' days </text> <text y="458" x="50%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" class="app">Dolomite</text> <svg x="29.8%" y="14%" width="192" height="192" viewBox="0 0 387 476" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1.30566,0,0,1.30566,-43.4039,-43.4039)"> <path d="M163.747,248.584C161.889,245.263 160.748,241.487 160.532,237.466C154.533,238.622 148.338,239.228 142,239.228L141.686,239.228C141.385,238.539 140.954,237.617 140.376,236.491C138.422,232.687 134.515,225.287 129.477,215.856L136.019,144.542C141.25,153.965 151.004,171.505 160.529,188.634C161.969,184.462 164.516,180.808 167.818,178.021C162.908,169.191 158.062,160.478 153.933,153.049C154.718,152.602 155.576,151.984 156.657,150.726C157.543,149.693 158.333,148.261 158.931,146.57C159.397,145.252 159.751,143.706 160.084,142.255C161.129,142.682 162.179,143.273 163.086,144.568C163.693,145.434 168.361,151.016 174.624,158.332C175.916,156.419 177.395,154.621 179.051,152.965C180.153,151.863 181.319,150.839 182.539,149.897C177.063,143.5 173.077,138.736 172.527,137.951C169.785,134.038 166.698,132.411 163.564,131.237L163.564,131.237C161.307,130.391 158.333,129.811 156.042,130.285C153.175,130.877 150.817,132.539 149.757,136.065C149.329,137.49 148.965,139.411 148.501,141.228C148.404,141.609 148.238,142.112 148.09,142.536C144.794,136.6 142.628,132.696 142.312,132.112C138.915,125.832 132.007,123.967 126.346,127.963C125.188,128.78 122.826,131.286 120.213,134.316C117.267,137.733 111.84,143.487 111.541,143.804C110.52,144.229 109.492,144.725 108.388,143.971C108.175,143.636 106.682,141.266 105.813,139.479C103.467,134.656 101.006,128.897 99.063,126.403C97.134,123.928 85.981,116.245 76.689,110.543C73.192,108.396 69.925,106.553 67.464,105.261C67.398,105.176 67.334,105.095 67.273,105.02C65.829,103.241 64.426,102.616 63.78,102.407C60.223,101.251 59.308,101.345 56.813,102.26C55.993,102.561 54.791,103.139 52.458,104.032C67.239,69.195 101.755,44.772 142,44.772C195.717,44.772 239.228,88.283 239.228,142C239.228,146.506 238.922,150.941 238.329,155.284C242.33,159.343 245.36,164.184 247.267,169.445C249.545,160.678 250.757,151.481 250.757,142C250.757,81.913 202.087,33.243 142,33.243C81.913,33.243 33.243,81.913 33.243,142C33.243,202.087 81.913,250.757 142,250.757C149.447,250.757 156.719,250.009 163.747,248.584ZM182.052,188.931C176.139,190.707 171.832,196.191 171.832,202.681C171.832,212.706 171.832,226.036 171.832,236.061C171.832,243.988 178.259,250.415 186.186,250.415C199.894,250.415 220.439,250.415 234.147,250.415C242.074,250.415 248.501,243.988 248.501,236.061C248.501,226.036 248.501,212.706 248.501,202.681C248.501,196.191 244.193,190.707 238.281,188.931L238.281,182.823C238.281,175.425 235.342,168.329 230.11,163.098C224.879,157.867 217.783,154.928 210.385,154.928C210.239,154.928 210.094,154.928 209.948,154.928C202.549,154.928 195.454,157.867 190.223,163.098C184.991,168.329 182.052,175.425 182.052,182.823L182.052,188.931ZM128.303,238.272C127.755,237.216 127.153,236.065 126.519,234.862C114.224,211.536 82.326,152.402 66.316,125.073C63.619,120.469 60.714,115.945 59.261,113.718L58.474,114.044C56.464,114.87 53.276,116.1 47.809,117.783C45.827,125.52 44.772,133.636 44.772,142C44.772,191.065 81.073,231.615 128.303,238.272ZM214.885,223.679C217.676,222.051 219.553,219.025 219.553,215.565C219.553,210.384 215.347,206.178 210.166,206.178C204.986,206.178 200.78,210.384 200.78,215.565C200.78,219.025 202.657,222.051 205.448,223.679L205.448,231.108C205.448,232.604 206.66,233.817 208.157,233.817C209.418,233.817 210.915,233.817 212.176,233.817C213.672,233.817 214.885,232.604 214.885,231.108L214.885,223.679ZM80.478,126.528C91.401,145.598 106.907,173.941 119.589,197.444L124.188,147.314C123.571,148.019 122.966,148.694 122.386,149.315C119.769,152.116 117.289,153.962 115.97,154.445C111.217,156.188 106.5,157.007 101.314,153.086C99.889,152.008 98.177,149.77 96.613,146.828C94.276,142.431 91.921,135.995 89.968,133.489C88.989,132.232 85.12,129.532 80.478,126.528ZM225.618,188.327L225.618,181.24C225.618,172.708 218.701,165.791 210.169,165.791C210.167,165.791 210.166,165.791 210.164,165.791C201.632,165.791 194.715,172.708 194.715,181.24L194.715,188.327L225.618,188.327Z" style="fill:white;"/> </g> </svg> </svg>'
            )
        );
        // solhint-enable max-line-length

        // solhint-disable max-line-length
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "veDOLO Lock #',
                        _decimalString(_tokenId, 0, false),
                        '", "description": "Dolomite locks can be used to boost oDOLO discounts, vote on governance proposals, and receive protocol revenues", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(output)),
                        '"}'
                    )
                )
            )
        );
        // solhint-enable max-line-length

        output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );
    }

    // ==================================================
    // =============== Internal Functions ===============
    // ==================================================

    function _toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT license
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _decimalString(
        uint256 number,
        uint8 decimals,
        bool isPercent
    ) internal pure returns (string memory) {
        uint8 percentBufferOffset = isPercent ? 1 : 0;
        uint256 tenPowDecimals = 10 ** decimals;

        uint256 temp = number;
        uint8 digits;
        uint8 numSigfigs;
        while (temp != 0) {
            if (numSigfigs > 0) {
                // count all digits preceding least significant figure
                numSigfigs++;
            } else if (temp % 10 != 0) {
                numSigfigs++;
            }
            digits++;
            temp /= 10;
        }

        DecimalStringParams memory params;
        params.isPercent = isPercent;
        if ((digits - numSigfigs) >= decimals) {
            // no decimals, ensure we preserve all trailing zeros
            params.sigfigs = number / tenPowDecimals;
            params.sigfigIndex = digits - decimals;
            params.bufferLength = params.sigfigIndex + percentBufferOffset;
        } else {
            // chop all trailing zeros for numbers with decimals
            params.sigfigs = number / (10 ** (digits - numSigfigs));
            if (tenPowDecimals > number) {
                // number is less tahn one
                // in this case, there may be leading zeros after the decimal place
                // that need to be added

                // offset leading zeros by two to account for leading '0.'
                params.zerosStartIndex = 2;
                params.zerosEndIndex = decimals - digits + 2;
                params.sigfigIndex = numSigfigs + params.zerosEndIndex;
                params.bufferLength = params.sigfigIndex + percentBufferOffset;
                params.isLessThanOne = true;
            } else {
                // In this case, there are digits before and
                // after the decimal place
                params.sigfigIndex = numSigfigs + 1;
                params.decimalIndex = digits - decimals + 1;
            }
        }
        params.bufferLength = params.sigfigIndex + percentBufferOffset;
        return _generateDecimalString(params);
    }

    function _generateDecimalString(
        DecimalStringParams memory params
    ) internal pure returns (string memory) {
        bytes memory buffer = new bytes(params.bufferLength);
        if (params.isPercent) {
            buffer[buffer.length - 1] = "%";
        }
        if (params.isLessThanOne) {
            buffer[0] = "0";
            buffer[1] = ".";
        }

        // add leading/trailing 0's
        for (
            uint256 zerosCursor = params.zerosStartIndex;
            zerosCursor < params.zerosEndIndex;
            zerosCursor++
        ) {
            buffer[zerosCursor] = bytes1(uint8(48));
        }
        // add sigfigs
        while (params.sigfigs > 0) {
            if (
                params.decimalIndex > 0 &&
                params.sigfigIndex == params.decimalIndex
            ) {
                buffer[--params.sigfigIndex] = ".";
            }
            buffer[--params.sigfigIndex] = bytes1(
                uint8(uint256(48) + (params.sigfigs % 10))
            );
            params.sigfigs /= 10;
        }
        return string(buffer);
    }
}
