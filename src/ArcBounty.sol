// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcBounty is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    uint256 public nextBountyId;

    enum BountyStatus {
        Active,
        Completed,
        Cancelled
    }

    struct Bounty {
        uint256 id;
        address creator;
        uint256 reward;
        uint256 deadline;
        BountyStatus status;
        string title;
        string description;
    }

    struct Submission {
        uint256 id;
        address contributor;
        string proof;
        bool resolved;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission[]) private bountySubmissions;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(uint256 => uint256) public unresolvedSubmissionCount;

    // Number of payout positions configured for each bounty.
    mapping(uint256 => uint256) public winnerCount;

    // Number of payout positions already paid.
    mapping(uint256 => uint256) public paidWinners;

    // Amount of escrow still held for each bounty.
    mapping(uint256 => uint256) public remainingReward;

    // payoutAmounts[bountyId][tier] stores the USDC amount for that tier.
    // Tier 0 is first place, tier 1 is second place, and so on.
    mapping(uint256 => uint256[]) private payoutAmounts;

    // Prevents a payout tier from being used more than once.
    mapping(uint256 => mapping(uint256 => bool)) public tierPaid;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 reward,
        uint256 deadline,
        string title
    );

    event WorkSubmitted(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed contributor
    );

    event SubmissionApproved(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed contributor,
        uint256 reward
    );

    event SubmissionRejected(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed contributor
    );

    event BountyCancelled(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 refund
    );

    event WinnerCountConfigured(
        uint256 indexed bountyId,
        uint256 winnerCount
    );

    event WinnerPaid(
        uint256 indexed bountyId,
        uint256 indexed tier,
        uint256 indexed submissionId,
        address contributor,
        uint256 amount
    );

    error InvalidUSDC();
    error InvalidReward();
    error InvalidDeadline();
    error InvalidTitle();
    error InvalidDescription();
    error BountyNotFound();
    error NotCreator();
    error BountyNotActive();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error UnresolvedSubmissions();
    error SubmissionNotFound();
    error AlreadySubmitted();
    error AlreadyResolved();
    error InvalidWinnerCount();
    error InvalidPayoutPercentages();
    error InvalidPayoutTier();
    error PayoutTierAlreadyPaid();

    constructor(address _usdc) {
        if (_usdc == address(0)) revert InvalidUSDC();

        usdc = IERC20(_usdc);
    }

    /**
     * @notice Backwards-compatible single-winner bounty creation.
     */
    function createBounty(
        uint256 reward,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external nonReentrant returns (uint256 bountyId) {
        uint16[] memory percentages = new uint16[](1);
        percentages[0] = 10_000;

        return _createBounty(
            reward,
            deadline,
            title,
            description,
            1,
            percentages
        );
    }

    /**
     * @notice Create a bounty with multiple winners.
     * @param reward Total USDC reward in the token's smallest units.
     * @param deadline Unix timestamp when submissions close.
     * @param title Bounty title.
     * @param description Bounty description.
     * @param _winnerCount Number of payout positions.
     * @param percentagesBps Custom percentages in basis points.
     *
     * For equal split, pass an empty percentagesBps array.
     * For custom split, percentages must add up to 10,000.
     * 4,500 basis points means 45%.
     */
    function createBounty(
        uint256 reward,
        uint256 deadline,
        string calldata title,
        string calldata description,
        uint256 _winnerCount,
        uint16[] calldata percentagesBps
    ) external nonReentrant returns (uint256 bountyId) {
        uint16[] memory percentages = percentagesBps;

        return _createBounty(
            reward,
            deadline,
            title,
            description,
            _winnerCount,
            percentages
        );
    }

    function _createBounty(
        uint256 reward,
        uint256 deadline,
        string calldata title,
        string calldata description,
        uint256 _winnerCount,
        uint16[] memory percentagesBps
    ) internal returns (uint256 bountyId) {
        if (reward == 0) revert InvalidReward();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(title).length == 0) revert InvalidTitle();
        if (bytes(description).length == 0) revert InvalidDescription();

        if (_winnerCount == 0 || _winnerCount > 100) {
            revert InvalidWinnerCount();
        }

        if (reward < _winnerCount) revert InvalidReward();

        bool equalSplit = percentagesBps.length == 0;

        if (!equalSplit && percentagesBps.length != _winnerCount) {
            revert InvalidPayoutPercentages();
        }

        uint256 percentageTotal;

        if (!equalSplit) {
            for (uint256 i = 0; i < percentagesBps.length; i++) {
                if (percentagesBps[i] == 0) {
                    revert InvalidPayoutPercentages();
                }

                percentageTotal += percentagesBps[i];
            }

            if (percentageTotal != 10_000) {
                revert InvalidPayoutPercentages();
            }
        }

        bountyId = nextBountyId++;

        bounties[bountyId] = Bounty({
            id: bountyId,
            creator: msg.sender,
            reward: reward,
            deadline: deadline,
            status: BountyStatus.Active,
            title: title,
            description: description
        });

        winnerCount[bountyId] = _winnerCount;
        remainingReward[bountyId] = reward;

        uint256 allocated;

        for (uint256 i = 0; i < _winnerCount; i++) {
            uint256 amount;

            if (i == _winnerCount - 1) {
                // Assign rounding remainder to the final tier.
                amount = reward - allocated;
            } else if (equalSplit) {
                amount = reward / _winnerCount;
            } else {
                amount = (reward * percentagesBps[i]) / 10_000;
            }

            if (amount == 0) revert InvalidReward();

            payoutAmounts[bountyId].push(amount);
            allocated += amount;
        }

        // All validation and storage setup are atomic with the transfer.
        usdc.safeTransferFrom(msg.sender, address(this), reward);

        emit BountyCreated(
            bountyId,
            msg.sender,
            reward,
            deadline,
            title
        );

        emit WinnerCountConfigured(bountyId, _winnerCount);
    }

    /**
     * @notice Get the payout amount for each winner tier.
     */
    function getPayoutAmounts(
        uint256 bountyId
    ) external view returns (uint256[] memory) {
        if (bounties[bountyId].creator == address(0)) {
            revert BountyNotFound();
        }

        return payoutAmounts[bountyId];
    }

    /**
     * @notice Submit proof of completed work.
     */
    function submitWork(
        uint256 bountyId,
        string calldata proof
    ) external {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();

        if (bounty.status != BountyStatus.Active) {
            revert BountyNotActive();
        }

        if (block.timestamp >= bounty.deadline) {
            revert DeadlinePassed();
        }

        if (hasSubmitted[bountyId][msg.sender]) {
            revert AlreadySubmitted();
        }

        if (bytes(proof).length == 0) {
            revert InvalidDescription();
        }

        uint256 submissionId = bountySubmissions[bountyId].length;

        bountySubmissions[bountyId].push(
            Submission({
                id: submissionId,
                contributor: msg.sender,
                proof: proof,
                resolved: false
            })
        );

        hasSubmitted[bountyId][msg.sender] = true;
        unresolvedSubmissionCount[bountyId] += 1;

        emit WorkSubmitted(
            bountyId,
            submissionId,
            msg.sender
        );
    }

    /**
     * @notice Approve a submission and assign it to a payout tier.
     * @param tier Zero-based tier: 0 is first place, 1 is second place.
     *
     * The creator chooses the tier when approving each submission.
     * Each tier can be paid only once.
     */
    function approveSubmission(
        uint256 bountyId,
        uint256 submissionId,
        uint256 tier
    ) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (msg.sender != bounty.creator) revert NotCreator();

        if (bounty.status != BountyStatus.Active) {
            revert BountyNotActive();
        }

        if (tier >= winnerCount[bountyId]) {
            revert InvalidPayoutTier();
        }

        if (tierPaid[bountyId][tier]) {
            revert PayoutTierAlreadyPaid();
        }

        Submission storage submission = _getSubmission(
            bountyId,
            submissionId
        );

        if (submission.resolved) revert AlreadyResolved();

        uint256 amount = payoutAmounts[bountyId][tier];

        submission.resolved = true;
        unresolvedSubmissionCount[bountyId] -= 1;
        tierPaid[bountyId][tier] = true;
        paidWinners[bountyId] += 1;
        remainingReward[bountyId] -= amount;

        if (paidWinners[bountyId] == winnerCount[bountyId]) {
            bounty.status = BountyStatus.Completed;
        }

        usdc.safeTransfer(submission.contributor, amount);

        emit SubmissionApproved(
            bountyId,
            submissionId,
            submission.contributor,
            amount
        );

        emit WinnerPaid(
            bountyId,
            tier,
            submissionId,
            submission.contributor,
            amount
        );
    }

    /**
     * @notice Reject a submission. The bounty remains active.
     */
    function rejectSubmission(
        uint256 bountyId,
        uint256 submissionId
    ) external {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (msg.sender != bounty.creator) revert NotCreator();

        if (bounty.status != BountyStatus.Active) {
            revert BountyNotActive();
        }

        Submission storage submission = _getSubmission(
            bountyId,
            submissionId
        );

        if (submission.resolved) revert AlreadyResolved();

        submission.resolved = true;
        unresolvedSubmissionCount[bountyId] -= 1;
        hasSubmitted[bountyId][submission.contributor] = false;

        emit SubmissionRejected(
            bountyId,
            submissionId,
            submission.contributor
        );
    }

    /**
     * @notice Refund remaining escrow after the deadline.
     * @dev All submissions must be resolved before a refund is allowed.
     *      Previously paid contributors retain their rewards.
     */
    function claimRefund(
        uint256 bountyId
    ) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (msg.sender != bounty.creator) revert NotCreator();

        if (bounty.status != BountyStatus.Active) {
            revert BountyNotActive();
        }

        if (block.timestamp < bounty.deadline) {
            revert DeadlineNotPassed();
        }

        if (unresolvedSubmissionCount[bountyId] != 0) {
            revert UnresolvedSubmissions();
        }

        uint256 refund = remainingReward[bountyId];

        remainingReward[bountyId] = 0;
        bounty.status = BountyStatus.Cancelled;

        if (refund > 0) {
            usdc.safeTransfer(bounty.creator, refund);
        }

        emit BountyCancelled(
            bountyId,
            bounty.creator,
            refund
        );
    }

    /**
     * @notice Return all submissions for a bounty.
     */
    function getSubmissions(
        uint256 bountyId
    ) external view returns (Submission[] memory) {
        if (bounties[bountyId].creator == address(0)) {
            revert BountyNotFound();
        }

        return bountySubmissions[bountyId];
    }

    function _getSubmission(
        uint256 bountyId,
        uint256 submissionId
    ) internal view returns (Submission storage submission) {
        if (submissionId >= bountySubmissions[bountyId].length) {
            revert SubmissionNotFound();
        }

        submission = bountySubmissions[bountyId][submissionId];
    }
}
