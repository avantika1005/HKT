let map;
let markerGroup;
let allSchoolData = []; // Store fetched data

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/analytics/heatmap');
        if(!res.ok) throw new Error("Failed to fetch heatmap data");
        allSchoolData = await res.json();
        
        initMap();
        populateFilters();
        renderMarkers(allSchoolData);

        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');

        // Force a map cache invalidate to prevent gray tiles on hidden->shown transitions
        setTimeout(() => {
            map.invalidateSize();
        }, 100);

    } catch (e) {
    console.warn("API failed, loading demo dataset");

    allSchoolData = [
        {
            school_name: "Chennai Government Higher Secondary School",
            district_name: "Chennai",
            block_name: "Chennai City",
            lat: 13.0827,
            lng: 80.2707,
            total_students: 120,
            high_risk_count: 30,
            high_risk_pct: 25,
            avg_risk_score: 0.67,
            avg_attendance: 82,
            risk_concentration: "High",
            top_factors: ["Low Attendance", "Financial Issues"]
        },
        {
            school_name: "Coimbatore Municipal School",
            district_name: "Coimbatore",
            block_name: "Coimbatore South",
            lat: 11.0168,
            lng: 76.9558,
            total_students: 90,
            high_risk_count: 12,
            high_risk_pct: 13,
            avg_risk_score: 0.45,
            avg_attendance: 87,
            risk_concentration: "Moderate",
            top_factors: ["Academic Difficulty"]
        },
        {
            school_name: "Madurai Government School",
            district_name: "Madurai",
            block_name: "Madurai East",
            lat: 9.9252,
            lng: 78.1198,
            total_students: 70,
            high_risk_count: 4,
            high_risk_pct: 6,
            avg_risk_score: 0.21,
            avg_attendance: 93,
            risk_concentration: "Low",
            top_factors: []
        }
    ];

    initMap();
    populateFilters();
    renderMarkers(allSchoolData);

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('dashboardContent').classList.remove('hidden');
}
});

function initMap() {
    // Center roughly on Tamil Nadu State
    map = L.map('map').setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    markerGroup = L.layerGroup().addTo(map);
}

