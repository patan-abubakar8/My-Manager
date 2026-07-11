from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import Task, TaskSchema

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

class TaskBatchRequest(BaseModel):
    tasks: List[TaskSchema]

@router.get("/project/{projectId}", response_model=List[TaskSchema])
def get_tasks_by_project(projectId: int, db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.project_id == projectId).all()

@router.get("/{id}", response_model=TaskSchema)
def get_task_by_id(id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("", response_model=TaskSchema, status_code=status.HTTP_201_CREATED)
def create_task(task_data: TaskSchema, db: Session = Depends(get_db)):
    task = Task(
        project_id=task_data.project_id,
        title=task_data.title,
        description=task_data.description,
        status=task_data.status,
        priority=task_data.priority,
        due_date=task_data.due_date
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.post("/batch", response_model=List[TaskSchema], status_code=status.HTTP_201_CREATED)
def create_tasks_batch(body: TaskBatchRequest, db: Session = Depends(get_db)):
    if not body.tasks:
        raise HTTPException(status_code=400, detail="At least one task is required")
    created = [Task(project_id=item.project_id, title=item.title, description=item.description,
                    status=item.status, priority=item.priority, due_date=item.due_date)
               for item in body.tasks]
    db.add_all(created)
    db.commit()
    for task in created:
        db.refresh(task)
    return created

@router.put("/{id}", response_model=TaskSchema)
def update_task(id: int, task_data: TaskSchema, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.project_id = task_data.project_id
    task.title = task_data.title
    task.description = task_data.description
    task.status = task_data.status
    task.priority = task_data.priority
    task.due_date = task_data.due_date
    db.commit()
    db.refresh(task)
    return task

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None
