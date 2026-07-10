from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend_py.src.infrastructure.database import get_db
from backend_py.src.domain.models import Idea, IdeaSchema

router = APIRouter(prefix="/api/v1/ideas", tags=["ideas"])

@router.get("", response_model=List[IdeaSchema])
def get_all_ideas(db: Session = Depends(get_db)):
    return db.query(Idea).order_by(Idea.id.desc()).all()

@router.get("/{id}", response_model=IdeaSchema)
def get_idea_by_id(id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea

@router.post("", response_model=IdeaSchema, status_code=status.HTTP_201_CREATED)
def create_idea(idea_data: IdeaSchema, db: Session = Depends(get_db)):
    idea = Idea(
        title=idea_data.title,
        description=idea_data.description,
        category=idea_data.category or "Tech",
        status=idea_data.status or "Idea"
    )
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea

@router.put("/{id}", response_model=IdeaSchema)
def update_idea(id: int, idea_data: IdeaSchema, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    idea.title = idea_data.title
    idea.description = idea_data.description
    idea.category = idea_data.category or idea.category
    idea.status = idea_data.status or idea.status
    db.commit()
    db.refresh(idea)
    return idea

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_idea(id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    db.delete(idea)
    db.commit()
    return None
