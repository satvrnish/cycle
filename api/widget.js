export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');

    // Replace placeholders below with actual strings IF you aren't using Vercel Environment Variables
    const BIN_ID = process.env.JSONBIN_BIN_ID || "YOUR_ACTUAL_BIN_ID";
    const API_KEY = process.env.JSONBIN_MASTER_KEY || "YOUR_ACTUAL_MASTER_KEY";

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": API_KEY }
        });
        const data = await response.json();

        // 1. Check if JSONBin returned an error (e.g., bad API key or wrong Bin ID)
        if (!response.ok || !data.record) {
            return res.status(400).json({
                error: "JSONBin API Error",
                details: data.message || data
            });
        }

        const record = data.record;
        const loggedDates = record.dates || [];
        const phaseValues = record.values || {};
        const DEFAULT_CYCLE = 28;
        const DEFAULT_PERIOD = 5;

        // 2. Default state if no dates are logged yet
        if (loggedDates.length === 0) {
            return res.status(200).json({
                day: "Day --",
                phaseKey: "none",
                title: "No Data Logged",
                vibe: "Log a period in the web app to start tracking.",
                priorities: "",
                action: ""
            });
        }

        // 3. Cycle Calculation Logic
        const sorted = [...loggedDates].sort();
        let starts = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            if ((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000 > 2) {
                starts.push(sorted[i]);
            }
        }

        const lastStart = new Date(starts[starts.length - 1]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastStart.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((today - lastStart) / 86400000);
        let cycleDay = diffDays >= 0 
            ? (diffDays % DEFAULT_CYCLE) + 1 
            : DEFAULT_CYCLE - (Math.abs(diffDays) % DEFAULT_CYCLE) + 1;

        function getPhaseKey(day) {
            if (day <= DEFAULT_PERIOD) return (day <= 2) ? 'menstruation_1' : 'menstruation_2';
            const ovDay = DEFAULT_CYCLE - 14;
            if (day >= ovDay - 1 && day <= ovDay + 1) return 'ovulation';
            if (day > DEFAULT_PERIOD && day < ovDay - 1) {
                const mid = (DEFAULT_PERIOD + 1) + Math.floor(((ovDay - 2) - (DEFAULT_PERIOD + 1) + 1) / 2);
                return (day <= mid) ? 'follicular_1' : 'follicular_2';
            }
            if (day > ovDay + 1) {
                if (day >= DEFAULT_CYCLE - 2) return 'luteal_3';
                const focusDays = Math.ceil(((DEFAULT_CYCLE - 3) - (ovDay + 2) + 1) * 0.6);
                return (day < (ovDay + 2) + focusDays) ? 'luteal_1' : 'luteal_2';
            }
            return 'luteal_3';
        }

        const phaseKey = getPhaseKey(cycleDay);
        const currentData = phaseValues[phaseKey] || {};

        const titleMap = {
            'menstruation_1': 'Menstruation • Part 1',
            'menstruation_2': 'Menstruation • Part 2',
            'follicular_1': 'Follicular • Part 1',
            'follicular_2': 'Follicular • Part 2',
            'ovulation': 'Ovulation',
            'luteal_1': 'Luteal • Part 1',
            'luteal_2': 'Luteal • Part 2',
            'luteal_3': 'Luteal • Part 3'
        };

        return res.status(200).json({
            day: `Day ${cycleDay}`,
            dayNum: cycleDay,
            phaseKey: phaseKey,
            title: titleMap[phaseKey] || "Unknown Phase",
            vibe: currentData.vibe || "",
            priorities: currentData.priorities || "",
            action: currentData.action || ""
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
