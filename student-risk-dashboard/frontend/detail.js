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
        renderDetail(data);
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

    // interventions section
    setupInterventionSection(data.interventions || []);
}

// ---------------------------------------------------------------------------
// intervention helper methods
// ---------------------------------------------------------------------------

async function fetchInterventionLibrary() {
    try {
        const res = await fetch(`${API_BASE}/interventions/library`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.error("failed to fetch intervention library", e);
    }
    return [];
}

function populateInterventionDropdown(library) {
    const select = document.getElementById('interventionType');
    select.innerHTML = library.map(item => `<option value="${item.name}">${item.name}</option>`).join('');
}

function setupInterventionSection(interventions) {
    // fill the dropdown using library data
    fetchInterventionLibrary().then(populateInterventionDropdown);

    // default date to today
    const dateInput = document.getElementById('interventionDate');
    if (dateInput) {
        const today = new Date().toISOString().slice(0,10);
        dateInput.value = today;
    }

    document.getElementById('saveInterventionBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await submitIntervention();
    });

    renderInterventions(interventions);
}

async function submitIntervention() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    const payload = {
        date: document.getElementById('interventionDate').value,
        intervention_type: document.getElementById('interventionType').value,
        teacher_name: document.getElementById('teacherName').value,
        notes: document.getElementById('interventionNotes').value,
    };

    try {
        const resp = await fetch(`${API_BASE}/students/${studentId}/interventions`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('failed to save');
        // refresh details to show new intervention
        await fetchStudentDetails();
        // clear notes field
        document.getElementById('interventionNotes').value = '';
    } catch (err) {
        console.error('error logging intervention', err);
        alert('Could not log intervention; please try again.');
    }
}

function renderInterventions(list) {
    const body = document.getElementById('interventionTableBody');
    if (!body) return;

    body.innerHTML = list.map(inv => {
        const baseStr = `${inv.baseline_attendance_pct || '-'}% / ${inv.baseline_exam_score || '-'} / ${inv.baseline_risk_score || '-'} `;
        let outcome = '';
        if (inv.evaluated) {
            const parts = [];
            if (inv.attendance_status) parts.push(`Att: ${inv.attendance_status}`);
            if (inv.score_status) parts.push(`Score: ${inv.score_status}`);
            if (inv.risk_status) parts.push(`Risk: ${inv.risk_status}`);
            outcome = parts.join(', ');
        } else {
            outcome = inv.days_until_evaluation ? `Pending (${inv.days_until_evaluation}d)` : 'Pending';
        }
        return `
            <tr class="border-b border-indigo-50 hover:bg-indigo-50/50 transition-colors">
                <td class="py-2 px-2 text-sm">${inv.date}</td>
                <td class="py-2 px-2 text-sm font-bold">${inv.intervention_type || ''}</td>
                <td class="py-2 px-2 text-sm">${inv.teacher_name || ''}</td>
                <td class="py-2 px-2 text-sm">${baseStr}</td>
                <td class="py-2 px-2 text-sm">${outcome}</td>
            </tr>
        `;
    }).join('');
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
