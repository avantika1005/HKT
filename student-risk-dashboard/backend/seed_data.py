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

FIRST_NAMES = ["Arun", "Priya", "Vijay", "Ananya", "Karthik", "Meera", "Rahul", "Sita", "Deepak", "Jasmin", "Sanjay", "Aavya", "Aditya", "Ishani", "Kavya", "Mohan", "Nisha", "Rohan", "Sneha", "Vikram", "Abhishek", "Divya", "Ganesh", "Jyoti", "Kiran", "Madhav", "Nehal", "Pranav", "Riya", "Sahil"]
LAST_NAMES = ["Kumar", "Sharma", "Singh", "Das", "R", "Iyer", "Bose", "Lakshmi", "Raj", "Kaur", "Gupta", "Verma", "Reddy", "Nair", "Patel", "Mehta", "Joshi", "Chopra", "Malhotra", "Kapoor"]
from schools_data import REALISTIC_SCHOOLS
SCHOOL_LIST = REALISTIC_SCHOOLS

GRADES = ["8th", "9th", "10th", "11th", "12th"]
FACTORS_LIST = ["Attendance", "Latest Exam Score", "Distance", "Midday Meal", "Sibling Dropout", "Behavioral", "Financial"]

ACTIONS = [
    "Parent–Teacher Meeting",
    "Attendance Monitoring",
    "Academic Counseling",
    "Peer Mentoring",
    "Extra Tutoring",
    "Weekly Progress Tracking",
    "Home Visit",
    "Scholarship Application",
    "Counselling Session"
]

TEACHERS = ["Admin", "Mr. Rajesh", "Ms. Lakshmi", "Mr. Sivakumar", "Ms. Anitha", "Mr. Murali"]

def seed():
    db = SessionLocal()
    
    print("Clearing existing data...")
    db.query(Intervention).delete()
    db.query(Student).delete()
    db.commit()
    
    num_students = 1000
    print(f"Generating {num_students} student records across {len(SCHOOL_LIST)} schools...")
    
    for i in range(1, num_students + 1):
        s_id = f"STU{1000 + i}"
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        
        # Pick a school from the fixed list to ensure high enrollment per school
        school_info = random.choice(SCHOOL_LIST)
        school = school_info["school_name"]
        district = school_info["district_name"]
        block = school_info["block_name"]
        
        grade = random.choice(GRADES)
        
        # Determine risk level based on some randomized logic
        risk_roll = random.random()
        if risk_roll < 0.15:
            risk = "High"
            num_factors = random.randint(2, 3)
        elif risk_roll < 0.40:
            risk = "Medium"
            num_factors = random.randint(1, 2)
        else:
            risk = "Low"
            num_factors = 0
            
        factors = ", ".join(random.sample(FACTORS_LIST, num_factors)) if num_factors > 0 else ""
        
        att = round(random.uniform(55, 98), 1)
        score = round(random.uniform(35, 95), 1)
        dist = round(random.uniform(0.2, 8.0), 1)
        meal_pct = round(random.uniform(40, 100), 1)
        risk_score = round(random.uniform(10, 95), 1)
        
        # Adjust risk_level to match random score for consistency
        if risk_score > 75: risk = "High"
        elif risk_score > 40: risk = "Medium"
        else: risk = "Low"

        # Add explanation
        explanation = generate_explanation(
            student_name=name,
            score=int(risk_score),
            level=risk,
            top_factors=factors,
            attendance=att,
            exams=score,
            class_avg={"attendance": 82, "score": 68, "distance": 2.2, "meal": 75},
            benchmarks={"attendance": 88, "score": 74, "distance": 2.5, "meal": 85}
        )

        student = Student(
            student_id=s_id,
            name=name,
            school_name=school,
            block_name=block,
            district_name=district,
            grade_class=grade,
            attendance_pct=att,
            latest_exam_score=score,
            previous_exam_score=round(score - random.uniform(-10, 15), 1),
            distance_km=dist,
            meal_participation_pct=meal_pct,
            sibling_dropout=random.choice([True, False, False, False]), # 25% chance
            risk_score=risk_score,
            risk_level=risk,
            top_factors=factors,
            llm_explanation=explanation
        )
        db.add(student)
        db.commit()
        db.refresh(student)



        # Generate interventions for some students (higher probability for High/Medium risk)
        inv_prob = 0.9 if risk == "High" else (0.75 if risk == "Medium" else 0.35)
        
        if random.random() < inv_prob:
            num_inv = random.randint(1, 7)
            for j in range(num_inv):
                action = random.choice(ACTIONS)
                is_eval = random.random() < 0.7 # 70% chance of being evaluated
                
                baseline_att = round(random.uniform(50, 85), 1)
                baseline_score = round(random.uniform(30, 75), 1)
                baseline_risk = round(random.uniform(40, 95), 1)
                
                # Outcome (if evaluated)
                outcome_att = round(baseline_att + random.uniform(-8, 20), 1) if is_eval else None
                outcome_score = round(baseline_score + random.uniform(-10, 25), 1) if is_eval else None
                outcome_risk = round(baseline_risk - random.uniform(-5, 30), 1) if is_eval else None
                
                status = "Pending"
                if is_eval:
                    if outcome_att > baseline_att + 3:
                        status = "Improved"
                    elif outcome_att < baseline_att - 3:
                        status = "Declined"
                    else:
                        status = "No Change"

                inv = Intervention(
                    student_id=student.id,
                    date=(datetime.datetime.now() - datetime.timedelta(days=random.randint(5, 120))).strftime("%Y-%m-%d"),
                    action=action,
                    teacher_name=random.choice(TEACHERS),
                    notes=f"Automated risk mitigation step for {name}. Focus on {action}.",
                    baseline_attendance=baseline_att,
                    baseline_score=baseline_score,
                    baseline_meal_pct=round(random.uniform(60, 95), 1),
                    baseline_risk_score=baseline_risk,
                    outcome_attendance=outcome_att,
                    outcome_score=outcome_score,
                    outcome_risk_score=outcome_risk,
                    outcome_status=status,
                    is_evaluated=is_eval
                )
                db.add(inv)
        
        if i % 100 == 0:
            db.commit()
            print(f"Processed {i} students...")
    
    db.commit()
    print(f"Database successfully seeded with {num_students} students across {len(SCHOOL_LIST)} schools.")
    db.close()

if __name__ == "__main__":
    seed()
