from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import os
from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError
from supabase import create_client, Client

from auth import AuthConfigurationError, SupabaseJWTVerifier
from backup_stream import fetch_backup_tables_sequential, iter_backup_zip_chunks
from memory_watchdog import MemoryWatchdog
from request_memory_watchdog import RequestMemoryWatchdog, should_profile_path
from notes_sync import DEFAULT_BATCH_CHUNK_SIZE, build_notes_delta_or_filter, chunk_note_payloads
from memory_profile import MemoryProfiler
from remote_mutation import (
    MAX_REQUEST_BYTES,
    RemoteMutationService,
    RemoteMutationTransportError,
    SupabaseRpcGateway,
    rejected_response,
)

load_dotenv()

app = FastAPI()

_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory_watchdog = MemoryWatchdog()
request_memory_watchdog = RequestMemoryWatchdog()

_recovery_mode_raw = os.getenv("ABSINTHE_RECOVERY_MODE", "active").strip().lower()
RECOVERY_MODE_ACTIVE = _recovery_mode_raw not in {"disabled"}
K323_REMOTE_MUTATION_ENABLED = os.getenv("K323_REMOTE_MUTATION_ENABLED", "disabled").strip().lower() == "enabled"
K323_PROJECT_SCOPE = os.getenv("K323_PROJECT_SCOPE", "").strip()


@app.middleware("http")
async def memory_watchdog_middleware(request, call_next):
    path = request.url.path
    request_id = request_memory_watchdog.new_request_id()
    profiler = MemoryProfiler() if should_profile_path(path) else None
    if profiler:
        profiler.mark_before()
    memory_watchdog.sample_if_due(context=f"{request.method} {path} id={request_id}")
    response = await call_next(request)
    memory_watchdog.sample_if_due(context=f"after {request.method} {path} id={request_id}")
    if profiler:
        request_memory_watchdog.finalize(request_id, request.method, path, profiler)
    if profiler and should_profile_path(path):
        response.headers["X-Request-Id"] = request_id
    return response

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip() or None
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "\n🚨 [보안 오류] .env 파일을 찾을 수 없거나 키가 비어있습니다!\n"
        "1. backend 폴더 안에 '.env' 파일이 정확히 존재하는지 확인하세요.\n"
        "2. 윈도우 확장자 숨김 기능 때문에 파일 이름이 '.env.txt'로 되어있지 않은지 확인하세요.\n"
        "3. .env 내용에 띄어쓰기나 따옴표가 없는지 확인하세요.\n"
        "   (예: SUPABASE_URL=https://..., SUPABASE_KEY=...)\n"
        "4. ES256 프로젝트는 JWKS로 자동 검증됩니다. 레거시 HS256만 SUPABASE_JWT_SECRET이 필요합니다."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
K323_SUPABASE_CLIENT: Client | None = None

# ==========================================
# 🔐 JWT 인증: Authorization 헤더에서 user_id 추출 (local verify)
# ==========================================
security = HTTPBearer()

try:
    jwt_verifier = SupabaseJWTVerifier(supabase_url=SUPABASE_URL, jwt_secret=SUPABASE_JWT_SECRET)
except AuthConfigurationError as e:
    raise ValueError(str(e)) from e

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        return jwt_verifier.verify_token(token)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def get_remote_mutation_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """K-323 auth dependency with a bounded, non-diagnostic failure response."""
    try:
        return jwt_verifier.verify_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def verify_owner(resource_user_id: str, current_user_id: str):
    if resource_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")


def _remote_mutation_validation_code(payload: object) -> str:
    if not isinstance(payload, dict):
        return "INVALID_MUTATION"
    if payload.get("protocolVersion") != 1:
        return "INVALID_PROTOCOL_VERSION"
    if payload.get("domain") != "notes":
        return "UNSUPPORTED_DOMAIN"
    return "INVALID_MUTATION"


def get_k323_supabase_client() -> Client:
    global K323_SUPABASE_CLIENT
    if K323_SUPABASE_CLIENT is not None:
        return K323_SUPABASE_CLIENT
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("k323_service_role_unavailable")
    K323_SUPABASE_CLIENT = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return K323_SUPABASE_CLIENT


