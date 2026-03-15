const API_BASE = "/api";

async function fetchAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics/interventions`);
        if (!response.ok) throw new Error("Failed to fetch analytics");
        
        const data = await response.json();
        
        if (data.message === "No evaluated data yet") {
            showEmptyState();
            return;
        }

        renderAnalytics(data);
    } catch (error) {
        console.error("Error loading analytics:", error);
        document.getElementById('loadingState').innerHTML = `
            <p class="text-red-600 text-xl font-black">ERROR LOADING ANALYTICS DATA. PLEASE TRY AGAIN LATER.</p>
        `;
    }
}

function showEmptyState() {
    document.getElementById('loadingState').innerHTML = `
        <div class="text-indigo-950 p-10">
            <p class="text-2xl font-black uppercase">No Outcome Data Yet</p>
            <p class="text-lg font-bold text-gray-400 mt-2">Intervention outcomes are evaluated 30 days after logging. Please record actions and check back later.</p>
        </div>
    `;
}

function renderAnalytics(items) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('analyticsContent').classList.remove('hidden');

    const topItem = items[0];
    document.getElementById('top_intervention').innerText = topItem.intervention;
    document.getElementById('top_rate').innerText = `${topItem.success_rate}%`;
    
    const totalLogs = items.reduce((sum, item) => sum + item.total_logs, 0);
    document.getElementById('total_evaluated').innerText = totalLogs;

    const avgBoost = items.reduce((sum, item) => sum + item.avg_attendance_improvement, 0) / items.length;
    document.getElementById('avg_boost').innerText = `+${avgBoost.toFixed(1)}%`;

    // Strategy Insight
    const insightText = document.getElementById('strategy_insight');
    if (topItem.success_rate > 60) {
        insightText.innerText = `Strategic evidence shows that "${topItem.intervention}" is the most effective action at KMHSC, yielding a ${topItem.success_rate}% success rate. We recommend prioritizing this for high-risk students.`;
    } else {
        insightText.innerText = `Early data suggests varied results across interventions. Continue logging and monitoring outcomes to build a stronger evidence base for school policy.`;
    }

    // Table
    const tableBody = document.getElementById('analyticsTableBody');
    tableBody.innerHTML = items.map(item => `
        <tr class="border-b border-purple-50 hover:bg-purple-50/50 transition-colors">
            <td class="py-4 px-2 font-black text-indigo-950 uppercase text-sm">${item.intervention}</td>
            <td class="py-4 px-2 font-black text-emerald-600">${Math.round(item.success_rate)}%</td>
            <td class="py-4 px-2 font-bold text-rose-600">${item.avg_attendance_improvement >= 0 ? '+' : ''}${item.avg_attendance_improvement.toFixed(1)}%</td>
            <td class="py-4 px-2 font-bold text-gray-500">${item.total_logs} logs</td>
        </tr>
    `).join('');

    // Chart
    const ctx = document.getElementById('successChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: items.map(i => i.intervention),
            datasets: [{
                label: 'Success Rate (%)',
                data: items.map(i => i.success_rate),
                backgroundColor: '#4f46e5',
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: '#f3f4f6' },
                    ticks: { font: { weight: 'bold' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { weight: 'black', size: 10 } }
                }
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", fetchAnalytics);
