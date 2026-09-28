const DAILY_WORKOUT_XP = 20;

const STREAK_REWARDS: Record<number, number> = {
    3: 50,
    7: 150,
    30: 500,
    100: 2000,
};

function createId() {
    return crypto.randomUUID();
}

export async function awardWorkoutRewards(
    db: D1Database,
    userId: string,
    workoutSessionId: string,
    currentStreak: number,
) {
    const rewards: {
        type: string;
        xp: number;
        streak?: number;
    }[] = [];

    /*
     * Daily workout XP
     */
    const workoutReward = await db
        .prepare(
            `
            INSERT OR IGNORE INTO reward_events
                (id, user_id, event_key, event_type, xp)
            VALUES (?, ?, ?, ?, ?)
            `,
        )
        .bind(
            createId(),
            userId,
            `workout:${workoutSessionId}`,
            "workout_completed",
            DAILY_WORKOUT_XP,
        )
        .run();

    if (workoutReward.meta.changes > 0) {
        rewards.push({
            type: "workout_completed",
            xp: DAILY_WORKOUT_XP,
        });
    }

    /*
     * Streak milestone bonus
     */
    const milestoneXp = STREAK_REWARDS[currentStreak];

    if (milestoneXp) {
        const streakReward = await db
            .prepare(
                `
                INSERT OR IGNORE INTO reward_events
                    (id, user_id, event_key, event_type, xp)
                VALUES (?, ?, ?, ?, ?)
                `,
            )
            .bind(
                createId(),
                userId,
                `streak:${currentStreak}`,
                "streak_milestone",
                milestoneXp,
            )
            .run();

        if (streakReward.meta.changes > 0) {
            rewards.push({
                type: "streak_milestone",
                xp: milestoneXp,
                streak: currentStreak,
            });
        }
    }

    return {
        totalXpEarned: rewards.reduce(
            (total, reward) => total + reward.xp,
            0,
        ),
        rewards,
    };
}
