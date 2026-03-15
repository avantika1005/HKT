const API_BASE = "/api";

let currentStudents = [];
let filteredStudents = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 250;
let sortConfig = { key: null, direction: 'asc' };

async function fetchStudents() {
    console.log("Fetching students...");
    try {
        const response = await fetch(`${API_BASE}/students`);
        if (!response.ok) throw new Error("Failed to fetch students");
        
        currentStudents = await response.json();
        filteredStudents = [...currentStudents];
        console.log("Received students:", currentStudents.length);
        renderStudents();
    } catch (error) {
        console.error("Error fetching students:", error);
        document.getElementById('studentTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-red-600 font-bold">
                    Error loading data. Is the backend server running?
                </td>
            </tr>
        `;
    }
}

function handleSortChange(value) {
    console.log("Sort changed to:", value);
    if (!value) return;
    
    // Split on last underscore to support keys with underscores like 'student_id'
    const lastUnderscore = value.lastIndexOf('_');
    const key = value.substring(0, lastUnderscore);
    const direction = value.substring(lastUnderscore + 1);
    
    sortStudents(key, direction);
}

function sortStudents(key, direction) {
    console.log(`Sorting by ${key} in ${direction} order`);
    sortConfig.key = key;
    sortConfig.direction = direction;

    if (!currentStudents || currentStudents.length === 0) {
        console.warn("No students to sort");
        return;
    }

    const sortedData = [...currentStudents].sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];

        // Handle Risk Level sorting (High > Medium > Low)
        if (key === 'risk_level') {
            const priority = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'N/A': 0 };
            const aLevel = (aVal || '').toUpperCase();
            const bLevel = (bVal || '').toUpperCase();
            aVal = priority[aLevel] || 0;
            bVal = priority[bLevel] || 0;
        } else if (key === 'risk_score' || key === 'attendance_pct' || key === 'latest_exam_score') {
            // Numeric comparison
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else {
            // String comparison
            aVal = (aVal || '').toString().toLowerCase();
            bVal = (bVal || '').toString().toLowerCase();
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    filteredStudents = sortedData;
    currentPage = 1;
    renderStudents();
}

function renderStudents() {
    console.log("Rendering block of students");
    const tableBody = document.getElementById('studentTableBody');
    
    if (!filteredStudents || filteredStudents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-gray-400 font-bold italic">
                    No students found. Please upload a CSV file first.
                </td>
            </tr>
        `;
        return;
    }

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    tableBody.innerHTML = paginatedStudents.map(student => {
        let riskClass = "bg-green-100 text-green-700 border-green-200";
        const level = (student.risk_level || 'N/A').toUpperCase();
        
        if (level === "HIGH") riskClass = "bg-red-100 text-red-700 border-red-200";
        else if (level === "MEDIUM") riskClass = "bg-yellow-100 text-yellow-700 border-yellow-200";

        return `
            <tr class="hover:bg-purple-50/50 transition-all group border-b border-purple-50">
                <td class="py-5 px-6 font-bold text-gray-500 text-sm">#${student.student_id}</td>
                <td class="py-5 px-6">
                    <div class="font-black text-purple-950 uppercase tracking-tight">${student.name}</div>
                </td>
                <td class="py-5 px-6 font-bold text-gray-600 text-sm">${student.grade_class}</td>
                <td class="py-5 px-6">
                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase border ${riskClass}">
                        ${level}
                    </span>
                </td>
                <td class="py-5 px-6">
                    <div class="flex items-center gap-2">
                        <div class="w-12 bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div class="bg-purple-600 h-full" style="width: ${Math.round(student.risk_score || 0)}%"></div>
                        </div>
                        <span class="font-black text-purple-900 text-sm">${Math.round(student.risk_score || 0)}%</span>
                    </div>
                </td>
                <td class="py-5 px-6 text-center">
                    <a href="student-detail.html?id=${student.id}" 
                       class="bg-white border-2 border-purple-900 text-purple-900 px-4 py-2 rounded-xl font-black text-xs hover:bg-purple-900 hover:text-white transform hover:scale-105 transition-all uppercase inline-block shadow-sm">
                        View Details
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination();
}

window.changePage = function(newPage) {
    currentPage = newPage;
    renderStudents();
};

window.goToPage = function(value, maxPage) {
    let page = parseInt(value);
    if (isNaN(page)) {
        renderPagination(); // reset to current page in input
        return;
    }
    if (page < 1) page = 1;
    if (page > maxPage) page = maxPage;
    changePage(page);
};

function renderPagination() {
    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const container = document.getElementById('paginationControls');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    const prevDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;
    
    container.innerHTML = `
        <div class="flex items-center gap-2">
            <button onclick="changePage(${currentPage - 1})" class="px-4 py-2 rounded-xl font-bold transition-all text-sm ${prevDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-900 hover:bg-purple-200'}" ${prevDisabled ? 'disabled' : ''}>Previous</button>
            <span class="text-sm font-black text-purple-950 px-4 flex items-center gap-2">
                Page 
                <input type="number" min="1" max="${totalPages}" value="${currentPage}" 
                       onchange="goToPage(this.value, ${totalPages})"
                       class="w-16 px-1 py-1 text-center border-2 border-purple-200 rounded-lg focus:outline-none focus:border-purple-500 bg-white shadow-sm">
                of ${totalPages}
            </span>
            <button onclick="changePage(${currentPage + 1})" class="px-4 py-2 rounded-xl font-bold transition-all text-sm ${nextDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-900 hover:bg-purple-200'}" ${nextDisabled ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", fetchStudents);