@app.middleware("http")
async def k323_request_size_middleware(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/api/sync/v1/mutations":
        content_length = request.headers.get("content-length")
        if content_length is None or not content_length.isdigit() or int(content_length) > MAX_REQUEST_BYTES:
            response = rejected_response("mut.invalid", "k322." + "0" * 64, "INVALID_MUTATION")
            return JSONResponse(status_code=413, content=response.model_dump(by_alias=True))
    return await call_next(request)


@app.post("/api/sync/v1/mutations")
async def apply_remote_mutation(
    request: Request,
    payload: dict,
    user_id: str = Depends(get_remote_mutation_user),
):
    """Apply one validated K-322 mutation through one transactional PostgreSQL RPC."""
    if not K323_REMOTE_MUTATION_ENABLED:
        raise HTTPException(status_code=423, detail="K323_REMOTE_MUTATION_DISABLED")
    content_length = request.headers.get("content-length")
    if content_length is None or not content_length.isdigit() or int(content_length) > MAX_REQUEST_BYTES:
        response = rejected_response("mut.invalid", "k322." + "0" * 64, "INVALID_MUTATION")
        return JSONResponse(status_code=413, content=response.model_dump(by_alias=True))
    try:
        service = RemoteMutationService(SupabaseRpcGateway(get_k323_supabase_client()), K323_PROJECT_SCOPE)
    except Exception:
        response = rejected_response("mut.invalid", "k322." + "0" * 64, "TRANSACTION_FAILED", retryable=True)
        return JSONResponse(status_code=503, content=response.model_dump(by_alias=True))
    try:
        mutation = service.parse(payload)
    except ValueError:
        response = rejected_response(
            "mut.invalid",
            "k322." + "0" * 64,
            _remote_mutation_validation_code(payload),
        )
        return JSONResponse(status_code=400, content=response.model_dump(by_alias=True))
    try:
        response = service.apply(mutation, user_id)
    except RemoteMutationTransportError as error:
        return JSONResponse(status_code=503, content=error.response.model_dump(by_alias=True))
    if response.error_code == "IDEMPOTENCY_KEY_MISMATCH":
        return JSONResponse(status_code=400, content=response.model_dump(by_alias=True))
    return response.model_dump(by_alias=True)

# ==========================================
# Pydantic Models (user_id 제거 — 토큰에서 추출)
# ==========================================
class ScheduleCreate(BaseModel):
    date: str; text: str; start_time: str; end_time: str
    is_dday: bool = False; color: str = "gold"; category: str = "Study"; end_next_day: bool = False

class ScheduleUpdate(BaseModel):
    text: str; start_time: str; end_time: str
    is_dday: bool = False; color: str = "gold"; category: str = "Study"

class TodoCreate(BaseModel):
    date: str; text: str

class TodoTextUpdate(BaseModel):
    text: str

class RoutineCreate(BaseModel):
    text: str; created_date: str = ''

class RoutineUpdate(BaseModel):
    text: str

class StatusUpdate(BaseModel):
    done: bool

class RoutineLogUpdate(BaseModel):
    routine_id: str; date: str; done: bool

class ExerciseBlockCreate(BaseModel):
    name: str; type: str; tags: list = Field(default_factory=list)
    cardio_mode: str = 'both'  # 'time' | 'distance' | 'both'

class HealthRoutineCreate(BaseModel):
    day_name: str; blocks: list

class WorkoutLogCreate(BaseModel):
    date: str; block_id: str; sets: list; sort_order: int = 0

class InbodyLogCreate(BaseModel):
    date: str; weight: float; smm: float; pbf: float

class WeeklyScheduleCreate(BaseModel):
    day: int; title: str; start_time: str; end_time: str; color: str

class ProteinProfileCreate(BaseModel):
    weight: float; goal: str; activity: str; daily_target_g: int

class ProteinSourceCreate(BaseModel):
    name: str; source_type: str          # 'fixed' | 'per100g'
    category: str = '기타'
    protein_per_serving: float | None = None
    protein_per_100g: float | None = None

class ProteinIntakeCreate(BaseModel):
    date: str; source_id: str | None = None; amount_g: float; protein_g: float
    note: str | None = None

# ==========================================
# Reset
# ==========================================
@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/ping")
async def ping():
    return {"pong": True}

@app.delete("/api/reset")
async def reset_all_data(user_id: str = Depends(get_current_user)):
    if RECOVERY_MODE_ACTIVE:
        raise HTTPException(status_code=423, detail="Data recovery mode is active")
    # /api/restore가 다루는 12개 테이블과 동일하게 맞춤.
    # 삭제 순서: 자식 테이블(logs, notes) → 부모 테이블(folders, routines, blocks) 순으로
    # FK 제약이 있는 경우를 대비해 의존 관계 역순으로 삭제.
    supabase.table("routine_logs").delete().eq("user_id", user_id).execute()
    supabase.table("routine_exceptions").delete().eq("user_id", user_id).execute()
    supabase.table("workout_logs").delete().eq("user_id", user_id).execute()
    supabase.table("inbody_logs").delete().eq("user_id", user_id).execute()
    supabase.table("schedules").delete().eq("user_id", user_id).execute()
    supabase.table("todos").delete().eq("user_id", user_id).execute()
    supabase.table("weekly_schedules").delete().eq("user_id", user_id).execute()
    supabase.table("notes").delete().eq("user_id", user_id).execute()
    supabase.table("note_folders").delete().eq("user_id", user_id).execute()
    supabase.table("routines").delete().eq("user_id", user_id).execute()
    supabase.table("exercise_blocks").delete().eq("user_id", user_id).execute()
    supabase.table("health_routines").delete().eq("user_id", user_id).execute()
    supabase.table("recipes").delete().eq("user_id", user_id).execute()
    return {"message": "All user data has been permanently deleted."}

# ==========================================
# Schedules
# ==========================================
@app.get("/api/schedules")
async def get_schedules(date: str, user_id: str = Depends(get_current_user)):
    return supabase.table("schedules").select("*").eq("user_id", user_id).eq("date", date).execute().data or []

@app.get("/api/schedules/dates")
async def get_marked_dates(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    res = supabase.table("schedules").select("date").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).execute()
    return list(set(item['date'] for item in (res.data or [])))

@app.get("/api/schedules/range")
async def get_schedules_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """Analytics 기간별 일정 조회"""
    return supabase.table("schedules").select("*").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).execute().data or []

