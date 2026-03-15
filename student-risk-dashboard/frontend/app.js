const API_BASE = "/api";
let riskChart = null;

function uploadData() {
    const fileInput = document.getElementById("csvFileInput");
    const file = fileInput.files[0];
    
    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const uploadBtn = document.getElementById("uploadDataBtn");
    if (uploadBtn) {
        uploadBtn.innerText = "UPLOADING...";
        uploadBtn.disabled = true;
    }

    fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (res.ok) {
            alert("Student data uploaded and processed successfully! The dashboard will refresh in 2 seconds.");
            setTimeout(() => location.reload(), 2000);
        } else {
            return res.json().then(data => {
                alert("Upload failed: " + (data.detail || "Unknown error"));
            });
        }
    })
    .catch(err => {
        console.error("Upload error:", err);
        alert("Connection failed. Is the server running?");
    })
    .finally(() => {
        if (uploadBtn) {
            uploadBtn.innerText = "UPLOAD DATA";
            uploadBtn.disabled = false;
        }
    });
}

function generateMessage() {
    let message = "Dear Parent, your child has been identified as needing additional academic support. Please contact the school for counseling and assistance.";
    const textarea = document.querySelector("textarea");
    if (textarea) {
        textarea.value = message;
    }
}

function checkSchemes() {
    alert("Checking eligible government schemes for the student...");
}

async function loadRiskStats() {
    console.log("DEBUG: loadRiskStats() called");
    try {
        const response = await fetch(`${API_BASE}/students`);
        if (!response.ok) throw new Error("Failed to fetch students");
        const students = await response.json();
        
        let high = 0, med = 0, low = 0;
        students.forEach(s => {
            if (s.risk_level === 'High') high++;
            else if (s.risk_level === 'Medium') med++;
            else if (s.risk_level === 'Low') low++;
        });

        const hEl = document.getElementById("highRiskCount");
        const mEl = document.getElementById("medRiskCount");
        const lEl = document.getElementById("lowRiskCount");
        
        if (hEl) hEl.innerText = Math.round(high);
        if (mEl) mEl.innerText = Math.round(med);
        if (lEl) lEl.innerText = Math.round(low);

        updateRiskChart(high, med, low);
        updatePlaybookCounts(high, med, low);
        updateAlerts(students);

    } catch (err) {
        console.error("DEBUG: loadRiskStats error:", err);
    }
}

