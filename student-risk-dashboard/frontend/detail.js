const API_BASE = "/api";

async function fetchStudentDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');

    if (!studentId) {
        alert("Student ID missing in URL.");
        window.location.href = "students.html";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/students/${studentId}`);
        if (!response.ok) throw new Error("Failed to fetch student details");
        
        const data = await response.json();
        if (data.student) {
            renderDetail(data);
            fetchInterventions(studentId);
            fetchSchemes(studentId);
        }
    } catch (error) {
        console.error("Error fetching details:", error);
        document.getElementById('loadingState').innerHTML = `
            <p class="text-red-600 text-xl font-black">ERROR LOADING STUDENT DATA. PLEASE TRY AGAIN LATER.</p>
        `;
    }
}

function renderDetail(data) {
    const student = data.student;
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('studentDetail').classList.remove('hidden');

    document.getElementById('disp_name').innerText = student.name;
    document.getElementById('disp_id').innerText = student.student_id;
    document.getElementById('disp_grade').innerText = student.grade_class;
    
    document.getElementById('disp_attendance').innerText = `${student.attendance_pct}%`;
    document.getElementById('disp_latest').innerText = student.latest_exam_score;
    document.getElementById('disp_previous').innerText = student.previous_exam_score;
    document.getElementById('disp_distance').innerText = `${student.distance_km} KM`;

    document.getElementById('disp_level').innerText = student.risk_level;
    document.getElementById('disp_score').innerText = `${student.risk_score}/100`;

    // Meal Participation UI
    const mealPct = student.meal_participation_pct || 0;
    document.getElementById('disp_meal_pct').innerText = `${mealPct}%`;
    const circle = document.getElementById('meal_circle');
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (mealPct / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    const mealLabel = document.getElementById('meal_status_label');
    if (mealPct < 50) {
        mealLabel.innerText = "🔴 Low Engagement";
        mealLabel.className = "mt-4 text-[10px] font-black uppercase text-red-600 tracking-widest";
    } else if (mealPct < 80) {
        mealLabel.innerText = "🟡 Moderate Engagement";
        mealLabel.className = "mt-4 text-[10px] font-black uppercase text-yellow-600 tracking-widest";
    } else {
        mealLabel.innerText = "🟢 High Engagement";
        mealLabel.className = "mt-4 text-[10px] font-black uppercase text-green-600 tracking-widest";
    }

    const riskBox = document.getElementById('risk_color_box');
    if (student.risk_level === 'High') {
        riskBox.className = 'md:col-span-1 p-8 rounded-2xl shadow-2xl border-l-[12px] border-red-900 bg-gradient-to-r from-red-600 to-red-500 flex flex-col justify-center text-white';
    } else if (student.risk_level === 'Medium') {
        riskBox.className = 'md:col-span-1 p-8 rounded-2xl shadow-2xl border-l-[12px] border-yellow-700 bg-gradient-to-r from-yellow-500 to-yellow-400 flex flex-col justify-center text-white';
    } else {
        riskBox.className = 'md:col-span-1 p-8 rounded-2xl shadow-2xl border-l-[12px] border-green-900 bg-gradient-to-r from-green-600 to-green-500 flex flex-col justify-center text-white';
    }

    // RISK ALERT LOGIC
    const riskAlert = document.getElementById('riskAlert');
    const alertContainer = document.getElementById('alertContainer');
    const alertHeading = document.getElementById('alertHeading');
    const alertMessage = document.getElementById('alertMessage');
    const alertIcon = document.getElementById('alertIcon');

    if (student.risk_level === 'High') {
        riskAlert.classList.remove('hidden');
        alertContainer.className = "flex items-center gap-4 p-5 rounded-2xl border-red-900/50 bg-gradient-to-r from-red-600 to-red-800 text-white shadow-xl animate-pulse";
        alertHeading.innerText = "HIGH RISK ALERT: URGENT ATTENTION REQUIRED";
        alertMessage.innerText = `Detailed analysis indicates that ${student.name} is currently at a critical risk level. Please review the AI explanation and consider immediate intervention.`;
        alertIcon.innerText = "🚨";
    } else if (student.risk_level === 'Medium') {
        riskAlert.classList.remove('hidden');
        alertContainer.className = "flex items-center gap-4 p-5 rounded-2xl border-yellow-700/50 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-xl";
        alertHeading.innerText = "MEDIUM RISK NOTICE: PROACTIVE SUPPORT RECOMMENDED";
        alertMessage.innerText = `${student.name} shows signs of potential challenges. A timely discussion with parents could help prevent further escalation.`;
        alertIcon.innerText = "⚠️";
    } else {
        riskAlert.classList.add('hidden');
    }

    const explanationText = document.getElementById('disp_explanation');
    const container = document.getElementById('llm_explanation_container');
    const noExplanation = document.getElementById('no_explanation');
    const parentCommSection = document.getElementById('parentCommSection');

    if (student.risk_level === 'Medium' || student.risk_level === 'High') {
        explanationText.innerText = student.llm_explanation || "No AI explanation available at this time.";
        container.classList.remove('hidden');
        noExplanation.classList.add('hidden');
        parentCommSection.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        noExplanation.classList.remove('hidden');
        parentCommSection.classList.add('hidden');
    }

    if (data.comparison) {
        renderComparison(data.comparison);
    }

    if (data.interventions) {
        renderInterventionHistory(data.interventions);
    }
}

function renderInterventionHistory(interventions) {
    const tableBody = document.getElementById('interventionHistoryBody');
    if (!interventions || interventions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-gray-400 font-bold italic">No interventions recorded for this student.</td></tr>`;
        return;
    }

    tableBody.innerHTML = interventions.map(inv => {
        let outcomeBadge = '<span class="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black uppercase">Pending</span>';
        if (inv.is_evaluated) {
            const color = inv.outcome_status === 'Improved' ? 'bg-green-100 text-green-700' : 
                         (inv.outcome_status === 'Declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700');
            outcomeBadge = `<span class="px-3 py-1 ${color} rounded-lg text-[10px] font-black uppercase">${inv.outcome_status}</span>`;
        }

        const baselineInfo = `
            <div class="text-[10px] space-y-0.5">
                <p class="font-bold text-gray-500">ATT: <span class="text-indigo-900">${inv.baseline_attendance ?? '-'}%</span></p>
                <p class="font-bold text-gray-500">SCORE: <span class="text-indigo-900">${inv.baseline_score ?? '-'}</span></p>
                <p class="font-bold text-gray-500">RISK: <span class="text-indigo-900">${inv.baseline_risk_score ?? '-'}/100</span></p>
            </div>
        `;

        const evolutionInfo = inv.is_evaluated ? `
            <div class="text-[10px] space-y-0.5">
                <p class="font-bold text-gray-500">ATT: <span class="${(inv.outcome_attendance > inv.baseline_attendance) ? 'text-green-600' : 'text-red-500'} font-black">${inv.outcome_attendance}%</span></p>
                <p class="font-bold text-gray-500">SCORE: <span class="${(inv.outcome_score > inv.baseline_score) ? 'text-green-600' : 'text-red-500'} font-black">${inv.outcome_score}</span></p>
                <p class="font-bold text-gray-500">RISK: <span class="${(inv.outcome_risk_score < inv.baseline_risk_score) ? 'text-green-600' : 'text-red-500'} font-black">${inv.outcome_risk_score}/100</span></p>
            </div>
        ` : '<span class="text-[10px] font-bold text-gray-300 italic">Waiting for 30-day data...</span>';

        return `
            <tr class="border-b border-indigo-50 hover:bg-gray-50 transition-colors">
                <td class="py-4 px-2">
                    <p class="text-xs font-black text-indigo-950 uppercase">${inv.action}</p>
                    <p class="text-[10px] font-bold text-gray-400 mt-0.5">${inv.date} • By ${inv.teacher_name || 'System'}</p>
                    <p class="text-[10px] italic text-gray-500 mt-1 line-clamp-1" title="${inv.notes || ''}">${inv.notes || 'No notes.'}</p>
                </td>
                <td class="py-4 px-2">${baselineInfo}</td>
                <td class="py-4 px-2">${evolutionInfo}</td>
                <td class="py-4 px-2 text-center">${outcomeBadge}</td>
            </tr>
        `;
    }).join('');
}

