// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseDecoderAndSanitizer} from "./BaseDecoderAndSanitizer.sol";
import {PrimeDecoderAndSanitizer} from "./PrimeDecoderAndSanitizer.sol";

contract FullDecoderAndSanitizer is BaseDecoderAndSanitizer, PrimeDecoderAndSanitizer {
    error FullDecoderAndSanitizer__FunctionSelectorNotSupported();

    // Override fallback to resolve conflict
    fallback() external override(BaseDecoderAndSanitizer, PrimeDecoderAndSanitizer) {
        revert FullDecoderAndSanitizer__FunctionSelectorNotSupported();
    }
}