function updateRiskChart(high, med, low) {
    const ctx = document.getElementById('riskChart');
    if (!ctx) return;

    if (riskChart) {
        riskChart.data.datasets[0].data = [high, med, low];
        riskChart.update();
    } else {
        riskChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['High Risk', 'Medium Risk', 'Low Risk'],
                datasets: [{
                    data: [high, med, low],
                    backgroundColor: ['#dc2626', '#eab308', '#16a34a'],
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 12, weight: 'bold' },
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
}

function updatePlaybookCounts(high, med, low) {
    const hBadge = document.getElementById("highCountBadge");
    const mBadge = document.getElementById("medCountBadge");
    const lBadge = document.getElementById("lowCountBadge");

    if (hBadge) hBadge.innerText = `${high} Students`;
    if (mBadge) mBadge.innerText = `${med} Students`;
    if (lBadge) lBadge.innerText = `${low} Students`;
}

function updateAlerts(students) {
    const container = document.getElementById("alertsContainer");
    if (!container) return;

    const alerts = students
        .filter(s => s.risk_level === 'High')
        .slice(0, 4);

    if (alerts.length === 0) {
        container.innerHTML = `<li class="bg-green-50 border-l-4 border-green-600 p-4 rounded-lg text-sm">No critical risk students detected.</li>`;
        return;
    }

    container.innerHTML = alerts.map(s => {
        let trigger = "Requires immediate attention";
        if (s.attendance_pct < 75) trigger = `Critical attendance drop: ${s.attendance_pct.toFixed(1)}%`;
        else if (s.latest_exam_score < 50) trigger = `Low academic performance: ${s.latest_exam_score.toFixed(1)}%`;
        else if (s.sibling_dropout) trigger = "Family history of dropout detected";
        else if (s.top_factors) trigger = `Primary risk: ${s.top_factors.split(',')[0]}`;

        return `
            <li class="bg-red-50 border-l-4 border-red-600 p-4 rounded-lg flex justify-between items-center group transition-all hover:bg-red-100">
                <div>
                    <span class="text-red-900 font-extrabold text-sm uppercase tracking-tight">${s.name}</span>
                    <p class="text-[11px] text-red-700 font-bold uppercase mt-0.5 tracking-tight">${trigger}</p>
                </div>
                <a href="student-detail.html?id=${s.id}" class="text-[10px] bg-red-600 text-white px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity uppercase font-black shadow-lg">View &rarr;</a>
            </li>
        `;
    }).join('');
}

async function loadAnalyticsPreview() {
    const container = document.getElementById("analyticsContainer");
    if (!container) return;
    
    try {
        const response = await fetch(`${API_BASE}/analytics/interventions`);
        if (!response.ok) throw new Error("Failed to fetch analytics");
        const data = await response.json();
        
        if (!data || data.length === 0 || data.message === "No evaluated data yet") {
            container.innerHTML = `<p class="italic text-gray-400">No outcome data yet. Check back later.</p>`;
            return;
        }
        
        const top = data[0];
        container.innerHTML = `
            <div class="flex flex-col gap-2 text-left">
                <div class="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
                    <span class="font-black text-green-900 uppercase text-xs">Top Action:</span>
                    <span class="font-bold text-green-700 text-sm">${top.intervention}</span>
                </div>
                <div class="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <span class="font-black text-indigo-900 uppercase text-xs">Success Rate:</span>
                    <span class="font-bold text-indigo-700 text-sm">${Math.round(top.success_rate)}%</span>
                </div>
                <div class="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
                    <span class="font-black text-rose-900 uppercase text-xs">Avg Boost:</span>
                    <span class="font-bold text-rose-700 text-sm">${top.avg_attendance_improvement >= 0 ? '+' : ''}${top.avg_attendance_improvement.toFixed(1)}%</span>
                </div>
                <a href="analytics.html" class="mt-4 block text-center text-[10px] font-black tracking-widest text-indigo-600 hover:text-indigo-800 uppercase underline">View Full Analytics &rarr;</a>
            </div>
        `;
    } catch (err) {
        console.error("DEBUG: loadAnalyticsPreview error:", err);
        container.innerHTML = `<p class="text-red-500 font-bold">Failed to load analytics preview.</p>`;
    }
}

function loadGeneralInterventions() {
    const container = document.getElementById("playbookContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="text-left space-y-4">
            <div class="bg-red-100 p-4 rounded-xl border-l-8 border-red-600 shadow-md text-gray-900">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-black text-red-700 text-sm uppercase">🔴 High Risk</div>
                    <span id="highCountBadge" class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">-- Students</span>
                </div>
                <ul class="text-xs list-disc ml-5 font-bold text-gray-700">
                    <li>Immediate Parent–Teacher Meeting</li>
                    <li>Daily Attendance Monitoring</li>
                    <li>One-on-One Academic Counseling</li>
                </ul>
            </div>
            <div class="bg-yellow-100 p-4 rounded-xl border-l-8 border-yellow-600 shadow-md text-gray-900">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-black text-yellow-700 text-sm uppercase">🟡 Medium Risk</div>
                    <span id="medCountBadge" class="bg-yellow-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">-- Students</span>
                </div>
                <ul class="text-xs list-disc ml-5 font-bold text-gray-700">
                    <li>Peer Mentoring Program</li>
                    <li>Extra After-School Tutoring</li>
                    <li>Weekly Progress Tracking</li>
                </ul>
            </div>
            <div class="bg-green-100 p-4 rounded-xl border-l-8 border-green-600 shadow-md text-gray-900">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-black text-green-700 text-sm uppercase">🟢 Low Risk</div>
                    <span id="lowCountBadge" class="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">-- Students</span>
                </div>
                <ul class="text-xs list-disc ml-5 font-bold text-gray-700">
                    <li>Skill Development Workshops</li>
                    <li>Scholarship Awareness</li>
                    <li>Career Guidance Session</li>
                </ul>
            </div>
        </div>
    `;
}

function init() {
    console.log("DEBUG: Initializing app...");
    loadRiskStats();
    loadAnalyticsPreview();
    loadGeneralInterventions();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
