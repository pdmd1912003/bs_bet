import React from "react";

interface UserProfileProps {
    userPoints: number;
    fixedBetAmount: number;
    isProfileInitialized: boolean; // New prop to indicate if the on-chain profile exists
}

const UserProfile: React.FC<UserProfileProps> = ({
    userPoints,
    fixedBetAmount,
    isProfileInitialized,
}) => {
    const displayPoints = isProfileInitialized ? userPoints : 0;

    return (
        <div className="bg-gray-800 rounded-xl shadow p-4 w-full flex flex-col items-center border border-gray-700">
        <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 text-2xl">🏆</span>
            <span className="text-lg font-semibold text-gray-200">Your Points</span>
        </div>
        <div className="text-4xl font-extrabold text-green-400 mb-2">
            {displayPoints.toLocaleString("en-US")}
        </div>

        {!isProfileInitialized && (
            <div className="text-xs text-gray-400 mb-2 italic text-center">
                Initialize your profile first to activate 1000 points for betting.
            </div>
        )}

        <div className="w-full border-t border-gray-700 my-2"></div>

        <div className="flex items-center gap-2 text-blue-300 text-base mb-1">
            <span className="text-xl">⏱️</span>
            <span>
                All bets: <span className="font-bold text-white">1 minute</span>
            </span>
        </div>
        <div className="flex items-center gap-2 text-yellow-300 text-base">
            <span className="text-xl">💰</span>
            <span>
                Fixed: <span className="font-bold text-white">{fixedBetAmount.toLocaleString()} points</span>
            </span>
        </div>
        </div>
    );
};

export default UserProfile;