@app.get("/api/schedules/ddays")
async def get_ddays(user_id: str = Depends(get_current_user)):
    return supabase.table("schedules").select("*").eq("user_id", user_id).eq("is_dday", True).execute().data or []

@app.post("/api/schedules")
async def create_schedule(schedule: ScheduleCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("schedules").insert({"user_id": user_id, **schedule.model_dump()}).execute().data

@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, schedule: ScheduleUpdate, user_id: str = Depends(get_current_user)):
    row = supabase.table("schedules").select("user_id").eq("id", schedule_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("schedules").update(schedule.model_dump()).eq("id", schedule_id).execute().data

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("schedules").select("user_id").eq("id", schedule_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("schedules").delete().eq("id", schedule_id).execute().data

# ==========================================
# Todos
# ==========================================
@app.get("/api/todos")
async def get_todos(date: str, user_id: str = Depends(get_current_user)):
    return supabase.table("todos").select("*").eq("user_id", user_id).eq("date", date).order("created_at").execute().data or []

@app.get("/api/todos/range")
async def get_todos_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """CSV 내보내기용 기간별 투두 조회"""
    return supabase.table("todos").select("*").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).order("date").order("created_at").execute().data or []

@app.post("/api/todos")
async def create_todo(todo: TodoCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("todos").insert({"user_id": user_id, **todo.model_dump()}).execute().data

@app.put("/api/todos/{todo_id}")
async def toggle_todo(todo_id: str, payload: StatusUpdate, user_id: str = Depends(get_current_user)):
    row = supabase.table("todos").select("user_id").eq("id", todo_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("todos").update({"done": payload.done}).eq("id", todo_id).execute().data

@app.put("/api/todos_text/{todo_id}")
async def update_todo_text(todo_id: str, payload: TodoTextUpdate, user_id: str = Depends(get_current_user)):
    """투두 텍스트 수정 (done 상태는 PUT /api/todos/{id}로 분리)"""
    row = supabase.table("todos").select("user_id").eq("id", todo_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("todos").update({"text": payload.text}).eq("id", todo_id).execute().data

@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("todos").select("user_id").eq("id", todo_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("todos").delete().eq("id", todo_id).execute().data

# ==========================================
# Routines
# ==========================================
@app.get("/api/routines_with_logs")
async def get_routines_with_logs(date: str, user_id: str = Depends(get_current_user)):
    all_routines = supabase.table("routines").select("*").eq("user_id", user_id).execute().data or []
    logs = supabase.table("routine_logs").select("*").eq("user_id", user_id).eq("date", date).execute().data or []
    log_dict = {str(log["routine_id"]): log.get("done", False) for log in logs}
    logged_ids = {str(log["routine_id"]) for log in logs}  # 해당 날짜에 로그가 있는 루틴 ID

    # created_date 필터 먼저 적용
    routines = [r for r in all_routines if not r.get("created_date") or r["created_date"] <= date]

    # is_active=True  → 항상 표시
    # is_active=False → deleted_at 이전 날짜에만 표시 (삭제일 당일 포함 안 함)
    def should_show(r):
        if r.get("is_active", True):
            return True
        deleted_at = r.get("deleted_at")
        if not deleted_at:
            return False  # deleted_at 없으면 숨김
        return date < deleted_at  # 삭제일 이전 날짜에만 표시

    routines = [r for r in routines if should_show(r)]

    # 해당 날짜가 예외일인지 확인
    exceptions = supabase.table("routine_exceptions").select("start_date, end_date").eq("user_id", user_id).lte("start_date", date).gte("end_date", date).execute().data or []
    is_exception_day = len(exceptions) > 0
    return [{"id": str(r["id"]), "text": r.get("text", ""), "done": log_dict.get(str(r["id"]), False), "is_active": r.get("is_active", True), "is_exception_day": is_exception_day} for r in routines]

@app.get("/api/routines/range")
async def get_routines_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """CSV 내보내기용 기간별 루틴 로그 조회 (날짜별 done 상태 포함)"""
    routines = supabase.table("routines").select("id, text, is_active").eq("user_id", user_id).execute().data or []
    logs = supabase.table("routine_logs").select("routine_id, date, done").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).execute().data or []
    exc_rows = supabase.table("routine_exceptions").select("start_date, end_date").eq("user_id", user_id).execute().data or []
    # 예외일 날짜 집합 생성
    from datetime import date as date_cls, timedelta
    exception_dates: set = set()
    for exc in exc_rows:
        d = date_cls.fromisoformat(exc["start_date"])
        end = date_cls.fromisoformat(exc["end_date"])
        while d <= end:
            exception_dates.add(d.isoformat())
            d += timedelta(days=1)
    # (routine_id, date) → done 매핑
    log_map = {(str(l["routine_id"]), l["date"]): l["done"] for l in logs}
    routine_map = {str(r["id"]): r for r in routines}
    result = []
    for log in logs:
        routine = routine_map.get(str(log["routine_id"]))
        if not routine:
            continue
        if log["date"] in exception_dates:
            continue
        # 삭제된 루틴: deleted_at 이후 날짜의 로그는 통계에서 제외
        deleted_at = routine.get("deleted_at")
        if deleted_at and log["date"] >= deleted_at:
            continue
        result.append({
            "date": log["date"],
            "text": routine["text"],
            "done": log_map.get((str(log["routine_id"]), log["date"]), False),
            "is_active": routine.get("is_active", True),
        })
    result.sort(key=lambda x: x["date"])
    return result

@app.post("/api/routines")
async def create_routine(routine: RoutineCreate, user_id: str = Depends(get_current_user)):
    from datetime import date as dt_date
    data = routine.model_dump()
    if not data.get("created_date"):
        data["created_date"] = str(dt_date.today())
    return supabase.table("routines").insert({"user_id": user_id, **data}).execute().data

@app.post("/api/routine_logs")
async def toggle_routine_log(log: RoutineLogUpdate, user_id: str = Depends(get_current_user)):
    existing = supabase.table("routine_logs").select("*").eq("routine_id", log.routine_id).eq("date", log.date).execute().data
    if existing:
        return supabase.table("routine_logs").update({"done": log.done}).eq("id", existing[0]["id"]).execute().data
    else:
        return supabase.table("routine_logs").insert({"user_id": user_id, **log.model_dump()}).execute().data

@app.put("/api/routines/{routine_id}")
async def update_routine_text(routine_id: str, routine: RoutineUpdate, user_id: str = Depends(get_current_user)):
    """루틴 텍스트 수정"""
    row = supabase.table("routines").select("user_id").eq("id", routine_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("routines").update({"text": routine.text}).eq("id", routine_id).execute().data

@app.delete("/api/routines/{routine_id}")
async def delete_routine(routine_id: str, user_id: str = Depends(get_current_user)):
    """소프트 삭제 — is_active=False + deleted_at 기록, 과거 로그 보존"""
    from datetime import date as date_cls
    row = supabase.table("routines").select("user_id").eq("id", routine_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("routines").update({
        "is_active": False,
        "deleted_at": str(date_cls.today()),
    }).eq("id", routine_id).execute().data

# ==========================================
# Exercise Blocks
# ==========================================
@app.get("/api/blocks")
async def get_blocks(user_id: str = Depends(get_current_user)):
    return supabase.table("exercise_blocks").select("*").eq("user_id", user_id).execute().data or []

@app.post("/api/blocks")
async def create_block(block: ExerciseBlockCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("exercise_blocks").insert({"user_id": user_id, **block.model_dump()}).execute().data

@app.put("/api/blocks/{block_id}")
async def update_block(block_id: str, block: ExerciseBlockCreate, user_id: str = Depends(get_current_user)):
    row = supabase.table("exercise_blocks").select("user_id").eq("id", block_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("exercise_blocks").update({"name": block.name, "type": block.type, "tags": block.tags, "cardio_mode": block.cardio_mode}).eq("id", block_id).execute().data

@app.delete("/api/blocks/{block_id}")
async def delete_block(block_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("exercise_blocks").select("user_id").eq("id", block_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("exercise_blocks").delete().eq("id", block_id).execute().data

# ==========================================
# Health Routines
# ==========================================
@app.get("/api/health_routines")
async def get_health_routines(user_id: str = Depends(get_current_user)):
    return supabase.table("health_routines").select("*").eq("user_id", user_id).execute().data or []

@app.post("/api/health_routines")
async def save_health_routine(routine: HealthRoutineCreate, user_id: str = Depends(get_current_user)):
    existing = supabase.table("health_routines").select("*").eq("user_id", user_id).eq("day_name", routine.day_name).execute().data
    if existing:
        return supabase.table("health_routines").update({"blocks": routine.blocks}).eq("id", existing[0]["id"]).execute().data
    else:
        return supabase.table("health_routines").insert({"user_id": user_id, **routine.model_dump()}).execute().data

# ==========================================
# Workouts
# ==========================================
@app.get("/api/workouts")
async def get_workouts(date: str, user_id: str = Depends(get_current_user)):
    return supabase.table("workout_logs").select("*, exercise_blocks(name, type, cardio_mode)").eq("user_id", user_id).eq("date", date).order("sort_order").execute().data or []

@app.get("/api/workouts/range")
async def get_workouts_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """CSV 내보내기용 기간별 운동 기록 조회"""
    return supabase.table("workout_logs").select("*, exercise_blocks(name, type, cardio_mode)").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).order("date").execute().data or []

@app.get("/api/workouts/prev/{block_id}")
async def get_prev_workout(block_id: str, before_date: str, user_id: str = Depends(get_current_user)):
    """
    특정 블록의 before_date 이전 마지막 세션 + PR 반환.
    HealthView에서 이전 기록 대비 증감 및 PR 표시에 사용.
    """
    rows = (
        supabase.table("workout_logs")
        .select("date, sets")
        .eq("user_id", user_id)
        .eq("block_id", block_id)
        .lt("date", before_date)
        .order("date", desc=True)
        .limit(10)
        .execute()
        .data or []
    )
    if not rows:
        return {"prev_sets": [], "pr_kg": None, "prev_date": None}

    prev = rows[0]
    # PR: 최근 10세션 중 완료된 세트의 최고 무게
    all_kgs = [
        float(s["kg"])
        for r in rows
        for s in (r.get("sets") or [])
        if s.get("done") and s.get("kg") not in (None, "", 0)
    ]
    return {
        "prev_sets": prev.get("sets", []),
        "prev_date": prev.get("date"),
        "pr_kg": max(all_kgs) if all_kgs else None,
    }

@app.post("/api/workouts")
async def save_workout(log: WorkoutLogCreate, user_id: str = Depends(get_current_user)):
    existing = supabase.table("workout_logs").select("id").eq("user_id", user_id).eq("date", log.date).eq("block_id", log.block_id).execute().data
    if existing:
        # 중복 행이 여러 개일 수 있으므로 모두 삭제 후 재insert — sort_order 확실히 반영
        for row in existing:
            supabase.table("workout_logs").delete().eq("id", row["id"]).execute()
    return supabase.table("workout_logs").insert({"user_id": user_id, **log.model_dump()}).execute().data

@app.delete("/api/workouts/{log_id}")
async def delete_workout(log_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("workout_logs").select("user_id").eq("id", log_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("workout_logs").delete().eq("id", log_id).execute().data

# ==========================================
# Protein Tracker — Profile / Sources / Intake
# ==========================================

# ── 프로필 (목표 설정, user당 1행 upsert) ──
@app.get("/api/protein_profile")
async def get_protein_profile(user_id: str = Depends(get_current_user)):
    row = supabase.table("protein_profiles").select("*").eq("user_id", user_id).maybe_single().execute().data
    return row or {}

@app.post("/api/protein_profile")
async def save_protein_profile(payload: ProteinProfileCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("protein_profiles").upsert(
        {"user_id": user_id, **payload.model_dump()},
        on_conflict="user_id"
    ).execute().data

# ── 소스 블록 ──
@app.get("/api/protein_sources")
async def get_protein_sources(user_id: str = Depends(get_current_user)):
    return supabase.table("protein_sources").select("*").eq("user_id", user_id).order("created_at").execute().data or []

@app.post("/api/protein_sources")
async def create_protein_source(payload: ProteinSourceCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("protein_sources").insert({"user_id": user_id, **payload.model_dump()}).execute().data

@app.delete("/api/protein_sources/{source_id}")
async def delete_protein_source(source_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("protein_sources").select("user_id").eq("id", source_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("protein_sources").delete().eq("id", source_id).execute().data

@app.put("/api/protein_sources/{source_id}")
async def update_protein_source(source_id: str, payload: ProteinSourceCreate, user_id: str = Depends(get_current_user)):
    row = supabase.table("protein_sources").select("user_id").eq("id", source_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("protein_sources").update(payload.model_dump()).eq("id", source_id).execute().data

# ── 일일 섭취 기록 ──
@app.get("/api/protein_intake")
async def get_protein_intake(date: str, user_id: str = Depends(get_current_user)):
    try:
        data = supabase.table("protein_intake_logs").select("*, protein_sources(name, source_type, category)").eq("user_id", user_id).eq("date", date).order("created_at").execute().data or []
    except Exception:
        # protein_sources에 category 컬럼이 없는 경우 fallback
        data = supabase.table("protein_intake_logs").select("*, protein_sources(name, source_type)").eq("user_id", user_id).eq("date", date).order("created_at").execute().data or []
    return data

@app.post("/api/protein_intake")
async def log_protein_intake(payload: ProteinIntakeCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("protein_intake_logs").insert({"user_id": user_id, **payload.model_dump()}).execute().data

@app.delete("/api/protein_intake/{log_id}")
async def delete_protein_intake(log_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("protein_intake_logs").select("user_id").eq("id", log_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("protein_intake_logs").delete().eq("id", log_id).execute().data


async def get_heatmap(user_id: str = Depends(get_current_user)):
    """
    최근 16주(112일) 날짜별 활동 강도 반환.
    workout_count / routine_done / routine_total / study_mins / is_exception
    프론트에서 level(0~4)로 변환해 GitHub-style 히트맵에 사용.
    """
    from datetime import date, timedelta
    from collections import defaultdict

    today = date.today()
    start = today - timedelta(days=111)
    start_str, end_str = start.isoformat(), today.isoformat()

    workouts_raw = (
        supabase.table("workout_logs").select("date, block_id")
        .eq("user_id", user_id).gte("date", start_str).lte("date", end_str)
        .execute().data or []
    )
    routines_raw = (
        supabase.table("routine_logs").select("date, completed")
        .eq("user_id", user_id).gte("date", start_str).lte("date", end_str)
        .execute().data or []
    )
    schedules_raw = (
        supabase.table("schedules").select("date, category, start_time, end_time")
        .eq("user_id", user_id).gte("date", start_str).lte("date", end_str)
        .execute().data or []
    )
    exceptions_raw = (
        supabase.table("routine_exceptions").select("start_date, end_date")
        .eq("user_id", user_id).execute().data or []
    )

    workout_cnt: dict = defaultdict(int)
    for w in workouts_raw:
        if w.get("date"): workout_cnt[w["date"]] += 1

    routine_done: dict = defaultdict(int)
    routine_total: dict = defaultdict(int)
    for r in routines_raw:
        d = r.get("date")
        if not d: continue
        routine_total[d] += 1
        if r.get("completed"): routine_done[d] += 1

    study_mins: dict = defaultdict(int)
    for s in schedules_raw:
        d = s.get("date")
        if not d or s.get("category", "").lower() not in ("study", "공부"): continue
        try:
            sh, sm = map(int, s["start_time"].split(":")[:2])
            eh, em = map(int, s["end_time"].split(":")[:2])
            study_mins[d] += max(0, (eh * 60 + em) - (sh * 60 + sm))
        except Exception:
            pass

    exception_dates: set = set()
    for exc in exceptions_raw:
        cur = date.fromisoformat(exc["start_date"])
        end_d = date.fromisoformat(exc["end_date"])
        while cur <= end_d:
            exception_dates.add(cur.isoformat())
            cur += timedelta(days=1)

    result = []
    cur = start
    while cur <= today:
        ds = cur.isoformat()
        result.append({
            "date": ds,
            "workout_count": workout_cnt[ds],
            "routine_done": routine_done[ds],
            "routine_total": routine_total[ds],
            "study_mins": study_mins[ds],
            "is_exception": ds in exception_dates,
        })
        cur += timedelta(days=1)
    return result

# ==========================================
# Inbody
# ==========================================
@app.get("/api/inbody/range")
async def get_inbody_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """CSV 내보내기용 기간별 InBody 기록 조회"""
    return supabase.table("inbody_logs").select("*").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).order("date").execute().data or []

@app.get("/api/inbody")
async def get_inbody(date: str, user_id: str = Depends(get_current_user)):
    return supabase.table("inbody_logs").select("*").eq("user_id", user_id).eq("date", date).execute().data or []

@app.post("/api/inbody")
async def save_inbody(log: InbodyLogCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("inbody_logs").upsert({"user_id": user_id, **log.model_dump()}, on_conflict="user_id,date").execute().data

# ==========================================
# Note Folders
# ==========================================
class NoteFolderCreate(BaseModel): id: str; name: str; created_at: int

@app.get("/api/note_folders")
async def get_note_folders(user_id: str = Depends(get_current_user)):
    return supabase.table("note_folders").select("*").eq("user_id", user_id).order("created_at").execute().data or []

@app.post("/api/note_folders")
async def upsert_note_folder(folder: NoteFolderCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("note_folders").upsert({"user_id": user_id, **folder.model_dump()}, on_conflict="id").execute().data

@app.delete("/api/note_folders/{folder_id}")
async def delete_note_folder(folder_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("note_folders").select("user_id").eq("id", folder_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    # 소속 노트 folder_id를 null로 초기화
    supabase.table("notes").update({"folder_id": None}).eq("folder_id", folder_id).execute()
    return supabase.table("note_folders").delete().eq("id", folder_id).execute().data

# ==========================================
# Weekly Schedules
# ==========================================
@app.get("/api/weekly_schedules")
async def get_weekly_schedules(user_id: str = Depends(get_current_user)):
    return supabase.table("weekly_schedules").select("*").eq("user_id", user_id).execute().data or []

@app.post("/api/weekly_schedules")
async def create_weekly_schedule(schedule: WeeklyScheduleCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("weekly_schedules").insert({"user_id": user_id, **schedule.model_dump()}).execute().data

@app.put("/api/weekly_schedules/{schedule_id}")
async def update_weekly_schedule(schedule_id: str, schedule: WeeklyScheduleCreate, user_id: str = Depends(get_current_user)):
    row = supabase.table("weekly_schedules").select("user_id").eq("id", schedule_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("weekly_schedules").update(schedule.model_dump()).eq("id", schedule_id).execute().data

@app.delete("/api/weekly_schedules/{schedule_id}")
async def delete_weekly_schedule(schedule_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("weekly_schedules").select("user_id").eq("id", schedule_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("weekly_schedules").delete().eq("id", schedule_id).execute().data

# ==========================================
# Pydantic Models — Recipes / Exceptions / Notes
# (엔드포인트보다 앞에 선언해야 FastAPI가 참조 가능)
# ==========================================
class RecipeCreate(BaseModel):
    title: str
    category: str = 'Other'
    ingredients: str = ''
    steps: str = ''
    memo: str = ''
    starred: bool = False

class RoutineExceptionCreate(BaseModel):
    start_date: str
    end_date: str
    reason: str = ''

class NoteCreate(BaseModel): id: str; title: str; body: str; updated_at: int; folder_id: str | None = None; deleted_at: int | None = None; starred: bool = False; properties: dict[str, str] | None = None; relations: dict[str, list[str]] | None = None

class NoteBatchCreate(BaseModel):
    notes: list[NoteCreate]

# ==========================================
# Recipes (레시피)
# ==========================================
@app.get("/api/recipes")
async def get_recipes(user_id: str = Depends(get_current_user)):
    return supabase.table("recipes").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data or []

@app.post("/api/recipes")
async def create_recipe(recipe: RecipeCreate, user_id: str = Depends(get_current_user)):
    data = supabase.table("recipes").insert({
        "user_id": user_id,
        "title": recipe.title,
        "category": recipe.category,
        "ingredients": recipe.ingredients,
        "steps": recipe.steps,
        "memo": recipe.memo,
        "starred": recipe.starred,
    }).execute().data
    return data[0] if data else {}

@app.put("/api/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, recipe: RecipeCreate, user_id: str = Depends(get_current_user)):
    row = supabase.table("recipes").select("user_id").eq("id", recipe_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    data = supabase.table("recipes").update({
        "title": recipe.title,
        "category": recipe.category,
        "ingredients": recipe.ingredients,
        "steps": recipe.steps,
        "memo": recipe.memo,
        "starred": recipe.starred,
    }).eq("id", recipe_id).execute().data
    return data[0] if data else {}

@app.delete("/api/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("recipes").select("user_id").eq("id", recipe_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("recipes").delete().eq("id", recipe_id).execute().data

# ==========================================
# Routine Exceptions (예외일)
# ==========================================
@app.get("/api/routine_exceptions")
async def get_routine_exceptions(user_id: str = Depends(get_current_user)):
    return supabase.table("routine_exceptions").select("*").eq("user_id", user_id).order("start_date").execute().data or []

@app.post("/api/routine_exceptions")
async def create_routine_exception(exc: RoutineExceptionCreate, user_id: str = Depends(get_current_user)):
    return supabase.table("routine_exceptions").insert({
        "user_id": user_id,
        "start_date": exc.start_date,
        "end_date": exc.end_date,
        "reason": exc.reason,
    }).execute().data

@app.delete("/api/routine_exceptions/{exc_id}")
async def delete_routine_exception(exc_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("routine_exceptions").select("user_id").eq("id", exc_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("routine_exceptions").delete().eq("id", exc_id).execute().data

def _fetch_user_table(user_id: str, table: str, order: str | None = None):
    q = supabase.table(table).select("*").eq("user_id", user_id)
    if order:
        q = q.order(order)
    return q.execute().data or []

@app.get("/api/notes")
async def get_notes(
    user_id: str = Depends(get_current_user),
    updated_after: int = Query(default=0, ge=0),
):
    """Delta sync contract: return notes or tombstones changed after the cursor."""
    q = (
        supabase.table("notes")
        .select("*")
        .eq("user_id", user_id)
        .or_(build_notes_delta_or_filter(updated_after))
    )
    return q.order("updated_at", desc=True).execute().data or []

@app.post("/api/notes")
async def upsert_note(note: NoteCreate, user_id: str = Depends(get_current_user)):
    data = {"user_id": user_id, **note.model_dump()}
    try:
        return supabase.table("notes").upsert(data, on_conflict="id").execute().data
    except Exception:
        # notes 테이블에 starred/properties 컬럼이 아직 없는 구 스키마 호환
        data.pop("starred", None)
        data.pop("properties", None)
        data.pop("relations", None)
        return supabase.table("notes").upsert(data, on_conflict="id").execute().data

@app.post("/api/notes/batch")
async def upsert_notes_batch(
    batch: NoteBatchCreate,
    user_id: str = Depends(get_current_user),
    chunk_size: int = Query(default=DEFAULT_BATCH_CHUNK_SIZE, ge=1, le=100),
):
    """Batch upsert with configurable chunk size — preserves single-note POST compatibility (K-97G)."""
    if not batch.notes:
        return []
    results: list = []
    payloads = [{"user_id": user_id, **note.model_dump()} for note in batch.notes]
    for chunk in chunk_note_payloads(payloads, chunk_size):
        try:
            data = supabase.table("notes").upsert(chunk, on_conflict="id").execute().data or []
        except Exception:
            slim = []
            for row in chunk:
                slim_row = dict(row)
                slim_row.pop("starred", None)
                slim_row.pop("properties", None)
                slim_row.pop("relations", None)
                slim.append(slim_row)
            data = supabase.table("notes").upsert(slim, on_conflict="id").execute().data or []
        results.extend(data)
    return results

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("notes").select("user_id").eq("id", note_id).maybe_single().execute().data
    if not row: raise HTTPException(status_code=404, detail="Not found")
    verify_owner(row["user_id"], user_id)
    return supabase.table("notes").delete().eq("id", note_id).execute().data

# ==========================================
# Backup & Restore
# ==========================================
@app.get("/api/backup")
async def export_backup(user_id: str = Depends(get_current_user)):
    """Full backup JSON — sequential table fetch to reduce peak memory (K-97G)."""
    return fetch_backup_tables_sequential(lambda table, order: _fetch_user_table(user_id, table, order))

@app.get("/api/backup/stream")
async def export_backup_stream(user_id: str = Depends(get_current_user)):
    """Streaming ZIP backup — one table per archive entry, no full-vault JSON buffer (K-97G)."""
    fetch = lambda table, order: _fetch_user_table(user_id, table, order)
    return StreamingResponse(
        iter_backup_zip_chunks(fetch),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="absinthe-backup.zip"'},
    )

class RestorePayload(BaseModel):
    notes: list = []
    note_folders: list = []
    schedules: list = []
    todos: list = []
    routines: list = []
    routine_logs: list = []
    exercise_blocks: list = []
    workout_logs: list = []
    inbody_logs: list = []
    ddays: list = []
    recipes: list = []
    routine_exceptions: list = []

@app.post("/api/restore")
async def import_backup(payload: RestorePayload, user_id: str = Depends(get_current_user)):
    if RECOVERY_MODE_ACTIVE:
        raise HTTPException(status_code=423, detail="Data recovery mode is active")
    """백업 JSON을 받아 각 테이블에 upsert (기존 데이터 유지, 충돌 시 덮어쓰기)"""
    def upsert(table: str, rows: list, conflict: str = "id"):
        if not rows: return
        data = [{**{k: v for k, v in r.items() if k != "user_id"}, "user_id": user_id} for r in rows]
        supabase.table(table).upsert(data, on_conflict=conflict).execute()

    upsert("note_folders",    payload.note_folders)
    upsert("notes",           payload.notes)
    upsert("schedules",       payload.schedules)
    upsert("todos",           payload.todos)
    upsert("routines",        payload.routines)
    upsert("routine_logs",    payload.routine_logs)
    upsert("exercise_blocks", payload.exercise_blocks)
    upsert("workout_logs",    payload.workout_logs)
    upsert("inbody_logs",     payload.inbody_logs)
    upsert("ddays",           payload.ddays)
    upsert("recipes",           payload.recipes)
    upsert("routine_exceptions", payload.routine_exceptions)
    from datetime import datetime, timezone
    return {"status": "ok", "restored_at": datetime.now(timezone.utc).isoformat()}
