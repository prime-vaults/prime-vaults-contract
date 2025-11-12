// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract PrimeDecoderAndSanitizer {
    error PrimeDecoderAndSanitizer__FunctionSelectorNotSupported();

    function deposit(address asset, uint256) external pure virtual returns (bytes memory addressesFound) {
        addressesFound = abi.encodePacked(asset);
    }

    function withdraw(address asset, uint256, address to) external pure virtual returns (bytes memory addressesFound) {
        addressesFound = abi.encodePacked(asset, to);
    }

    //============================== FALLBACK ===============================
    /**
     * @notice The purpose of this function is to revert with a known error,
     *         so that during merkle tree creation we can verify that a
     *         leafs decoder and sanitizer implements the required function
     *         selector.
     */
    fallback() external virtual {
        revert PrimeDecoderAndSanitizer__FunctionSelectorNotSupported();
    }
}
