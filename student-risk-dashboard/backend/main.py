from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from io import StringIO
import pandas as pd
import os
import uuid
import datetime
import shutil

from models import Base, Student, Intervention
from ml_model import model_instance
from llm_service import generate_explanation, generate_parent_communication
from intervention_engine import intervention_engine
from scheme_matcher import scheme_matcher

# DB Setup
# DB Setup
if os.environ.get("VERCEL"):
    # Vercel's /tmp is writable. We copy our persistent seeded DB there if it's missing.
    # Note: Changes made during the session will still be lost on cold start.
    SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/sql_app.db"
    PERSISTENT_DB = os.path.join(os.path.dirname(__file__), "sql_app.db")
    TEMP_DB = "/tmp/sql_app.db"
    
    if os.path.exists(PERSISTENT_DB) and not os.path.exists(TEMP_DB):
        try:
            shutil.copy2(PERSISTENT_DB, TEMP_DB)
            print("Successfully copied persistent DB to /tmp")
        except Exception as e:
            print(f"Error copying DB to /tmp: {e}")
else:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ensure database schema is always up to date
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Database init error: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="Student Risk Dashboard API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
def parse_bool(value):
    val = str(value).strip().lower()

    if val in ["true", "yes", "1"]:
        return True
    elif val in ["false", "no", "0"]:
        return False
    else:
        return False
# API Endpoints
@app.get("/api/ping")
def ping():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
        
    # wipe & recreate schema so that any model changes (e.g. new intervention fields) are applied
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Clear any in-memory db session state
    db.expire_all()

    content = await file.read()
    s = str(content, 'utf-8')
    data = StringIO(s)
    df = pd.read_csv(data)
    
    # Required columns basic check
    required_cols = ['Student ID', 'Student Name', 'School Name', 'Block Name', 'District Name', 'Class / Grade', 'Attendance Percentage', 
                     'Latest Exam Score', 'Previous Exam Score', 'Distance from School (km)', 
                     'Midday Meal Participation (Yes/No)', 'Midday Meal Participation Rate (%)',
                     'Sibling Dropout History (Yes/No)']
                     
    if not all(col in df.columns for col in required_cols):
        raise HTTPException(status_code=400, detail="Missing required columns in CSV")

    
    for index, row in df.iterrows():
        school_name = row.get('School Name', 'Kanchipuram Govt Model School')
        block_name = row.get('Block Name', 'Kanchipuram Central')
        district_name = row.get('District Name', 'Kanchipuram')
        
        student_data = {
            'attendance_pct': float(row['Attendance Percentage']),
            'latest_exam_score': float(row['Latest Exam Score']),
            'previous_exam_score': float(row['Previous Exam Score']),
            'distance_km': float(row['Distance from School (km)']),
            'midday_meal': parse_bool(row['Midday Meal Participation (Yes/No)']),
            'meal_participation_pct': float(row['Midday Meal Participation Rate (%)']),
            'sibling_dropout': parse_bool(row['Sibling Dropout History (Yes/No)'])
        }
        
        # ML Prediction
        pred = model_instance.predict_risk(student_data)
        
        # Calculate current class averages for context
        all_students = db.query(Student).all()
        if all_students:
            avg_att = sum(s.attendance_pct for s in all_students) / len(all_students)
            avg_score = sum(s.latest_exam_score for s in all_students) / len(all_students)
            avg_dist = sum(s.distance_km for s in all_students) / len(all_students)
            avg_meal = sum(s.meal_participation_pct for s in all_students) / len(all_students)
        else:
            avg_att, avg_score, avg_dist, avg_meal = student_data['attendance_pct'], student_data['latest_exam_score'], student_data['distance_km'], student_data['meal_participation_pct']

        class_avg = {
            "attendance": round(avg_att, 1), 
            "score": round(avg_score, 1), 
            "distance": round(avg_dist, 1),
            "meal": round(avg_meal, 1)
        }
        benchmarks = {"attendance": 88, "score": 74, "distance": 2.5, "meal": 85}

        # LLM Explanation
        explanation = generate_explanation(
            student_name=row['Student Name'],
            score=pred['score'],
            level=pred['level'],
            top_factors=pred['top_factors'],
            attendance=student_data['attendance_pct'],
            exams=student_data['latest_exam_score'],
            class_avg=class_avg,
            benchmarks=benchmarks
        )
        
        # Update or create student
        student = db.query(Student).filter(Student.student_id == str(row['Student ID'])).first()
        if not student:
            student = Student(student_id=str(row['Student ID']))
            db.add(student)
            
        student.name = row['Student Name']
        student.school_name = school_name
        student.block_name = block_name
        student.district_name = district_name
        student.grade_class = str(row['Class / Grade'])
        student.attendance_pct = student_data['attendance_pct']
        student.latest_exam_score = student_data['latest_exam_score']
        student.previous_exam_score = student_data['previous_exam_score']
        student.distance_km = student_data['distance_km']
        student.midday_meal = student_data['midday_meal']
        student.meal_participation_pct = student_data['meal_participation_pct']
        student.sibling_dropout = student_data['sibling_dropout']
        
        student.risk_score = pred['score']
        student.risk_level = pred['level']
        student.top_factors = pred['top_factors']
        student.llm_explanation = explanation
        
    db.commit()
    return {"message": "Data processed successfully"}


