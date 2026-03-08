import json
import os

class GovernmentSchemeMatcher:
    def __init__(self, schemes_file=None):
        if schemes_file is None:
            # Look in the same directory as this file
            base_dir = os.path.dirname(os.path.abspath(__file__))
            self.schemes_file = os.path.join(base_dir, 'schemes.json')
        else:
            self.schemes_file = schemes_file
        print(f"DEBUG: Initializing Scheme Matcher with file: {self.schemes_file}")
        self.schemes = self._load_schemes()
        print(f"DEBUG: Loaded {len(self.schemes)} schemes.")

    def _load_schemes(self):
        if not os.path.exists(self.schemes_file):
            print(f"ERROR: Schemes file NOT FOUND at {self.schemes_file}")
            return []
        with open(self.schemes_file, 'r') as f:
            try:
                data = json.load(f)
                return data
            except json.JSONDecodeError as e:
                print(f"ERROR: Failed to decode JSON from {self.schemes_file}: {e}")
                return []

    def get_eligible_schemes(self, student):
        eligible = []
        for scheme in self.schemes:
            criteria = scheme.get('criteria')
            if not criteria:
                continue

            try:
                locals_dict = {
                    'distance_km': getattr(student, 'distance_km', 0),
                    'latest_exam_score': getattr(student, 'latest_exam_score', 0),
                    'midday_meal': getattr(student, 'midday_meal', False),
                    'sibling_dropout': getattr(student, 'sibling_dropout', False),
                    'attendance_pct': getattr(student, 'attendance_pct', 0),
                    'True': True,
                    'False': False
                }
                
                if eval(criteria, {"__builtins__": None}, locals_dict):
                    eligible.append({
                        "scheme": scheme['scheme'],
                        "reason": scheme.get('description', "Student meets eligibility criteria")
                    })
            except Exception as e:
                # print(f"ERROR: Evaluating scheme {scheme['scheme']}: {e}")
                continue
                
        return eligible

scheme_matcher = GovernmentSchemeMatcher()
