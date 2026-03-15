from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import datetime
import os
import sys
import random

# Add backend to path to import models
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_path)

from models import Base, Student, Intervention
from llm_service import generate_explanation

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENTS_DATA = [
    {"student_id": "STU101", "name": "Arun Kumar", "school": "Kanchipuram Govt Model School", "grade": "10th", "risk": "High", "factors": "Attendance, Distance"},
    {"student_id": "STU102", "name": "Priya Sharma", "school": "Kanchipuram Govt Model School", "grade": "10th", "risk": "Medium", "factors": "Latest Exam Score"},
    {"student_id": "STU103", "name": "Vijay Singh", "school": "Kanchipuram Govt Model School", "grade": "9th", "risk": "Low", "factors": ""},
    {"student_id": "STU104", "name": "Ananya Das", "school": "Walajabad Panchayat Union School", "grade": "10th", "risk": "High", "factors": "Attendance, Midday Meal"},
    {"student_id": "STU105", "name": "Karthik R", "school": "Walajabad Panchayat Union School", "grade": "8th", "risk": "Medium", "factors": "Sibling Dropout"},
    {"student_id": "STU106", "name": "Meera Iyer", "school": "Sriperumbudur Excellence Academy", "grade": "12th", "risk": "High", "factors": "Latest Exam Score, Attendance"},
    {"student_id": "STU107", "name": "Rahul Bose", "school": "Sriperumbudur Excellence Academy", "grade": "11th", "risk": "Low", "factors": ""},
    {"student_id": "STU108", "name": "Sita Lakshmi", "school": "Uthiramerur Higher Secondary", "grade": "10th", "risk": "Medium", "factors": "Distance"},
    {"student_id": "STU109", "name": "Deepak Raj", "school": "Chennai Public School", "grade": "10th", "risk": "High", "factors": "Attendance, Midday Meal"},
    {"student_id": "STU110", "name": "Jasmin Kaur", "school": "Madurai Central School", "grade": "9th", "risk": "Medium", "factors": "Sibling Dropout"},
]

ACTIONS = [
    "Parent–Teacher Meeting",
    "Attendance Monitoring",
    "Academic Counseling",
    "Peer Mentoring",
    "Extra Tutoring",
    "Weekly Progress Tracking"
]

TEACHERS = ["Admin", "Mr. Rajesh", "Ms. Lakshmi", "Mr. Sivakumar"]

def seed():
    db = SessionLocal()
    
    # We'll reload everything to ensure full data
    db.query(Intervention).delete()
    db.query(Student).delete()
    db.commit()
    
    for s_info in STUDENTS_DATA:
        att = round(random.uniform(60, 95), 1)
        score = round(random.uniform(40, 90), 1)
        dist = round(random.uniform(0.5, 6.0), 1)
        meal_pct = round(random.uniform(50, 95), 1)
        risk_score = round(random.uniform(20, 90), 1)
        
        # Add explanation
        explanation = generate_explanation(
            student_name=s_info["name"],
            score=int(risk_score),
            level=s_info["risk"],
            top_factors=s_info["factors"],
            attendance=att,
            exams=score,
            class_avg={"attendance": 82, "score": 68, "distance": 2.2, "meal": 75},
            benchmarks={"attendance": 88, "score": 74, "distance": 2.5, "meal": 85}
        )

        student = Student(
            student_id=s_info["student_id"],
            name=s_info["name"],
            school_name=s_info["school"],
            block_name="Kanchipuram Central",
            district_name="Kanchipuram",
            grade_class=s_info["grade"],
            attendance_pct=att,
            latest_exam_score=score,
            previous_exam_score=score - random.uniform(-5, 10),
            distance_km=dist,
            meal_participation_pct=meal_pct,
            sibling_dropout=random.choice([True, False]),
            risk_score=risk_score,
            risk_level=s_info["risk"],
            top_factors=s_info["factors"],
            llm_explanation=explanation
        )
        db.add(student)
        db.commit()
        db.refresh(student)

        # Generate 2-4 interventions for each student
        num_inv = random.randint(2, 4)
        for i in range(num_inv):
            action = random.choice(ACTIONS)
            is_eval = random.choice([True, True, False]) # 66% chance of being evaluated
            
            baseline_att = round(random.uniform(60, 80), 1)
            baseline_score = round(random.uniform(40, 70), 1)
            baseline_risk = round(random.uniform(50, 90), 1)
            
            # Outcome (if evaluated)
            outcome_att = round(baseline_att + random.uniform(-5, 15), 1) if is_eval else None
            outcome_score = round(baseline_score + random.uniform(-5, 15), 1) if is_eval else None
            outcome_risk = round(baseline_risk - random.uniform(-5, 15), 1) if is_eval else None
            
            status = "Pending"
            if is_eval:
                if outcome_att > baseline_att + 2:
                    status = "Improved"
                elif outcome_att < baseline_att - 2:
                    status = "Declined"
                else:
                    status = "No Change"

            inv = Intervention(
                student_id=student.id,
                date=(datetime.datetime.now() - datetime.timedelta(days=random.randint(10, 60))).strftime("%Y-%m-%d"),
                action=action,
                teacher_name=random.choice(TEACHERS),
                notes=f"Periodic check for {s_info['name']}.",
                baseline_attendance=baseline_att,
                baseline_score=baseline_score,
                baseline_meal_pct=round(random.uniform(70, 90), 1),
                baseline_risk_score=baseline_risk,
                outcome_attendance=outcome_att,
                outcome_score=outcome_score,
                outcome_risk_score=outcome_risk,
                outcome_status=status,
                is_evaluated=is_eval
            )
            db.add(inv)
    
    db.commit()
    print("Database extended with rich mock data (10 students, multiple interventions each).")
    db.close()

if __name__ == "__main__":
    seed()
