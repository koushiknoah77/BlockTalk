[dotenv@17.2.3] injecting env (4) from .env -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops
// Sources flattened with hardhat v3.0.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/WalletInsights.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.19;

contract WalletInsights {
    event InsightLogged(address indexed user, string query, string answer, uint256 timestamp);

    struct Insight {
        address user;
        string query;
        string answer;
        uint256 timestamp;
    }

    Insight[] public insights;

    function logInsight(string calldata query, string calldata answer) external {
        insights.push(Insight({
            user: msg.sender,
            query: query,
            answer: answer,
            timestamp: block.timestamp
        }));

        emit InsightLogged(msg.sender, query, answer, block.timestamp);
    }

    function getInsight(uint256 index) external view returns (Insight memory) {
        require(index < insights.length, "Invalid index");
        return insights[index];
    }

    function getAllInsights() external view returns (Insight[] memory) {
        return insights;
    }

    function getInsightsCount() external view returns (uint256) {
        return insights.length;
    }
}

