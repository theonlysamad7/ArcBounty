// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import {Script} from "forge-std/Script.sol";
import {ArcBounty} from "../src/ArcBounty.sol";

contract DeployArcBounty is Script {
    function run() external returns (ArcBounty bounty) {
        address usdc = 0x3600000000000000000000000000000000000000;

        vm.startBroadcast();
        bounty = new ArcBounty(usdc);
        vm.stopBroadcast();
    }
}
