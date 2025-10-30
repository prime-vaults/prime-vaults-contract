// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IRewardsDistributor {
    struct Reward {
        address rewardsDistributor;
        uint256 rewardsDuration;
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    /*//////////////////////////////////////////////////////////////
                        EXTERNAL VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function totalSupply() external view returns (uint256);

    function balanceOf(address _account) external view returns (uint256);

    function lastTimeRewardApplicable(address _rewardsToken) external view returns (uint256);

    function rewardPerToken(address _rewardsToken) external view returns (uint256);

    function earned(address _account, address _rewardsToken) external view returns (uint256);

    function getRewardForDuration(address _rewardsToken) external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                        EXTERNAL WRITE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function claim(address _rewardsToken) external;

    function batchClaim(address[] calldata _rewardsTokens) external;

    function beforeUpdate(address _from, address _to, uint256 _amount) external;

    function afterUpdate(address _from, address _to, uint256 _amount) external;
}