@app.get("/api/students")
def get_students(risk_level: str = None, grade_class: str = None, attendance: str = None, db: Session = Depends(get_db)):
    query = db.query(Student)
    if risk_level and risk_level.lower() != 'all':
        query = query.filter(Student.risk_level == risk_level)
    if grade_class and grade_class.lower() != 'all':
        query = query.filter(Student.grade_class == grade_class)
    
    students = query.all()
    
    # post process attendance filter since it's an inequality
    if attendance and attendance != 'All':
        if attendance == '< 70%':
            students = [s for s in students if s.attendance_pct < 70]
        elif attendance == '70% - 90%':
            students = [s for s in students if 70 <= s.attendance_pct <= 90]
        elif attendance == '> 90%':
            students = [s for s in students if s.attendance_pct > 90]
            
    return students

def to_dict(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    
@app.get("/api/students/{id}")
def get_student_detail(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    raw_interventions = db.query(Intervention).filter(Intervention.student_id == student.id).all()
    interventions = []
    
    # Calculate cohort comparisons
    all_students = db.query(Student).all()
    avg_att = sum(s.attendance_pct for s in all_students) / len(all_students) if all_students else 0
    avg_score = sum(s.latest_exam_score for s in all_students) / len(all_students) if all_students else 0
    avg_dist = sum(s.distance_km for s in all_students) / len(all_students) if all_students else 0
    avg_meal = sum(s.meal_participation_pct for s in all_students) / len(all_students) if all_students else 0

    comparison = {
        "metrics": ["Attendance", "Exam Score", "Distance", "Meal Participation"],
        "student": [student.attendance_pct, student.latest_exam_score, student.distance_km, student.meal_participation_pct],
        "class_avg": [round(avg_att, 1), round(avg_score, 1), round(avg_dist, 1), round(avg_meal, 1)],
        "benchmarks": [88, 74, 2.5, 85]
    }

    # Evaluate outcomes for pending interventions older than 30 days
    # For demo purposes, we automatically evaluate any pending intervention.
    for inv in raw_interventions:
        if not inv.is_evaluated and inv.date:
            try:
                deltas = {
                    "attendance": student.attendance_pct - (inv.baseline_attendance or 0),
                    "score": student.latest_exam_score - (inv.baseline_score or 0),
                    "risk": (inv.baseline_risk_score or 0) - student.risk_score # Lower is better
                }
                
                # Simple heuristic: if 2/3 improved, then Improved
                improvements = 0
                if deltas['attendance'] > 0: improvements += 1
                if deltas['score'] > 0: improvements += 1
                if deltas['risk'] > 0: improvements += 1
                
                if improvements >= 2:
                    inv.outcome_status = "Improved"
                elif improvements == 0:
                    inv.outcome_status = "Declined"
                else:
                    inv.outcome_status = "No Change"
                
                inv.outcome_attendance = student.attendance_pct
                inv.outcome_score = student.latest_exam_score
                inv.outcome_meal_pct = student.meal_participation_pct
                inv.outcome_risk_score = student.risk_score
                inv.is_evaluated = True
                db.add(inv)
                db.commit()
            except Exception as e:
                print(f"Eval error: {e}")
                
        interventions.append(to_dict(inv))

    return {
        "student": to_dict(student),
        "interventions": interventions,
        "comparison": comparison
    }

@app.get("/api/students/{id}/parent-communication")
def get_parent_communication(id: int, language: str = "English", db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if student.risk_level not in ["Medium", "High"]:
        raise HTTPException(status_code=400, detail="Parent communication is only available for students at Medium or High risk.")
        
    message = generate_parent_communication(
        student_name=student.name,
        level=student.risk_level,
        top_factors=student.top_factors,
        language=language
    )
    
    return {
        "student_id": student.id,
        "student_name": student.name,
        "language": language,
        "message": message
    }

@app.get("/api/interventions/{id}")
def get_interventions(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # Interventions are primarily for Medium/High risk
    if student.risk_level == 'Low':
        return {"student_id": student.student_id, "interventions": []}
        
    recs = intervention_engine.get_recommendations(student)
    return {"student_id": student.student_id, "interventions": recs}

@app.get("/api/schemes/{id}")
def get_schemes(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    eligible = scheme_matcher.get_eligible_schemes(student)
    return {"student_id": student.student_id, "eligible_schemes": eligible}

@app.post("/api/students/{id}/interventions")
def log_intervention(id: int, payload: dict, db: Session = Depends(get_db)):
    """Record a new intervention for a student, capturing baseline indicators."""
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    inv = Intervention(
        student_id=id, 
        date=payload.get("date"), 
        action=payload.get("action"),
        teacher_name=payload.get("teacher_name"),
        notes=payload.get("notes"),
        # Capture Baselines
        baseline_attendance=student.attendance_pct,
        baseline_score=student.latest_exam_score,
        baseline_meal_pct=student.meal_participation_pct,
        baseline_risk_score=student.risk_score,
        outcome_status="Pending",
        is_evaluated=False
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv

@app.get("/api/analytics/interventions")
def get_intervention_analytics(db: Session = Depends(get_db)):
    interventions = db.query(Intervention).filter(Intervention.is_evaluated == True).all()
    if not interventions:
        return {"message": "No evaluated data yet"}
    
    # Group by action
    stats = {}
    for inv in interventions:
        action = inv.action
        if action not in stats:
            stats[action] = {"count": 0, "improved": 0, "total_att_gain": 0}
        
        stats[action]["count"] += 1
        if inv.outcome_status == "Improved":
            stats[action]["improved"] += 1
        
        att_gain = (inv.outcome_attendance or 0) - (inv.baseline_attendance or 0)
        stats[action]["total_att_gain"] += att_gain
        
    result = []
    for action, data in stats.items():
        result.append({
            "intervention": action,
            "success_rate": round((data["improved"] / data["count"]) * 100, 1),
            "avg_attendance_improvement": round(data["total_att_gain"] / data["count"], 1),
            "total_logs": data["count"]
        })
        
    return sorted(result, key=lambda x: x['success_rate'], reverse=True)

@app.get("/api/analytics/heatmap")
def get_district_heatmap(db: Session = Depends(get_db)):
    # Pre-defined realistic school-level summaries for Tamil Nadu.
    # Enrollment figures reflect real government/matric school sizes (~300-900 students).
    from schools_data import REALISTIC_SCHOOLS

    # If real students have been uploaded via CSV, merge them on top
    students = db.query(Student).all()

    # Build index of any real uploaded students by school name
    db_school_map = {}
    for s in students:
        sn = s.school_name
        if sn not in db_school_map:
            db_school_map[sn] = {"total": 0, "high": 0, "risk_sum": 0.0, "att_sum": 0.0, "factors": {}}
        m = db_school_map[sn]
        m["total"] += 1
        m["risk_sum"] += float(s.risk_score or 0)
        m["att_sum"] += float(s.attendance_pct or 0)
        if s.risk_level == "High":
            m["high"] += 1
        if s.top_factors:
            for f in [x.strip() for x in s.top_factors.split(",")]:
                m["factors"][f] = m["factors"].get(f, 0) + 1

    result = []
    for school in REALISTIC_SCHOOLS:
        sn = school["school_name"]
        total = school["total_students"]
        high = school["high_risk_count"]
        avg_risk = school["avg_risk_score"]
        avg_att = school["avg_attendance"]
        top_factors = list(school["top_factors"])

        # Merge real uploaded students if any match this school
        if sn in db_school_map:
            m = db_school_map[sn]
            new_total = total + m["total"]
            avg_risk = round((avg_risk * total + m["risk_sum"]) / new_total, 1)
            avg_att = round((avg_att * total + m["att_sum"]) / new_total, 1)
            total = new_total
            high += m["high"]
            if m["factors"]:
                sorted_f = sorted(m["factors"].items(), key=lambda x: x[1], reverse=True)
                top_factors = [f[0] for f in sorted_f[:2]]

        high_risk_pct = round((high / total) * 100, 1) if total > 0 else 0.0
        if high_risk_pct >= 20:
            concentration = "High"
        elif high_risk_pct >= 10:
            concentration = "Moderate"
        else:
            concentration = "Low"

        result.append({
            "school_name": sn,
            "block_name": school["block_name"],
            "district_name": school["district_name"],
            "lat": school["lat"],
            "lng": school["lng"],
            "total_students": total,
            "high_risk_count": high,
            "high_risk_pct": high_risk_pct,
            "avg_risk_score": avg_risk,
            "avg_attendance": avg_att,
            "risk_concentration": concentration,
            "top_factors": top_factors,
        })

    return result

# Serve frontend static files
frontend_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    print(f"Warning: Frontend path not found at {frontend_path}")
