const API_BASE = "/api";

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
            alert("Student data uploaded and processed successfully!");
            // Open student list in a new window/tab as requested
            window.open("students.html", "_blank");
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

async function loadAnalyticsPreview() {
    const container = document.getElementById("analyticsContainer");
    if (!container) return;
    
    try {
        const response = await fetch(`${API_BASE}/analytics/interventions`);
        if (!response.ok) throw new Error("Failed");
        const data = await response.json();
        
        if (!data || data.length === 0 || data.message === "No evaluated data yet") {
            container.innerHTML = "No outcome data yet. Check back later.";
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
                    <span class="font-bold text-indigo-700 text-sm">${top.success_rate}%</span>
                </div>
                <div class="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
                    <span class="font-black text-rose-900 uppercase text-xs">Avg Boost:</span>
                    <span class="font-bold text-rose-700 text-sm">+${top.avg_attendance_improvement}%</span>
                </div>
                <a href="analytics.html" class="mt-4 block text-center text-[10px] font-black tracking-widest text-indigo-600 hover:text-indigo-800 uppercase underline">View Full View &rarr;</a>
            </div>
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = "Failed to load analytics preview.";
    }
}
function loadGeneralInterventions() {
    const container = document.getElementById("playbookContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="text-left space-y-3">
            <div class="bg-red-50 p-3 rounded border border-red-100">
                <div class="font-bold text-red-700 text-xs uppercase">High Risk</div>
                <ul class="text-sm mt-1 list-disc ml-4">
                    <li>Parent–Teacher Meeting</li>
                    <li>Attendance Monitoring</li>
                    <li>Academic Counseling</li>
                </ul>
            </div>

            <div class="bg-yellow-50 p-3 rounded border border-yellow-100">
                <div class="font-bold text-yellow-700 text-xs uppercase">Medium Risk</div>
                <ul class="text-sm mt-1 list-disc ml-4">
                    <li>Peer Mentoring</li>
                    <li>Extra Tutoring</li>
                    <li>Weekly Progress Tracking</li>
                </ul>
            </div>

            <div class="bg-green-50 p-3 rounded border border-green-100">
                <div class="font-bold text-green-700 text-xs uppercase">Low Risk</div>
                <ul class="text-sm mt-1 list-disc ml-4">
                    <li>Skill Development Programs</li>
                    <li>Scholarship Awareness</li>
                    <li>Career Guidance</li>
                </ul>
            </div>
        </div>
    `;
}
document.addEventListener("DOMContentLoaded", function(){
    loadAnalyticsPreview();
    loadGeneralInterventions();
    const buttons = document.querySelectorAll("button");
    
    buttons.forEach(btn => {
        const text = btn.innerText.trim();
        
        if (text.includes("UPLOAD DATA") || btn.id === "uploadDataBtn") {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                uploadData();
            });
        }
        
        if (text.includes("Parent Meeting")) {
             btn.addEventListener("click", (e) => {
                e.preventDefault();
                generateMessage();
            });
        }

        if (text.includes("Scholarship Portal") || text.includes("Scheme")) {
             btn.addEventListener("click", (e) => {
                e.preventDefault();
                checkSchemes();
            });
        }
    });
});
