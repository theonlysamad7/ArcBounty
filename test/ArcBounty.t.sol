// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

import {Test} from "forge-std/Test.sol";
import {ArcBounty} from "../src/ArcBounty.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(
        address to,
        uint256 amount
    ) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(
        address spender,
        uint256 amount
    ) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];

        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);

        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;

        emit Transfer(address(0), to, amount);
    }
}

contract ArcBountyTest is Test {
    ArcBounty public bounty;
    MockUSDC public usdc;

    address public creator = address(1);
    address public contributor = address(2);
    address public anotherContributor = address(3);

    uint256 constant REWARD = 2_000_000; // 2 USDC
    uint256 constant DEADLINE = 7 days;

    function setUp() public {
        usdc = new MockUSDC();
        bounty = new ArcBounty(address(usdc));

        usdc.mint(creator, 100_000_000); // 100 USDC

        vm.prank(creator);
        usdc.approve(address(bounty), type(uint256).max);
    }

    function testCreateBountyLocksUSDC() public {
        vm.prank(creator);

        uint256 bountyId = bounty.createBounty(
            REWARD,
            block.timestamp + DEADLINE,
            "Find 5 Arc projects",
            "Find five projects building on Arc and provide links."
        );

        assertEq(bountyId, 0);
        assertEq(usdc.balanceOf(address(bounty)), REWARD);
        assertEq(usdc.balanceOf(creator), 98_000_000);

        (
            uint256 id,
            address bountyCreator,
            uint256 reward,
            uint256 deadline,
            ArcBounty.BountyStatus status,
            string memory title,
            string memory description
        ) = bounty.bounties(bountyId);

        assertEq(id, 0);
        assertEq(bountyCreator, creator);
        assertEq(reward, REWARD);
        assertEq(deadline, block.timestamp + DEADLINE);
        assertEq(
            uint256(status),
            uint256(ArcBounty.BountyStatus.Active)
        );
        assertEq(title, "Find 5 Arc projects");
        assertEq(
            description,
            "Find five projects building on Arc and provide links."
        );
    }

    function testContributorCanSubmitWork() public {
        uint256 bountyId = _createBounty();

        vm.prank(contributor);

        bounty.submitWork(
            bountyId,
            "https://example.com/proof"
        );

        ArcBounty.Submission[] memory submissions =
            bounty.getSubmissions(bountyId);

        assertEq(submissions.length, 1);
        assertEq(submissions[0].id, 0);
        assertEq(submissions[0].contributor, contributor);
        assertEq(
            submissions[0].proof,
            "https://example.com/proof"
        );
        assertFalse(submissions[0].resolved);
    }

    function testCreatorCanApproveAndPayContributor() public {
        uint256 bountyId = _createBounty();

        vm.prank(contributor);

        bounty.submitWork(
            bountyId,
            "https://example.com/proof"
        );

        vm.prank(creator);

        bounty.approveSubmission(bountyId, 0, 0);

        assertEq(usdc.balanceOf(contributor), REWARD);
        assertEq(usdc.balanceOf(address(bounty)), 0);

        (
            ,
            ,
            ,
            ,
            ArcBounty.BountyStatus status,
            ,

        ) = bounty.bounties(bountyId);

        assertEq(
            uint256(status),
            uint256(ArcBounty.BountyStatus.Completed)
        );
    }

    function testCreatorCanRejectSubmission() public {
        uint256 bountyId = _createBounty();

        vm.prank(contributor);

        bounty.submitWork(
            bountyId,
            "https://example.com/proof"
        );

        vm.prank(creator);

        bounty.rejectSubmission(bountyId, 0);

        ArcBounty.Submission[] memory submissions =
            bounty.getSubmissions(bountyId);

        assertTrue(submissions[0].resolved);

        assertEq(
            usdc.balanceOf(address(bounty)),
            REWARD
        );
    }

    function testRefundBlockedWhileSubmissionUnresolved() public {
        uint256 bountyId = _createBounty();

        vm.prank(contributor);
        bounty.submitWork(bountyId, "https://example.com/proof");

        vm.warp(block.timestamp + DEADLINE + 1);

        vm.expectRevert(ArcBounty.UnresolvedSubmissions.selector);
        vm.prank(creator);
        bounty.claimRefund(bountyId);
    }

    function testCreatorCanRefundAfterDeadlineWhenNoSubmissions() public {
        uint256 bountyId = _createBounty();

        vm.warp(block.timestamp + DEADLINE + 1);

        vm.prank(creator);
        bounty.claimRefund(bountyId);

        assertEq(usdc.balanceOf(creator), 100_000_000);
        assertEq(usdc.balanceOf(address(bounty)), 0);
        assertEq(bounty.remainingReward(bountyId), 0);

        (
            ,
            ,
            ,
            ,
            ArcBounty.BountyStatus status,
            ,

        ) = bounty.bounties(bountyId);

        assertEq(
            uint256(status),
            uint256(ArcBounty.BountyStatus.Cancelled)
        );
    }

    function testContributorCanResubmitAfterRejection() public {
        uint256 bountyId = _createBounty();

        vm.prank(contributor);
        bounty.submitWork(bountyId, "https://example.com/proof-1");

        assertEq(bounty.unresolvedSubmissionCount(bountyId), 1);

        vm.prank(creator);
        bounty.rejectSubmission(bountyId, 0);

        assertFalse(bounty.hasSubmitted(bountyId, contributor));
        assertEq(bounty.unresolvedSubmissionCount(bountyId), 0);

        vm.prank(contributor);
        bounty.submitWork(bountyId, "https://example.com/proof-2");

        assertTrue(bounty.hasSubmitted(bountyId, contributor));
        assertEq(bounty.unresolvedSubmissionCount(bountyId), 1);

        // The rejected submission remains in the history, and the retry
        // receives a new submission ID.
        assertEq(bounty.getSubmissions(bountyId).length, 2);
    }

    function testContributorCannotSubmitTwice() public {
        uint256 bountyId = _createBounty();

        vm.startPrank(contributor);

        bounty.submitWork(
            bountyId,
            "https://example.com/proof-1"
        );

        vm.expectRevert(ArcBounty.AlreadySubmitted.selector);

        bounty.submitWork(
            bountyId,
            "https://example.com/proof-2"
        );

        vm.stopPrank();
    }

    function testOnlyCreatorCanApprove() public {
        uint256 bountyId = _createBounty();

        vm.prank(contributor);

        bounty.submitWork(
            bountyId,
            "https://example.com/proof"
        );

        vm.prank(anotherContributor);

        vm.expectRevert(ArcBounty.NotCreator.selector);

        bounty.approveSubmission(bountyId, 0, 0);
    }

    function testCannotCancelBeforeDeadline() public {
        uint256 bountyId = _createBounty();

        vm.prank(creator);

        vm.expectRevert(ArcBounty.DeadlineNotPassed.selector);

        bounty.claimRefund(bountyId);
    }

    function testEqualSplitForFourWinners() public {
        uint16[] memory percentages = new uint16[](0);

        vm.prank(creator);
        uint256 bountyId = bounty.createBounty(
            4_000_000,
            block.timestamp + DEADLINE,
            "Four winners",
            "Reward four contributors equally.",
            4,
            percentages
        );

        uint256[] memory amounts = bounty.getPayoutAmounts(bountyId);

        assertEq(amounts.length, 4);
        assertEq(amounts[0], 1_000_000);
        assertEq(amounts[1], 1_000_000);
        assertEq(amounts[2], 1_000_000);
        assertEq(amounts[3], 1_000_000);
        assertEq(bounty.remainingReward(bountyId), 4_000_000);
    }

    function testCustomSplit45_30_25() public {
        uint16[] memory percentages = new uint16[](3);
        percentages[0] = 4500;
        percentages[1] = 3000;
        percentages[2] = 2500;

        vm.prank(creator);
        uint256 bountyId = bounty.createBounty(
            10_000_000,
            block.timestamp + DEADLINE,
            "Three winners",
            "Reward contributors by placement.",
            3,
            percentages
        );

        uint256[] memory amounts = bounty.getPayoutAmounts(bountyId);

        assertEq(amounts.length, 3);
        assertEq(amounts[0], 4_500_000);
        assertEq(amounts[1], 3_000_000);
        assertEq(amounts[2], 2_500_000);
    }

    function testCustomSplitMustTotal100Percent() public {
        uint16[] memory percentages = new uint16[](3);
        percentages[0] = 4500;
        percentages[1] = 3000;
        percentages[2] = 2000;

        vm.prank(creator);
        vm.expectRevert(ArcBounty.InvalidPayoutPercentages.selector);

        bounty.createBounty(
            10_000_000,
            block.timestamp + DEADLINE,
            "Invalid split",
            "Percentages do not total 100.",
            3,
            percentages
        );
    }

    function testCannotPaySameTierTwice() public {
        uint16[] memory percentages = new uint16[](0);

        vm.prank(creator);
        uint256 bountyId = bounty.createBounty(
            4_000_000,
            block.timestamp + DEADLINE,
            "Two winners",
            "Each tier can only be paid once.",
            2,
            percentages
        );

        vm.prank(contributor);
        bounty.submitWork(bountyId, "https://example.com/first");

        vm.prank(anotherContributor);
        bounty.submitWork(bountyId, "https://example.com/second");

        vm.prank(creator);
        bounty.approveSubmission(bountyId, 0, 0);

        vm.prank(creator);
        vm.expectRevert(ArcBounty.PayoutTierAlreadyPaid.selector);
        bounty.approveSubmission(bountyId, 1, 0);
    }

    function testRefundReturnsOnlyRemainingEscrowAfterPartialPayout() public {
        uint16[] memory percentages = new uint16[](0);

        vm.prank(creator);
        uint256 bountyId = bounty.createBounty(
            4_000_000,
            block.timestamp + DEADLINE,
            "Four winners",
            "Reward four contributors equally.",
            4,
            percentages
        );

        vm.prank(contributor);
        bounty.submitWork(bountyId, "https://example.com/proof-1");

        vm.prank(anotherContributor);
        bounty.submitWork(bountyId, "https://example.com/proof-2");

        // Pay the first winner.
        vm.prank(creator);
        bounty.approveSubmission(bountyId, 0, 0);

        // Resolve the other submission before refunding.
        vm.prank(creator);
        bounty.rejectSubmission(bountyId, 1);

        // The remaining escrow cannot be refunded before the deadline.
        vm.expectRevert(ArcBounty.DeadlineNotPassed.selector);
        vm.prank(creator);
        bounty.claimRefund(bountyId);

        // Move past the deadline and refund the unpaid balance.
        vm.warp(block.timestamp + DEADLINE + 1);

        uint256 creatorBalanceBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        bounty.claimRefund(bountyId);

        assertEq(usdc.balanceOf(creator), creatorBalanceBefore + 3_000_000);
        assertEq(bounty.remainingReward(bountyId), 0);
        (
            uint256 returnedId,
            address returnedCreator,
            uint256 returnedReward,
            uint256 returnedDeadline,
            ArcBounty.BountyStatus returnedStatus,
            string memory returnedTitle,
            string memory returnedDescription
        ) = bounty.bounties(bountyId);

        assertEq(returnedId, bountyId);
        assertEq(
            uint256(returnedStatus),
            uint256(ArcBounty.BountyStatus.Cancelled)
        );
        assertEq(bounty.remainingReward(bountyId), 0);
    }

    function _createBounty() internal returns (uint256 bountyId) {
        vm.prank(creator);

        bountyId = bounty.createBounty(
            REWARD,
            block.timestamp + DEADLINE,
            "Find 5 Arc projects",
            "Find five projects building on Arc."
        );
    }
}
