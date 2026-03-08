import csv
import random

schools = [
    ("Kanchipuram Govt Model School", "Kanchipuram Central", "Kanchipuram"),
    ("Walajabad Panchayat Union School", "Walajabad", "Kanchipuram"),
    ("Sriperumbudur Excellence Academy", "Sriperumbudur", "Kanchipuram"),
    ("Uthiramerur Higher Secondary", "Uthiramerur", "Kanchipuram"),
    ("Kundrathur Zilla Parishad School", "Kundrathur", "Kanchipuram"),
    ("Chennai Public School", "Alandur", "Chennai"),
    ("Madurai Central School", "Madurai West", "Madurai"),
    ("Coimbatore Excellence", "Perur", "Coimbatore"),
    ("Salem Govt School", "Salem Rural", "Salem"),
    ("Trichy Model School", "Manikandam", "Tiruchirappalli"),
    ("Tirunelveli High School", "Palayamkottai", "Tirunelveli"),
    ("Vellore Heritage School", "Katpadi", "Vellore"),
    ("Nilgiris Mountain School", "Ooty", "Nilgiris"),
    ("Thanjavur Delta Academy", "Thanjavur", "Thanjavur"),
    ("Kanyakumari Coastal Govt", "Agastheeswaram", "Kanyakumari"),
    ("Erode Textile City School", "Erode", "Erode"),
    ("Thoothukudi Port Academy", "Thoothukudi", "Thoothukudi"),
    ("Dindigul Fort High", "Dindigul", "Dindigul"),
    ("Tiruvannamalai Heritage", "Thiruvannamalai", "Tiruvannamalai"),
    ("Cuddalore Coast School", "Cuddalore", "Cuddalore"),
    ("Karur Kongu Academy", "Karur", "Karur"),
    ("Krishnagiri Border School", "Krishnagiri", "Krishnagiri")
]

first_names = ["Aarav", "Priya", "Rohan", "Sneha", "Anjali", "Vikram", "Divya", "Siddharth", "Arjun", "Pooja", "Murali", "Aditi", "Rahul", "Vignesh", "Nandini", "Harsh", "Swati", "Vishal", "Ananya", "Gaurav", "Muthu", "Kamala", "Surya", "Meena", "Vijay", "Anitha", "Siva", "Geetha", "Selvam", "Radha", "Kumar", "Nithya", "Ganesh", "Kavitha", "Ramesh", "Uma", "Raja", "Babu", "Valli", "Suresh", "Jyothi", "Murugan", "Aruna", "Prakash", "Devi", "Vasanth", "Sindhu"]
last_names = ["Sharma", "Patel", "Mehta", "Iyer", "Singh", "Nair", "Reddy", "Joshi", "Gupta", "Desai", "Krish", "Rao", "Kumar", "Pillai", "S", "M", "T", "G", "R", "N", "V", "K", "D", "B", "C"]

header = [
    "Student ID", "Student Name", "Class / Grade", "Attendance Percentage", 
    "Latest Exam Score", "Previous Exam Score", "Distance from School (km)", 
    "Midday Meal Participation (Yes/No)", "Midday Meal Participation Rate (%)",
    "Sibling Dropout History (Yes/No)", "School Name", "Block Name", "District Name"
]

data = []
for i in range(1, 251):
    student_id = 10000 + i
    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    grade = f"Grade {random.randint(6, 12)}"
    attendance = random.randint(40, 98)
    latest_score = random.randint(25, 95)
    prev_score = latest_score + random.randint(-10, 10)
    prev_score = max(0, min(100, prev_score))
    dist = round(random.uniform(0.5, 10.0), 1)
    meal = "Yes" if random.random() > 0.3 else "No"
    meal_rate = random.randint(20, 100) if meal == "Yes" else random.randint(0, 30)
    sibling = "Yes" if random.random() > 0.8 else "No"
    school, block, district = random.choice(schools)
    
    data.append([
        student_id, name, grade, attendance, latest_score, prev_score, 
        dist, meal, meal_rate, sibling, school, block, district
    ])

with open('large_state_students.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(data)

print("Generated large_state_students.csv with 250 students.")
