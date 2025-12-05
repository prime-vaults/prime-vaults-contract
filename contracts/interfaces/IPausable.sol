// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IPausable {
    /* ========================================= EVENTS ========================================= */
    event Paused();
    event Unpaused();

    /* ========================================= FUNCTIONS ========================================= */
    function pause() external;
    function unpause() external;
}
