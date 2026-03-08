import json
import os

class InterventionRankEngine:
    def __init__(self, library_path=None):
        if library_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            self.library_path = os.path.join(base_dir, 'intervention_library.json')
        else:
            self.library_path = library_path
            
        self.library = self._load_library()

    def _load_library(self):
        if not os.path.exists(self.library_path):
            return []
        with open(self.library_path, 'r') as f:
            try:
                return json.load(f)
            except:
                return []

    def _get_library_item(self, name):
        for item in self.library:
            if item['name'] == name:
                return item
        return None

    def get_recommendations(self, student):
        recommendations = []

        # Logic to map risk factors to Library Items
        
        # 1. Attendance critical
        if hasattr(student, 'attendance_pct') and student.attendance_pct < 65:
            lib_item = self._get_library_item("Home Visit")
            if lib_item:
                recommendations.append({
                    "type": lib_item['name'],
                    "reason": f"Attendance is critical at {student.attendance_pct}%",
                    "priority": 0,
                    "evidence": lib_item['evidence_source']
                })

        # 2. Score drop
        if hasattr(student, 'latest_exam_score') and hasattr(student, 'previous_exam_score'):
            drop = student.previous_exam_score - student.latest_exam_score
            if drop > 15:
                lib_item = self._get_library_item("Counselling Session")
                if lib_item:
                    recommendations.append({
                        "type": lib_item['name'],
                        "reason": f"Exam score dropped significantly by {drop} points",
                        "priority": 0,
                        "evidence": lib_item['evidence_source']
                    })

        # 3. Failing
        if hasattr(student, 'latest_exam_score') and student.latest_exam_score < 40:
            lib_item = self._get_library_item("Academic Support Program")
            if lib_item:
                recommendations.append({
                    "type": lib_item['name'],
                    "reason": "Student is failing in latest exams",
                    "priority": 0,
                    "evidence": lib_item['evidence_source']
                })

        # 4. Distance
        if hasattr(student, 'distance_km'):
            if student.distance_km > 5:
                lib_item = self._get_library_item("Scholarship Application")
                if lib_item:
                    recommendations.append({
                        "type": lib_item['name'],
                        "reason": f"Long distance from school ({student.distance_km} km) increases dropout risk",
                        "priority": 1,
                        "evidence": lib_item['evidence_source']
                    })

        # 5. Low meal participation
        if hasattr(student, 'meal_participation_pct') and student.meal_participation_pct < 50:
            lib_item = self._get_library_item("Parent Meeting")
            if lib_item:
                recommendations.append({
                    "type": lib_item['name'],
                    "reason": f"Low midday meal participation ({student.meal_participation_pct}%)",
                    "priority": 1,
                    "evidence": lib_item['evidence_source']
                })

        # 6. Sibling dropout
        if hasattr(student, 'sibling_dropout') and student.sibling_dropout:
            lib_item = self._get_library_item("Peer Buddy Assignment")
            if lib_item:
                recommendations.append({
                    "type": lib_item['name'],
                    "reason": "Family history of early dropout (sibling)",
                    "priority": 1,
                    "evidence": lib_item['evidence_source']
                })

        # Ranking Logic
        ranked = sorted(recommendations, key=lambda x: x['priority'])
        
        unique_recommendations = []
        seen_types = set()
        for r in ranked:
            if r['type'] not in seen_types:
                unique_recommendations.append(r)
                seen_types.add(r['type'])

        final_list = []
        for i, r in enumerate(unique_recommendations[:3]):
            final_list.append({
                "rank": i + 1,
                "type": r['type'],
                "reason": r['reason'],
                "evidence": r.get('evidence', '')
            })

        return final_list

intervention_engine = InterventionRankEngine()

