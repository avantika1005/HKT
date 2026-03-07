const { useState, useEffect, useMemo } = React;

const API_BASE = "http://localhost:8000/api";

function App() {
  const [currentPage, setCurrentPage] = useState("login"); // login, dashboard, student
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  useEffect(() => {
    if (window.feather) {
      window.feather.replace();
    }
  }, [currentPage, selectedStudentId]);

  if (currentPage === "login") {
    return <Login onLogin={() => setCurrentPage("dashboard")} />;
  }

  return (
    <div className="app-container">
      <header className="header-nav">
        <div className="brand" onClick={() => setCurrentPage('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon"><i data-feather="terminal"></i></div>
          <span>Student Analytics</span>
        </div>

        <div className="nav-search">
          <i data-feather="search" width="16"></i>
          <input 
            type="text" 
            placeholder="Search student identity..." 
            onFocus={() => setCurrentPage('dashboard')}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${currentPage === 'dashboard' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => setCurrentPage('dashboard')}
            style={{ padding: '10px 16px' }}
          >
            <i data-feather="grid" width="18"></i> Dashboard
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => setCurrentPage('login')} 
            style={{ padding: '10px 16px', background: 'rgba(244, 63, 94, 0.05)', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.1)' }}
          >
            <i data-feather="power" width="18"></i>
          </button>
        </div>
      </header>

      <main className="view-container animate-fade-in" style={{ paddingTop: '40px' }}>
        {currentPage === "dashboard" && (
          <Dashboard onSelectStudent={(id) => {
            setSelectedStudentId(id);
            setCurrentPage("student");
          }} />
        )}
        {currentPage === "student" && (
          <StudentDetail id={selectedStudentId} onBack={() => setCurrentPage("dashboard")} />
        )}
      </main>
    </div>
  );
}

// ================= LOGIN PAGE =================
function Login({ onLogin }) {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel login-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="brand-icon" style={{ margin: '0 auto 32px', width: 'fit-content', padding: '16px' }}>
          <i data-feather="zap" width="40" height="40"></i>
        </div>
        <h2>Risk Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 48, fontSize: '1.1rem' }}>Enter credentials to access the AI analysis engine.</p>
        
        <div className="input-group" style={{ marginBottom: 24 }}>
          <input type="text" className="input-field" placeholder="Email Address" defaultValue="admin@school.edu" style={{ width: '100%' }} />
        </div>
        <div className="input-group" style={{ marginBottom: 32 }}>
          <input type="password" className="input-field" placeholder="Dashboard Passport" defaultValue="password" style={{ width: '100%' }} />
        </div>
        
        <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', borderRadius: '16px' }} onClick={onLogin}>
          Authenticate Session
        </button>
        
        <p style={{ marginTop: 32, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Powered by Predictive ML Pipeline v2.4
        </p>
      </div>
    </div>
  );
}

// ================= DASHBOARD PAGE =================
function Dashboard({ onSelectStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [riskFilter, setRiskFilter] = useState("All");
  const [classFilter, setClassFilter] = useState("All");

  const fetchStudents = async () => {
    setLoading(true);
    let url = `${API_BASE}/students?risk_level=${riskFilter}&grade_class=${classFilter}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setStudents(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, [riskFilter, classFilter]);
  useEffect(() => { if (window.feather) window.feather.replace(); });

  const highRiskCount = students.filter(s => s.risk_level === 'High').length;
  const mediumRiskCount = students.filter(s => s.risk_level === 'Medium').length;
  const lowRiskCount = students.filter(s => s.risk_level === 'Low').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 60 }}>
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: 12 }}>System Overview</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px' }}>Real-time analysis student stability and potential churn indicators powered by current semester data.</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '16px 32px', borderRadius: '20px' }} onClick={() => setShowUpload(true)}>
          <i data-feather="plus-circle" width="20"></i> Ingest Records
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 80 }}>
        <div className="stat-card stat-high animate-slide-in" style={{ animationDelay: '0.1s' }}>
          <h3><i data-feather="shield-off"></i> High Severity</h3>
          <div className="value">{highRiskCount}</div>
        </div>
        <div className="stat-card stat-medium animate-slide-in" style={{ animationDelay: '0.2s' }}>
          <h3><i data-feather="help-circle"></i> Monitoring</h3>
          <div className="value">{mediumRiskCount}</div>
        </div>
        <div className="stat-card stat-low animate-slide-in" style={{ animationDelay: '0.3s' }}>
          <h3><i data-feather="check-square"></i> Stable</h3>
          <div className="value">{lowRiskCount}</div>
        </div>
      </div>

      <div className="directory-section animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: '2rem' }}>Academic Directory</h2>
          <div style={{ display: 'flex', gap: 16 }}>
             <select className="input-field" value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={{ background: 'var(--surface)', minWidth: '160px' }}>
                <option value="All">All Severity</option>
                <option value="High">High Risk</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low Risk</option>
             </select>
             <select className="input-field" value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ background: 'var(--surface)', minWidth: '160px' }}>
                <option value="All">All Cohorts</option>
                <option value="9th">Grade 9</option>
                <option value="10th">Grade 10</option>
             </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 100, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto', width: 64, height: 64, borderWidth: 4 }}></div></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '24px 32px' }}>Identity Descriptor</th>
                  <th>Cohort</th>
                  <th>Stability Logit</th>
                  <th>Classification</th>
                  <th>Dominant Driver</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} onClick={() => onSelectStudent(s.id)}>
                    <td style={{ padding: '24px 32px' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>{s.name}</div>
                      <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{s.student_id}</code>
                    </td>
                    <td><span style={{ fontSize: '1.1rem', opacity: 0.8 }}>{s.grade_class}</span></td>
                    <td style={{ fontWeight: 800, fontSize: '1.8rem', color: s.risk_level === 'High' ? 'var(--risk-high)' : 'var(--text-main)' }}>{s.risk_score}</td>
                    <td>
                      <span className={`badge badge-${s.risk_level.toLowerCase()}`}>
                        {s.risk_level} Risk
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{s.top_factors ? s.top_factors.split(',')[0] : 'Scanning...'}</td>
                    <td style={{ textAlign: 'right', paddingRight: '40px' }}><i data-feather="arrow-right-circle" style={{ color: 'var(--accent)', opacity: 0.5 }}></i></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); fetchStudents(); }} />}
    </div>
  );
}

// ================= UPLOAD MODAL =================
function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      if (res.ok) onSuccess();
      else alert("Processing Error: Check schema match.");
    } catch (e) { alert("Core Link Failed"); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 17, 0.9)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="glass-panel animate-fade-in" style={{ padding: 60, width: '550px', borderRadius: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <h3 style={{ fontSize: '2rem' }}>Data Ingestion</h3>
          <button onClick={onClose} className="btn" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)' }}><i data-feather="x" width="28"></i></button>
        </div>
        
        <div style={{ padding: '40px', border: '2px dashed var(--border)', borderRadius: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }} onClick={() => document.getElementById('csv_input').click()}>
          <i data-feather="file-text" width="48" height="48" style={{ color: 'var(--primary)', marginBottom: 20 }}></i>
          <p style={{ fontSize: '1.2rem', marginBottom: 8 }}>{file ? file.name : "Select CSV source file"}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Required columns: ID, Name, Grade, Attendance, Score</p>
          <input id="csv_input" type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} style={{ display: 'none' }} />
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 48, padding: '20px', borderRadius: '20px', fontSize: '1.2rem' }} onClick={handleUpload} disabled={loading || !file}>
          {loading ? "Optimizing Neural Weights..." : "Run ML Analysis"}
        </button>
      </div>
    </div>
  );
}

// ================= STUDENT DETAIL PAGE =================
function StudentDetail({ id, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");

  const fetchDetail = async () => {
    try {
      const res = await fetch(`${API_BASE}/students/${id}`);
      const json = await res.json();
      setData(json);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchDetail(); }, [id]);
  useEffect(() => { if (window.feather) window.feather.replace(); });

  const handleLogIntervention = async () => {
    if (!action.trim()) return;
    try {
      await fetch(`${API_BASE}/students/${id}/interventions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), action })
      });
      setAction(""); fetchDetail();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ padding: 100, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>;
  if (!data || !data.student) return <div style={{ textAlign: 'center', padding: 100 }}>Core Trace Null.</div>;

  const { student, interventions } = data;
  const suggestedActions = ["Home visit protocol", "Clinical counseling", "Peer tutoring node", "Financial aid scan"];

  return (
    <div className="animate-fade-in">
      <button className="btn btn-outline" style={{ marginBottom: 48, padding: '12px 24px', borderRadius: '16px' }} onClick={onBack}>
        <i data-feather="corner-up-left" width="18"></i> Return to Fleet
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div className="glass-panel" style={{ padding: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '3.5rem', marginBottom: 8 }}>{student.name}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.3rem' }}>{student.grade_class} • Protocol ID: <code style={{ color: 'var(--accent)' }}>{student.student_id}</code></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '6rem', fontWeight: 900, lineHeight: 1, textShadow: '0 0 40px ' + (student.risk_level === 'High' ? 'var(--risk-high-glow)' : 'var(--accent-glow)') }}>
                {student.risk_score}
              </div>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', marginTop: 12 }}>Stability Index</p>
            </div>
          </div>

          <div className="glass-card animate-slide-in" style={{ padding: 48 }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: 24, color: 'var(--accent)' }}><i data-feather="cpu"></i> AI Attribution Insights</h3>
            <div className="explanation-box" style={{ padding: '32px', fontSize: '1.2rem', borderRadius: '24px', background: 'rgba(0,0,0,0.3)', border: 'none' }}>
              {student.llm_explanation}
            </div>
            <div style={{ marginTop: 48 }}>
               <h4 style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem', textTransform: 'uppercase' }}>Weighted Risk Parameters</h4>
               <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                 {student.top_factors && student.top_factors.split(',').map((f, i) => (
                   <span key={i} className="glass-card" style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', fontSize: '1.1rem' }}>{f.trim()}</span>
                 ))}
               </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div className="glass-card animate-slide-in" style={{ padding: 48, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(15, 23, 42, 0.4))' }}>
            <h3 style={{ marginBottom: 24 }}><i data-feather="alert-octagon" style={{ color: 'var(--risk-high)' }}></i> Recommended Ops</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {suggestedActions.map((act, i) => (
                <button key={i} className="btn btn-outline" style={{ justifyContent: 'flex-start', padding: '20px', borderRadius: '18px', fontSize: '1.1rem' }} onClick={() => setAction(act)}>
                  <i data-feather="chevron-right" width="16" style={{ color: 'var(--primary)' }}></i> {act}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel animate-slide-in" style={{ padding: 48, flex: 1, borderRadius: '32px' }}>
            <h3 style={{ marginBottom: 32 }}><i data-feather="activity"></i> Intervention History</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <input type="text" className="input-field" style={{ flex: 1, background: 'var(--surface)' }} placeholder="Append event..." value={action} onChange={e => setAction(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogIntervention()} />
              <button className="btn btn-primary" onClick={handleLogIntervention} style={{ padding: '0 24px', borderRadius: '14px' }}>Log</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {interventions.reverse().map(inv => (
                <div key={inv.id} className="intervention-item" style={{ background: 'rgba(255,255,255,0.03)', border: 'none', padding: '24px', borderRadius: '16px' }}>
                   <div style={{ fontSize: '1.1rem' }}>{inv.action}</div>
                   <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>{inv.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
