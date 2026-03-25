/**
 * Decision Engine for Logicash Capital Allocation
 */

export const generateLocalScenarios = (obls, bal) => {
    const today = new Date();

    const scored = (weightConfig) => {
        return obls.map(o => {
            const due = new Date(o.due_date);
            const daysLeft = Math.max(1, Math.ceil((due - today) / 86400000));
            const urgency = 1 / daysLeft;
            
            // Penalty: highest priority if late fee exists
            const penaltyScore = o.penalty ? weightConfig.penalty : 0;
            
            // Flexibility: lower score is less negotiable
            const flexScore = o.flexibility ? 0 : weightConfig.flexibility;
            
            // Category importance
            const catScore = ['salary', 'tax', 'rent', 'loan_emi'].includes(o.category) 
                ? weightConfig.category_high 
                : (['vendor'].includes(o.category) ? weightConfig.category_med : 0);
            
            // Efficiency: paying small bills first to clear the list
            const smallBonus = o.amount < bal * 0.1 ? weightConfig.small_bonus : 0;
            
            // Critical override
            const criticalOverride = o.is_critical ? 999 : 0;

            const score = criticalOverride + penaltyScore + (urgency * weightConfig.urgency_mult) + flexScore + catScore + smallBonus;
            
            return { 
                ...o, 
                score, 
                daysLeft,
                // Display versions
                vendor_display: o.vendor?.toUpperCase() || 'UNKNOWN',
                category_display: o.category?.toUpperCase() || 'GENERAL'
            };
        }).sort((a, b) => b.score - a.score);
    };

    // Scenarios Weights
    const penaltyWeights = { penalty: 10, urgency_mult: 5, flexibility: 3, category_high: 5, category_med: 2, small_bonus: 2 };
    const relWeights = { penalty: 3, urgency_mult: 3, flexibility: 5, category_high: 3, category_med: 8, small_bonus: 3 };
    const runwayWeights = { penalty: 2, urgency_mult: 2, flexibility: 2, category_high: 8, category_med: 2, small_bonus: 10 };

    const penaltyMin = scored(penaltyWeights);
    const relationship = scored(relWeights);
    const runway = scored(runwayWeights);

    const buildPlan = (sorted) => {
        let remaining = bal;
        return sorted.map(o => {
            const isPaid = o.is_paid; // Already marked as paid in DB
            if (isPaid) return { ...o, action: 'PAID', remaining_after: remaining };
            
            const canPay = remaining >= o.amount;
            if (canPay) remaining -= o.amount;
            
            return { 
                ...o, 
                action: canPay ? 'PAY' : 'DEFER', 
                remaining_after: remaining 
            };
        });
    };

    const scenarios = {
        penalty_minimization: {
            id: 'penalty_minimization',
            name: 'PENALTY MINIMIZATION',
            description: 'PRIORITIZES OBLIGATIONS WITH LATE PENALTIES TO MINIMIZE UNNECESSARY EXPENDITURE.',
            plan: buildPlan(penaltyMin),
        },
        relationship_preservation: {
            id: 'relationship_preservation',
            name: 'RELATIONSHIP PRESERVATION',
            description: 'PROTECTS STRATEGIC VENDOR RELATIONSHIPS BY PRIORITIZING KEY PARTNER PAYMENTS.',
            plan: buildPlan(relationship),
        },
        runway_maximization: {
            id: 'runway_maximization',
            name: 'RUNWAY MAXIMIZATION',
            description: 'EXTENDS OPERATIONAL RUNWAY BY DEFERRING NON-CRITICAL CASH OUTFLOWS.',
            plan: buildPlan(runway),
        },
    };

    // Dynamically determine the best scenario
    let recommended_id = 'runway_maximization';
    const hasPenalties = obls.some(o => o.penalty);
    const hasCritical = obls.some(o => o.is_critical);
    const totalUnpaid = obls.reduce((sum, o) => sum + o.amount, 0);

    if (hasPenalties) {
        recommended_id = 'penalty_minimization';
    } else if (bal > totalUnpaid * 1.5) {
        recommended_id = 'relationship_preservation';
    } else if (hasCritical && bal >= totalUnpaid * 0.5) {
        recommended_id = 'relationship_preservation';
    }

    return { scenarios, recommended_id };
};
