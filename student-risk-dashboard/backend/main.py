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

from models import Base, Student, Intervention
from ml_model import model_instance
from llm_service import generate_explanation, generate_parent_communication
from intervention_engine import intervention_engine
from scheme_matcher import scheme_matcher

# DB Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

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

# API Endpoints
@app.get("/api/ping")
def ping():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
        
    # Clear existing data to show only current CSV students
    db.query(Intervention).delete()
    db.query(Student).delete()
    db.commit()

    content = await file.read()
    s = str(content, 'utf-8')
    data = StringIO(s)
    df = pd.read_csv(data)
    
    # Required columns basic check
    required_cols = ['Student ID', 'Student Name', 'Class / Grade', 'Attendance Percentage', 
                     'Latest Exam Score', 'Previous Exam Score', 'Distance from School (km)', 
                     'Midday Meal Participation (Yes/No)', 'Midday Meal Participation Rate (%)',
                     'Sibling Dropout History (Yes/No)']
                     
    if not all(col in df.columns for col in required_cols):
        raise HTTPException(status_code=400, detail="Missing required columns in CSV")
        
    for index, row in df.iterrows():
        student_data = {
            'attendance_pct': float(row['Attendance Percentage']),
            'latest_exam_score': float(row['Latest Exam Score']),
            'previous_exam_score': float(row['Previous Exam Score']),
            'distance_km': float(row['Distance from School (km)']),
            'midday_meal': str(row['Midday Meal Participation (Yes/No)']).strip().lower() == 'yes',
            'meal_participation_pct': float(row['Midday Meal Participation Rate (%)']),
            'sibling_dropout': str(row['Sibling Dropout History (Yes/No)']).strip().lower() == 'yes'
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
        
    interventions = db.query(Intervention).filter(Intervention.student_id == student.id).all()
    
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

    # Refresh outcomes for pending interventions older than 30 days (Simulated: any intervention > 1 min for demo)
    import datetime
    for inv in interventions:
        if not inv.is_evaluated and inv.date:
            try:
                # In real scenario, check date > 30 days
                # For demo, if it exists, let's allow "evaluating" it
                # Logic: Compare current student state to baseline
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
            except Exception as e:
                print(f"Eval error: {e}")
    db.commit()

    return {
        "student": to_dict(student),
        "interventions": [to_dict(i) for i in interventions],
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
        return {"message": "No evaluated data yet", "stats": []}
    
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

# Serve frontend static files
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