function renderMarkers(data) {
    markerGroup.clearLayers();

    data.forEach(school => {
        let color = '#ec4899'; // Default
        if (school.risk_concentration === 'High') color = '#dc2626'; // red-600
        else if (school.risk_concentration === 'Moderate') color = '#eab308'; // yellow-500
        else if (school.risk_concentration === 'Low') color = '#10b981'; // emerald-500

        const circleMarker = L.circleMarker([school.lat, school.lng], {
            radius: Math.max(10, Math.min(30, school.total_students / 2)), // Size implies volume
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Simple tooltip
        circleMarker.bindTooltip(`<b>${school.school_name}</b><br>High Risk: ${school.high_risk_pct}%`);

        // Click event to update side panel
        circleMarker.on('click', () => {
            updateSidePanel(school);
            // Highlight selected marker visually
            map.setView([school.lat, school.lng], map.getZoom(), { animate: true });
        });

        circleMarker.addTo(markerGroup);
    });
}

function updateSidePanel(school) {
    document.getElementById('schoolDetailsPlaceholder').classList.add('hidden');
    document.getElementById('schoolDetailsPanel').classList.remove('hidden');

    document.getElementById('panelSchoolName').textContent = school.school_name;
    document.getElementById('panelBlockName').textContent = school.district_name + " District, " + school.block_name + " Block";
    document.getElementById('panelTotal').textContent = school.total_students;
    document.getElementById('panelHighRisk').textContent = `${school.high_risk_count} (${Number(school.high_risk_pct).toFixed(1)}%)`;
    document.getElementById('panelAvgRisk').textContent = Number(school.avg_risk_score).toFixed(1);
    document.getElementById('panelAvgAtt').textContent = `${Number(school.avg_attendance).toFixed(1)}%`;

    const factorsContainer = document.getElementById('panelFactors');
    factorsContainer.innerHTML = '';
    
    if (school.top_factors && school.top_factors.length > 0) {
        school.top_factors.forEach(f => {
            const span = document.createElement('span');
            span.className = "text-xs font-bold bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20";
            span.textContent = f;
            factorsContainer.appendChild(span);
        });
    } else {
        factorsContainer.innerHTML = `<span class="text-xs text-gray-400 italic">No dominating risk factors</span>`;
    }
}

function populateFilters() {
    // Populate Districts
    const districtFilter = document.getElementById('districtFilter');
    
    // Complete list of all 38 districts in Tamil Nadu
    const allTNDistricts = [
        "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", 
        "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", 
        "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", 
        "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", 
        "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", 
        "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", 
        "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", 
        "Vellore", "Viluppuram", "Virudhunagar"
    ];

    const tnBlocksData = {
        "Ariyalur": ["Andimadam", "Ariyalur", "Jayankondam", "Sendurai", "T. Palur", "Thirumanur"],
        "Chengalpattu": ["Acharapakkam", "Chithamur", "Kattankolathur", "Lathur", "Madhuranthakam", "St Thomas Mount", "Tirukalukundram", "Tiruporur"],
        "Chennai": ["Alandur", "Adyar", "Anna Nagar", "Chennai City", "Egmore", "Guindy", "Kodambakkam", "Mylapore", "Nungambakkam", "Perambur", "Purasaiwakkam", "Royapuram", "Shenoy Nagar", "Tondiarpet", "Triplicane", "Velachery", "Zonal"],
        "Coimbatore": ["Anaimalai", "Annur", "Coimbatore North", "Coimbatore South", "Karamadai", "Kinathukadavu", "Madukkarai", "Mettupalayam", "Perur", "Pollachi North", "Pollachi South", "Sarcarsamakulam", "Sultanpet", "Sulur", "Thondamuthur"],
        "Cuddalore": ["Annagramam", "Bhuvanagiri", "Cuddalore", "Kammapuram", "Kattumannarkoil", "Keerapalayam", "Komaratchi", "Kurinjipadi", "Mangalur", "Nallur", "Panruti", "Parangipettai", "Srimushnam", "Vridhachalam"],
        "Dharmapuri": ["Dharmapuri", "Harur", "Karimangalam", "Morappur", "Nallampalli", "Palacode", "Pappireddipatti", "Pennagaram"],
        "Dindigul": ["Athoor", "Batlagundu", "Dindigul", "Guziliamparai", "Kodaikanal", "Natham", "Nilakottai", "Oddanchatram", "Palani", "Reddiarchatram", "Sanarpatti", "Shanarpatti", "Thoppampatti", "Vadamadurai", "Vedasandur"],
        "Erode": ["Ammapet", "Anthiyur", "Bhavani", "Bhavanisagar", "Chennimalai", "Erode", "Gobichettipalayam", "Kodumudi", "Modakkurichi", "Nambiyur", "Perundurai", "Sathyamangalam", "Talavadi", "T N Palayam"],
        "Kallakurichi": ["Chinnasalem", "Kallakurichi", "Kalrayan Hills", "Rishivandiyam", "Sankarapuram", "Thirunavalur", "Thirukovilur", "Thiagadurgam", "Ulundurpet"],
        "Kanchipuram": ["Kanchipuram Central", "Kundrathur", "Sriperumbudur", "Uthiramerur", "Walajabad"],
        "Kanyakumari": ["Agastheeswaram", "Killiyur", "Kurunthencode", "Melpuram", "Munchira", "Rajakkamangalam", "Thackalai", "Thiruvattar", "Thovalai"],
        "Karur": ["Aravakurichi", "K.Paramathi", "Kadavur", "Karur", "Krihsnarayapuram", "Kulithalai", "Thanthoni", "Thogaimalai"],
        "Krishnagiri": ["Bargur", "Hosur", "Kaveripattinam", "Kelamangalam", "Krishnagiri", "Mathur", "Shoolagiri", "Thally", "Uthangarai", "Veppanapalli"],
        "Madurai": ["Alanganallur", "Chellampatti", "Kallikudi", "Kottampatti", "Madurai East", "Madurai West", "Melur", "Sedapatti", "T.Kallupatti", "Thirumangalam", "Thiruparankundram", "Usilampatti", "Vadipatti"],
        "Mayiladuthurai": ["Kollidam", "Kuttalam", "Mayiladuthurai", "Sirkali", "Sembanarkoil"],
        "Nagapattinam": ["Keelaiyur", "Kilvelur", "Nagapattinam", "Thalainayar", "Thirumarugal", "Vedaranyam"],
        "Namakkal": ["Elachipalayam", "Erumaipatti", "Kabilarmalai", "Kolli Hills", "Mallasamudram", "Mohanur", "Namakkal", "Pallipalayam", "Paramathi", "Puduchatram", "Rasipuram", "Sendamangalam", "Tiruchengode", "Vennandur"],
        "Nilgiris": ["Coonoor", "Gudalur", "Kotagiri", "Ooty"],
        "Perambalur": ["Alathur", "Perambalur", "Veppanthattai", "Veppur"],
        "Pudukkottai": ["Annavasal", "Aranthangi", "Arimalam", "Avudayarkoil", "Gandarvakottai", "Iluppur", "Karambakkudi", "Kunnandarkoil", "Manamelkudi", "Ponnamaravathi", "Pudukkottai", "Thirumayam", "Viralimalai"],
        "Ramanathapuram": ["Bogalur", "Kadaladi", "Kamuthi", "Mandapam", "Mudukulathur", "Nainarkoil", "Paramakudi", "Ramanathapuram", "R.S.Mangalam", "Tiruvadanai", "Thiruppullani"],
        "Ranipet": ["Arakkonam", "Arcot", "Kaveripakkam", "Nemili", "Sholingur", "Timiri", "Walajah"],
        "Salem": ["Ayothiapattinam", "Attur", "Edapady", "Gangavalli", "Kadayampatti", "Kolathur", "Konganapuram", "Macdonalds Choultry", "Mecheri", "Nangavalli", "Omalur", "Panamarathupatty", "Pethanaickenpalayam", "Salem Rural", "Sankari", "Thalaivasal", "Taramangalam", "Valapady", "Veerapandy", "Yercaud"],
        "Sivaganga": ["Devakottai", "Ilayangudi", "Kalayarkoil", "Kallal", "Kannangudi", "Manamadurai", "Sakkottai", "Singampunari", "Sivaganga", "Thiruppuvanam", "Tirupathur"],
        "Tenkasi": ["Alangulam", "Kadayanallur", "Keezhapavur", "Kuruvikulam", "Melaneelithanallur", "Sankarankoil", "Shencottai", "Tenkasi", "Vasudevanallur"],
        "Thanjavur": ["Ammapettai", "Budalur", "Kumbakonam", "Madukkur", "Orathanadu", "Papanasam", "Pattukkottai", "Peravurani", "Sethubhavachatram", "Thanjavur", "Thirupanandal", "Thiruvaiyaru", "Thiruvidaimarudur"],
        "Theni": ["Andipatti", "Bodinayakanur", "Chinnamanoor", "Cumbum", "K.Myladumparai", "Periyakulam", "Thevaram", "Uthamapalayam"],
        "Thoothukudi": ["Alwarthirunagari", "Karungulam", "Kayathar", "Kovilpatti", "Ottapidaram", "Pudukkottai", "Sathankulam", "Srivaikundam", "Thoothukudi", "Tiruchendur", "Udangudi", "Vilathikulam"],
        "Tiruchirappalli": ["Andanallur", "Lalgudi", "Manachanallur", "Manapparai", "Manikandam", "Marungapuri", "Musiri", "Pullambadi", "Thathaiyangarpet", "Thiruverumbur", "Thottiyam", "Turaiyur", "Uppiliyapuram", "Vaiyampatti"],
        "Tirunelveli": ["Ambasamudram", "Cheranmahadevi", "Kalakadu", "Manur", "Nanguneri", "Palayamkottai", "Pappakudi", "Radhapuram", "Valliyur"],
        "Tirupathur": ["Alangayam", "Jolarpet", "Kandili", "Madhanur", "Natrampalli", "Tirupathur"],
        "Tiruppur": ["Avanashi", "Dharapuram", "Gudimangalam", "Kangeyam", "Kundadam", "Madathukulam", "Moolanur", "Palladam", "Pongalur", "Tiruppur", "Udumalaipettai", "Uthukuli", "Vellakoil"],
        "Tiruvallur": ["Ellapuram", "Gummidipoondi", "Kadambathur", "Minjur", "Pallipattu", "Poonamallee", "Poondi", "Pulianthope", "R.K.Pet", "Sholavaram", "Thiruvalangadu", "Tiruvallur", "Villivakkam"],
        "Tiruvannamalai": ["Anakavur", "Arani", "Chengam", "Chetpet", "Cheyyar", "Dusi", "Jawadhu Hills", "Kalasapakkam", "Kilpennathur", "Pernamallur", "Polur", "Pudupalayam", "Thandarampet", "Thellar", "Thiruvannamalai", "Thurinjapuram", "Vandavasi", "West Arani"],
        "Tiruvarur": ["Kodavasal", "Koradacheri", "Kottur", "Mannargudi", "Muthupet", "Nannilam", "Needamangalam", "Thirumakkottai", "Thiruthuraipoondi", "Tiruvarur"],
        "Vellore": ["Anaicut", "Gudiyatham", "K.V.Kuppam", "Katpadi", "Kaniyambadi", "Pernambut", "Vellore"],
        "Viluppuram": ["Gingee", "Kanai", "Kandamangalam", "Koliyanur", "Mailam", "Marakkanam", "Melmalaiyanur", "Mugaiyur", "Olakkur", "Thiruvennainallur", "Vaanur", "Vikkiravandi", "Viluppuram"],
        "Virudhunagar": ["Aruppukottai", "Kariapatti", "Narikkudi", "Rajapalayam", "Sattur", "Sivakasi", "Srivilliputhur", "Tiruchuli", "Vembakottai", "Virudhunagar", "Watrap"]
    };

    allTNDistricts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        districtFilter.appendChild(opt);
    });

    // Function to populate blocks based on selected district
    const populateBlocks = () => {
        const blockFilter = document.getElementById('blockFilter');
        blockFilter.innerHTML = '<option value="All">All Blocks</option>'; // Reset
        
        const selectedDistrict = districtFilter.value;
        let blocksToAdd = [];

        if (selectedDistrict === 'All') {
            // Add all blocks from all districts
            Object.values(tnBlocksData).forEach(blocks => {
                blocksToAdd = blocksToAdd.concat(blocks);
            });
            // Sort them alphabetically for easier reading
            blocksToAdd.sort();
        } else {
            // Add blocks just for this district
            blocksToAdd = tnBlocksData[selectedDistrict] || [];
        }

        blocksToAdd.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            blockFilter.appendChild(opt);
        });
    };

    // Initial population of blocks (All Blocks)
    populateBlocks();

    // Re-populate blocks when district changes, then apply normal filters
    districtFilter.addEventListener('change', () => {
        populateBlocks();
        applyFilters();
    });

    blockFilter.addEventListener('change', applyFilters);
    document.getElementById('riskFilter').addEventListener('change', applyFilters);
}

function applyFilters() {
    const districtFilter = document.getElementById('districtFilter').value;
    const blockFilter = document.getElementById('blockFilter').value;
    const riskFilter = document.getElementById('riskFilter').value;

    let filtered = allSchoolData;

    if (districtFilter !== 'All') {
        filtered = filtered.filter(s => s.district_name === districtFilter);
    }
    
    if (blockFilter !== 'All') {
        filtered = filtered.filter(s => s.block_name === blockFilter);
    }

    if (riskFilter !== 'All') {
        filtered = filtered.filter(s => s.risk_concentration === riskFilter);
    }

    renderMarkers(filtered);
    
    // Fit bounds if we have points with valid coordinates
    const validPoints = filtered.filter(f => f.lat != null && f.lng != null && !isNaN(f.lat) && !isNaN(f.lng));
    if (validPoints.length > 0) {
        const lats = validPoints.map(f => f.lat);
        const lngs = validPoints.map(f => f.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [50, 50] });
    }
}