function openInterventionModal() {
    const modal = document.getElementById('interventionModal');
    modal.classList.remove('hidden');
    
    // Set baselines in modal for confirmation
    document.getElementById('modal_att').innerText = document.getElementById('disp_attendance').innerText;
    document.getElementById('modal_risk').innerText = document.getElementById('disp_score').innerText;
    document.getElementById('modal_exam').innerText = document.getElementById('disp_latest').innerText;
}

function closeInterventionModal() {
    document.getElementById('interventionModal').classList.add('hidden');
    document.getElementById('interventionForm').reset();
}

async function submitIntervention(event) {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    
    const payload = {
        date: new Date().toISOString().split('T')[0],
        action: document.getElementById('inv_type').value,
        teacher_name: document.getElementById('teacher_name').value,
        notes: document.getElementById('inv_notes').value
    };

    try {
        const response = await fetch(`${API_BASE}/students/${studentId}/interventions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Failed to log intervention");
        
        alert("Intervention logged successfully! Baseline metrics captured.");
        closeInterventionModal();
        fetchStudentDetails(); // Refresh list
    } catch (error) {
        console.error("Error logging intervention:", error);
        alert("Error saving intervention. Please try again.");
    }
}

function renderComparison(comparison) {
    const tableBody = document.getElementById('comparisonTableBody');
    const { metrics, student, class_avg, benchmarks } = comparison;

    tableBody.innerHTML = metrics.map((metric, i) => {
        const sVal = student[i];
        const cVal = class_avg[i];
        const bVal = benchmarks[i];
        
        // Logical Indicator
        let indicator = "🔴";
        if (metric === 'Distance') {
            if (sVal <= bVal) indicator = "🟢";
            else if (sVal <= cVal) indicator = "🟡";
        } else {
            if (sVal >= bVal) indicator = "🟢";
            else if (sVal >= cVal) indicator = "🟡";
        }

        const unit = metric === 'Attendance' ? '%' : (metric === 'Distance' ? ' km' : '');

        return `
            <tr class="border-b border-indigo-50 hover:bg-indigo-50/50 transition-colors">
                <td class="py-4 px-2 font-bold text-gray-500 text-xs uppercase italic">${metric}</td>
                <td class="py-4 px-2 font-black text-indigo-950">${indicator} ${sVal}${unit}</td>
                <td class="py-4 px-2 font-bold text-gray-600">${cVal}${unit}</td>
                <td class="py-4 px-2 font-bold text-green-700">${bVal}${unit}</td>
            </tr>
        `;
    }).join('');

    // Chart.js Visualization
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    // Destroy existing chart if any (to prevent overlap on re-renders)
    if (window.myComparisonChart) {
        window.myComparisonChart.destroy();
    }

    window.myComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: metrics,
            datasets: [
                {
                    label: 'Student',
                    data: student,
                    backgroundColor: '#4f46e5', // Indigo-600
                    borderRadius: 6
                },
                {
                    label: 'Class Avg',
                    data: class_avg,
                    backgroundColor: '#94a3b8', // Slate-400
                    borderRadius: 6
                },
                {
                    label: 'Successful Benchmark',
                    data: benchmarks,
                    backgroundColor: '#10b981', // Emerald-500
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { weight: 'bold', size: 10 },
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { font: { weight: 'bold' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { weight: 'black' } }
                }
            }
        }
    });
}

async function generateParentComm() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    const language = document.getElementById('commLanguage').value;
    
    const loading = document.getElementById('commLoading');
    const outputContainer = document.getElementById('commOutputContainer');
    const outputTextarea = document.getElementById('commOutput');
    const generateBtn = document.getElementById('generateBtn');

    loading.classList.remove('hidden');
    outputContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generateBtn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        const response = await fetch(`${API_BASE}/students/${studentId}/parent-communication?language=${language}`);
        if (!response.ok) throw new Error("Failed to generate communication");
        
        const data = await response.json();
        outputTextarea.value = data.message;
        outputContainer.classList.remove('hidden');
        outputTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
        console.error("Error generating communication:", error);
        alert("Could not generate communication draft. Please try again later.");
    } finally {
        loading.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

async function fetchInterventions(id) {
    const container = document.getElementById('interventions_container');
    try {
        const response = await fetch(`${API_BASE}/interventions/${id}`);
        const data = await response.json();
        
        if (!data.interventions || data.interventions.length === 0) {
            container.innerHTML = `<p class="text-gray-500 font-bold italic">No urgent interventions required for this risk level.</p>`;
            return;
        }

        container.innerHTML = data.interventions.map(intv => `
            <div class="flex items-start gap-4 p-4 rounded-xl bg-rose-50 border-l-4 border-rose-500 hover:shadow-md transition-all">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-sm">
                    ${intv.rank}
                </div>
                <div>
                    <h3 class="font-black text-rose-950 uppercase text-sm">${intv.type}</h3>
                    <p class="text-xs text-rose-800 font-bold leading-tight mt-1">${intv.reason}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error fetching interventions:", error);
        container.innerHTML = `<p class="text-red-500 font-bold">Failed to load recommendations.</p>`;
    }
}

async function fetchSchemes(id) {
    const container = document.getElementById('schemes_container');
    try {
        const response = await fetch(`${API_BASE}/schemes/${id}`);
        const data = await response.json();
        
        if (!data.eligible_schemes || data.eligible_schemes.length === 0) {
            container.innerHTML = `<p class="text-gray-500 font-bold italic">No matching government schemes found.</p>`;
            return;
        }

        container.innerHTML = data.eligible_schemes.map(scheme => `
            <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-100 hover:border-emerald-300 transition-all">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-emerald-600 font-black text-lg">🔗</span>
                    <h3 class="font-black text-emerald-950 uppercase text-sm">${scheme.scheme}</h3>
                </div>
                <p class="text-xs text-emerald-800 font-bold leading-tight ml-7">${scheme.reason}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error fetching schemes:", error);
        container.innerHTML = `<p class="text-red-500 font-bold">Failed to load scheme matches.</p>`;
    }
}

function copyToClipboard() {
    const textarea = document.getElementById('commOutput');
    textarea.select();
    document.execCommand('copy');
    
    const copyBtn = event.currentTarget;
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span>✅</span> COPIED!';
    copyBtn.classList.replace('bg-indigo-600', 'bg-green-600');
    
    setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.replace('bg-green-600', 'bg-indigo-600');
    }, 2000);
}

document.addEventListener("DOMContentLoaded", fetchStudentDetails);
