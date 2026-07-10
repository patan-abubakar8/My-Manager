import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from fastapi.testclient import TestClient
from backend_py.src.server import app

client = TestClient(app)

def test_github_import_own():
    print("Testing GitHub Import for Own Project...")
    payload = {
        "github_url": "https://github.com/fastapi/fastapi",
        "is_own_project": True
    }
    response = client.post("/api/v1/projects/import-github", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response JSON: {response.json()}")
    assert response.status_code == 201
    data = response.json()
    assert data["is_own_project"] is True
    assert data["github_summary"] != ""
    assert data["recreate_steps"] == "" or data["recreate_steps"] is None
    print("Own Project Import PASSED!\n")

def test_github_import_others():
    print("Testing GitHub Import for Others Project...")
    payload = {
        "github_url": "https://github.com/fastapi/fastapi",
        "is_own_project": False
    }
    response = client.post("/api/v1/projects/import-github", json=payload)
    print(f"Status Code: {response.status_code}")
    # print(f"Response JSON: {response.json()}")
    assert response.status_code == 201
    data = response.json()
    assert data["is_own_project"] is False
    assert len(data["recreate_steps"]) > 50
    assert data["github_summary"] == "" or data["github_summary"] is None
    print("Others Project Import PASSED!\n")

if __name__ == "__main__":
    # Ensure tables are ready
    from backend_py.src.infrastructure.database import create_tables
    create_tables()
    
    try:
        test_github_import_own()
    except Exception as e:
        print(f"Own test failed: {e}")
        
    try:
        test_github_import_others()
    except Exception as e:
        print(f"Others test failed: {e}")
