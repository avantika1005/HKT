import pytest
import requests
from unittest.mock import Mock


def _make_response(status_code=200, json_data=None, text=""):
    resp = Mock()
    resp.status_code = status_code
    resp.text = text
    resp.json.return_value = json_data or {}
    return resp


@pytest.mark.parametrize(
    "student_id,language",
    [
        (1, "Tamil"),
        (2, "English"),
        (1, "Hindi"),
    ],
)
def test_communication(monkeypatch, student_id, language):
    expected_data = {
        "student_name": f"Student {student_id}",
        "language": language,
        "message": "This is a mocked parent communication message.",
    }

    def fake_get(url):
        assert f"/students/{student_id}/parent-communication" in url
        assert f"language={language}" in url
        return _make_response(200, expected_data)

    monkeypatch.setattr(requests, "get", fake_get)

    url = f"http://localhost:8000/api/students/{student_id}/parent-communication?language={language}"
    print(f"Testing for Student ID {student_id} in {language}...")

    response = requests.get(url)
    assert response.status_code == 200

    data = response.json()
    print(f"Student: {data['student_name']}")
    print(f"Language: {data['language']}")
    print("-" * 20)
    print(data['message'])
    print("-" * 20)

    assert data == expected_data


if __name__ == "__main__":
    # Test for a few students and languages
    # Assuming students 1 and 2 exist and are Medium/High risk based on sample data
    test_communication(1, "Tamil")
    test_communication(2, "English")
    test_communication(1, "Hindi")
