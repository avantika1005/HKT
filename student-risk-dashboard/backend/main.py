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

from models import Base, Student, Intervention
from ml_model import model_instance
from llm_service import generate_explanation, generate_parent_communication
from intervention_engine import intervention_engine
from scheme_matcher import scheme_matcher

# DB Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ensure database schema is always up to date; we aggressively drop+recreate when uploading new CSVs
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
    required_cols = ['Student ID', 'Student Name', 'Class / Grade', 'Attendance Percentage', 
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
        return []
    
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
    # Group students by school and evaluate metrics
    students = db.query(Student).all()
    
    # Simple hardcoded dict of coordinates for demo visually distinct markers across Tamil Nadu
    # In a real app, this would come from a School table or Geocoding API.
    mock_coordinates = {
        "Kanchipuram Govt Model School": {"lat": 12.8341735, "lng": 79.7036402},
        "Walajabad Panchayat Union School": {"lat": 12.7937, "lng": 79.8093},
        "Sriperumbudur Excellence Academy": {"lat": 12.967, "lng": 79.948},
        "Uthiramerur Higher Secondary": {"lat": 12.613, "lng": 79.761},
        "Kundrathur Zilla Parishad School": {"lat": 12.997, "lng": 80.098},
        "Chennai Public School": {"lat": 13.0827, "lng": 80.2707}, # Chennai
        "Madurai Central School": {"lat": 9.9252, "lng": 78.1198}, # Madurai
        "Coimbatore Excellence": {"lat": 11.0168, "lng": 76.9558}, # Coimbatore
        "Salem Govt School": {"lat": 11.6643, "lng": 78.1460},     # Salem
        "Trichy Model School": {"lat": 10.7905, "lng": 78.7047},   # Tiruchirappalli
        "Tirunelveli High School": {"lat": 8.7139, "lng": 77.7567},# Tirunelveli
        "Vellore Heritage School": {"lat": 12.9165, "lng": 79.1325}, # Vellore
        
        # New prominent locations
        "Nilgiris Mountain School": {"lat": 11.4118, "lng": 76.6953}, # Ooty / Nilgiris
        "Thanjavur Delta Academy": {"lat": 10.7870, "lng": 79.1378}, # Thanjavur
        "Kanyakumari Coastal Govt": {"lat": 8.0883, "lng": 77.5385}, # Kanyakumari
        "Erode Textile City School": {"lat": 11.3410, "lng": 77.7172}, # Erode
        "Thoothukudi Port Academy": {"lat": 8.7642, "lng": 78.1348}, # Thoothukudi
        "Dindigul Fort High": {"lat": 10.3624, "lng": 77.9695}, # Dindigul
        "Tiruvannamalai Heritage": {"lat": 12.2253, "lng": 79.0747}, # Tiruvannamalai
        "Cuddalore Coast School": {"lat": 11.7480, "lng": 79.7714}, # Cuddalore
        "Karur Kongu Academy": {"lat": 10.9601, "lng": 78.0766}, # Karur
        "Krishnagiri Border School": {"lat": 12.5186, "lng": 78.2137} # Krishnagiri
    }
    
    school_metrics = {}
    
    for s in students:
        s_name = s.school_name
        b_name = s.block_name
        d_name = s.district_name
        
        if s_name not in school_metrics:
            coords = mock_coordinates.get(s_name, {"lat": 13.0, "lng": 80.0}) # Default near Chennai
            school_metrics[s_name] = {
                "school_name": s_name,
                "block_name": b_name,
                "district_name": d_name,
                "lat": coords["lat"],
                "lng": coords["lng"],
                "total_students": 0,
                "high_risk_count": 0,
                "total_risk_score": 0,
                "total_attendance": 0,
                "total_exam": 0,
                "common_factors": {}
            }
            
        metrics = school_metrics[s_name]
        metrics["total_students"] += 1
        metrics["total_risk_score"] += (s.risk_score or 0)
        metrics["total_attendance"] += (s.attendance_pct or 0)
        metrics["total_exam"] += (s.latest_exam_score or 0)
        
        if s.risk_level == "High":
            metrics["high_risk_count"] += 1
            
        if s.top_factors:
            factors = [f.strip() for f in s.top_factors.split(',')]
            for f in factors:
                metrics["common_factors"][f] = metrics["common_factors"].get(f, 0) + 1
                
    result = []
    
    for s_name, data in school_metrics.items():
        total = data["total_students"]
        if total > 0:
            avg_risk = data["total_risk_score"] / total
            avg_att = data["total_attendance"] / total
            avg_exam = data["total_exam"] / total
            high_risk_pct = (data["high_risk_count"] / total) * 100
            
            # Find top 2 most common factors
            sorted_factors = sorted(data["common_factors"].items(), key=lambda item: item[1], reverse=True)
            top_factors = [f[0] for f in sorted_factors[:2]]
            
            # Determine overall risk concentration string based on heatmap requirements
            if high_risk_pct >= 20: # High Concentration
                concentration = "High"
            elif high_risk_pct >= 10: # Moderate Concentration
                concentration = "Moderate"
            else:
                concentration = "Low"
                
            result.append({
                "school_name": s_name,
                "block_name": data["block_name"],
                "district_name": data["district_name"],
                "lat": data["lat"],
                "lng": data["lng"],
                "total_students": total,
                "high_risk_count": data["high_risk_count"],
                "high_risk_pct": round(high_risk_pct, 1),
                "avg_risk_score": round(avg_risk, 1),
                "avg_attendance": round(avg_att, 1),
                "avg_exam": round(avg_exam, 1),
                "risk_concentration": concentration,
                "top_factors": top_factors
            })
            
    return result

# Serve frontend static files
# Use absolute paths for deployment robustness
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
