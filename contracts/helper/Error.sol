// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.23;

library Error {
    //////////////////////////////////////////////////////////////
    //                  INPUT VALIDATION ERRORS                 //
    /////////////////////////////////error/////////////////////////////
    ///@notice errors thrown if input variables are not valid

    /// @dev thrown if address input is address 0
    error ZERO_ADDRESS();

    /// @dev thrown if an initialization function is called more than once
    error ALREADY_INITIALIZED();

    //////////////////////////////////////////////////////////////
    //                  AUTHORIZATION ERRORS                    //
    //////////////////////////////////////////////////////////////
    ///@notice errors thrown if functions cannot be called

    /// @dev thrown if msg.sender is not protocol admin
    error NOT_PROTOCOL_ADMIN();

    /// @dev thrown if msg.sender is not emergency admin
    error NOT_EMERGENCY_ADMIN();
}
