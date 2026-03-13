from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from supabase import create_client, Client

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

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "\n🚨 [보안 오류] .env 파일을 찾을 수 없거나 키가 비어있습니다!\n"
        "1. backend 폴더 안에 '.env' 파일이 정확히 존재하는지 확인하세요.\n"
        "2. 윈도우 확장자 숨김 기능 때문에 파일 이름이 '.env.txt'로 되어있지 않은지 확인하세요.\n"
        "3. .env 내용에 띄어쓰기나 따옴표가 없는지 확인하세요. (예: SUPABASE_URL=https://...)"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# 🔐 JWT 인증: Authorization 헤더에서 user_id 추출
# ==========================================
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        # Supabase admin client로 서버 측 검증 — 서명 위변조 방지
        response = supabase.auth.get_user(token)
        user_id = response.user.id if response.user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def verify_owner(resource_user_id: str, current_user_id: str):
    if resource_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

# ==========================================
# Pydantic Models (user_id 제거 — 토큰에서 추출)
# ==========================================
class ScheduleCreate(BaseModel): date: str; text: str; start_time: str; end_time: str; is_dday: bool = False; color: str = "gold"; category: str = "Study"; end_next_day: bool = False
class ScheduleUpdate(BaseModel): text: str; start_time: str; end_time: str; is_dday: bool = False; color: str = "gold"; category: str = "Study"
class TodoCreate(BaseModel): date: str; text: str
class RoutineCreate(BaseModel): text: str; created_date: str = ''
class StatusUpdate(BaseModel): done: bool
class RoutineLogUpdate(BaseModel): routine_id: str; date: str; done: bool
class ExerciseBlockCreate(BaseModel): name: str; type: str; tags: list = []
class HealthRoutineCreate(BaseModel): day_name: str; blocks: list
class WorkoutLogCreate(BaseModel): date: str; block_id: str; sets: list; sort_order: int = 0
class InbodyLogCreate(BaseModel): date: str; weight: float; smm: float; pbf: float
class WeeklyScheduleCreate(BaseModel): day: int; title: str; start_time: str; end_time: str; color: str
class RoutineUpdate(BaseModel): text: str
class TodoTextUpdate(BaseModel): text: str

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
    supabase.table("schedules").delete().eq("user_id", user_id).execute()
    supabase.table("todos").delete().eq("user_id", user_id).execute()
    supabase.table("routines").delete().eq("user_id", user_id).execute()
    supabase.table("workout_logs").delete().eq("user_id", user_id).execute()
    supabase.table("inbody_logs").delete().eq("user_id", user_id).execute()
    supabase.table("weekly_schedules").delete().eq("user_id", user_id).execute()
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
    row = supabase.table("schedules").select("user_id").eq("id", schedule_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("schedules").update(schedule.model_dump()).eq("id", schedule_id).execute().data

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("schedules").select("user_id").eq("id", schedule_id).single().execute().data
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
    row = supabase.table("todos").select("user_id").eq("id", todo_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("todos").update({"done": payload.done}).eq("id", todo_id).execute().data

@app.put("/api/todos_text/{todo_id}")
async def update_todo_text(todo_id: str, payload: TodoTextUpdate, user_id: str = Depends(get_current_user)):
    """투두 텍스트 수정 (done 상태는 PUT /api/todos/{id}로 분리)"""
    row = supabase.table("todos").select("user_id").eq("id", todo_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("todos").update({"text": payload.text}).eq("id", todo_id).execute().data

@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("todos").select("user_id").eq("id", todo_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("todos").delete().eq("id", todo_id).execute().data

# ==========================================
# Routines
# ==========================================
@app.get("/api/routines_with_logs")
async def get_routines_with_logs(date: str, user_id: str = Depends(get_current_user)):
    routines = supabase.table("routines").select("*").eq("user_id", user_id).execute().data or []
    # created_date가 없거나(기존 데이터) 요청 날짜 이하인 루틴만 표시
    routines = [r for r in routines if not r.get("created_date") or r["created_date"] <= date]
    logs = supabase.table("routine_logs").select("*").eq("user_id", user_id).eq("date", date).execute().data or []
    log_dict = {str(log["routine_id"]): log.get("done", False) for log in logs}
    return [{"id": str(r["id"]), "text": r.get("text", ""), "done": log_dict.get(str(r["id"]), False), "is_active": r.get("is_active", True)} for r in routines]

@app.get("/api/routines/range")
async def get_routines_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """CSV 내보내기용 기간별 루틴 로그 조회 (날짜별 done 상태 포함)"""
    routines = supabase.table("routines").select("id, text, is_active").eq("user_id", user_id).execute().data or []
    logs = supabase.table("routine_logs").select("routine_id, date, done").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).execute().data or []
    # (routine_id, date) → done 매핑
    log_map = {(str(l["routine_id"]), l["date"]): l["done"] for l in logs}
    result = []
    for log in logs:
        routine = next((r for r in routines if str(r["id"]) == str(log["routine_id"])), None)
        if routine:
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
    row = supabase.table("routines").select("user_id").eq("id", routine_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("routines").update({"text": routine.text}).eq("id", routine_id).execute().data

@app.delete("/api/routines/{routine_id}")
async def delete_routine(routine_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("routines").select("user_id").eq("id", routine_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    supabase.table("routine_logs").delete().eq("routine_id", routine_id).execute()
    return supabase.table("routines").delete().eq("id", routine_id).execute().data

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
    row = supabase.table("exercise_blocks").select("user_id").eq("id", block_id).single().execute().data
    if not row or row["user_id"] != user_id: raise HTTPException(403)
    return supabase.table("exercise_blocks").update({"name": block.name, "type": block.type, "tags": block.tags}).eq("id", block_id).execute().data

@app.delete("/api/blocks/{block_id}")
async def delete_block(block_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("exercise_blocks").select("user_id").eq("id", block_id).single().execute().data
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
    return supabase.table("workout_logs").select("*, exercise_blocks(name, type)").eq("user_id", user_id).eq("date", date).order("sort_order").execute().data or []

@app.get("/api/workouts/range")
async def get_workouts_range(start_date: str, end_date: str, user_id: str = Depends(get_current_user)):
    """CSV 내보내기용 기간별 운동 기록 조회"""
    return supabase.table("workout_logs").select("*, exercise_blocks(name, type)").eq("user_id", user_id).gte("date", start_date).lte("date", end_date).order("date").execute().data or []

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
    row = supabase.table("workout_logs").select("user_id").eq("id", log_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("workout_logs").delete().eq("id", log_id).execute().data

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
    row = supabase.table("note_folders").select("user_id").eq("id", folder_id).single().execute().data
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
    row = supabase.table("weekly_schedules").select("user_id").eq("id", schedule_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("weekly_schedules").update(schedule.model_dump()).eq("id", schedule_id).execute().data

@app.delete("/api/weekly_schedules/{schedule_id}")
async def delete_weekly_schedule(schedule_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("weekly_schedules").select("user_id").eq("id", schedule_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("weekly_schedules").delete().eq("id", schedule_id).execute().data

# ==========================================
# Notes
# ==========================================
class NoteCreate(BaseModel): id: str; title: str; body: str; updated_at: int; folder_id: str | None = None; deleted_at: int | None = None

@app.get("/api/notes")
async def get_notes(user_id: str = Depends(get_current_user)):
    return supabase.table("notes").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute().data or []

@app.post("/api/notes")
async def upsert_note(note: NoteCreate, user_id: str = Depends(get_current_user)):
    data = {"user_id": user_id, **note.model_dump()}
    return supabase.table("notes").upsert(data, on_conflict="id").execute().data

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, user_id: str = Depends(get_current_user)):
    row = supabase.table("notes").select("user_id").eq("id", note_id).single().execute().data
    verify_owner(row["user_id"], user_id)
    return supabase.table("notes").delete().eq("id", note_id).execute().data

# ==========================================
# Backup & Restore
# ==========================================
@app.get("/api/backup")
async def export_backup(user_id: str = Depends(get_current_user)):
    """전체 데이터 백업 — 노트/폴더/스케줄/루틴/운동기록 한 번에 반환"""
    notes      = supabase.table("notes").select("*").eq("user_id", user_id).execute().data or []
    folders    = supabase.table("note_folders").select("*").eq("user_id", user_id).execute().data or []
    schedules  = supabase.table("schedules").select("*").eq("user_id", user_id).execute().data or []
    todos      = supabase.table("todos").select("*").eq("user_id", user_id).execute().data or []
    routines   = supabase.table("routines").select("*").eq("user_id", user_id).execute().data or []
    routine_logs = supabase.table("routine_logs").select("*").eq("user_id", user_id).execute().data or []
    blocks     = supabase.table("exercise_blocks").select("*").eq("user_id", user_id).execute().data or []
    workout_logs = supabase.table("workout_logs").select("*").eq("user_id", user_id).execute().data or []
    inbody_logs  = supabase.table("inbody_logs").select("*").eq("user_id", user_id).execute().data or []
    ddays      = supabase.table("ddays").select("*").eq("user_id", user_id).execute().data or []
    return {
        "version": 1,
        "exported_at": __import__('datetime').datetime.utcnow().isoformat() + "Z",
        "notes": notes,
        "note_folders": folders,
        "schedules": schedules,
        "todos": todos,
        "routines": routines,
        "routine_logs": routine_logs,
        "exercise_blocks": blocks,
        "workout_logs": workout_logs,
        "inbody_logs": inbody_logs,
        "ddays": ddays,
    }

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

@app.post("/api/restore")
async def import_backup(payload: RestorePayload, user_id: str = Depends(get_current_user)):
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
    return {"status": "ok", "restored_at": __import__('datetime').datetime.utcnow().isoformat() + "Z"}
