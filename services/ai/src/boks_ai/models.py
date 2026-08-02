from pydantic import BaseModel, Field

MAX_INPUT_CHARACTERS = 2000
MAX_CORPUS_DOCUMENTS = 64


class KnowledgeDocument(BaseModel):
    source_id: str
    version: str
    title: str
    content: str


class IntentDecision(BaseModel):
    intercept: bool
    intent: str
    reason: str


class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_INPUT_CHARACTERS)
    child_grade: str | None = None
    documents: list[KnowledgeDocument] = Field(
        default_factory=list, max_length=MAX_CORPUS_DOCUMENTS
    )


class Citation(BaseModel):
    source_id: str
    title: str
    version: str


class ChatResponse(BaseModel):
    content: str
    citations: list[Citation]
    intent: str
    intercepted: bool


class ClassifyRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_INPUT_CHARACTERS)


class AuditEvent(BaseModel):
    event_id: str
    intent: str
    intercepted: bool
    citation_ids: list[str]
    llm_used: bool
    created_at: str
