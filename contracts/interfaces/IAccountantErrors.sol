// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IAccountantErrors {
    error AccountantProviders__PlatformFeeTooLarge();
    error AccountantProviders__Paused();
    error AccountantProviders__ZeroFeesOwed();
    error AccountantProviders__OnlyCallableByBoringVault();
}
