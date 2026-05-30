/**
 * i18n.ts — 다국어 지원 (영어 / 한국어 / 일본어)
 *
 * 사용법:
 *   const { t, lang } = useTranslation();
 *   t('save')  →  'Save' | '저장' | '保存'
 */

export type Language = 'en' | 'ko' | 'ja';

// ── 번역 사전 ────────────────────────────────────────────────────────
const translations = {
  // ── 공통 ──────────────────────────────────────────────────────────
  save:           { en: 'Save',           ko: '저장',         ja: '保存'         },
  cancel:         { en: 'Cancel',         ko: '취소',         ja: 'キャンセル'   },
  delete:         { en: 'Delete',         ko: '삭제',         ja: '削除'         },
  edit:           { en: 'Edit',           ko: '편집',         ja: '編集'         },
  add:            { en: 'Add',            ko: '추가',         ja: '追加'         },
  confirm:        { en: 'Confirm',        ko: '확인',         ja: '確認'         },
  close:          { en: 'Close',          ko: '닫기',         ja: '閉じる'       },
  loading:        { en: 'Loading...',     ko: '불러오는 중...', ja: '読み込み中...' },
  signOut:        { en: 'Sign Out',       ko: '로그아웃',     ja: 'サインアウト' },
  dark:           { en: 'Dark',           ko: '다크',         ja: 'ダーク'       },
  light:          { en: 'Light',          ko: '라이트',       ja: 'ライト'       },
  settings:       { en: 'Settings',       ko: '설정',         ja: '設定'         },
  noFolder:       { en: 'No Folder',      ko: '폴더 없음',    ja: 'フォルダなし' },
  allNotes:       { en: 'All Notes',      ko: '전체 노트',    ja: 'すべてのノート' },
  title:          { en: 'Title',          ko: '제목',         ja: 'タイトル'     },
  date:           { en: 'Date',           ko: '날짜',         ja: '日付'         },
  reason:         { en: 'Reason',         ko: '사유',         ja: '理由'         },
  optional:       { en: 'optional',       ko: '선택',         ja: '任意'         },
  timeLang:       { en: 'en',             ko: 'ko',           ja: 'ja'           },

  // ── Sidebar ────────────────────────────────────────────────────────
  planner:        { en: 'Planner',        ko: '플래너',       ja: 'プランナー'   },
  health:         { en: 'Health',         ko: '헬스',         ja: 'フィットネス'       },
  analytics:      { en: 'Analytics',      ko: '분석',         ja: '分析'         },
  note:           { en: 'Note',           ko: '노트',         ja: 'ノート'       },
  out:            { en: 'Out',            ko: '나가기',       ja: '退出'         },

  // ── PlannerView ────────────────────────────────────────────────────
  routines:       { en: 'Routines',       ko: '루틴',         ja: 'ルーティン'   },
  todoList:       { en: 'To-do list',     ko: '할 일',        ja: 'ToDo'         },
  memo:           { en: 'Memo',           ko: '메모',         ja: 'メモ'         },
  calendar:       { en: 'Calendar',       ko: '캘린더',       ja: 'カレンダー'   },
  timeline:       { en: 'Timeline',       ko: '타임라인',     ja: 'タイムライン' },
  dday:           { en: 'D-Day',          ko: 'D-Day',        ja: 'D-Day'        },
  newFolder:      { en: 'New Folder',     ko: '새 폴더',      ja: '新フォルダ'   },
  newNote:        { en: 'New Note',       ko: '새 노트',      ja: '新しいノート' },
  folderName:     { en: 'Folder name',    ko: '폴더 이름',    ja: 'フォルダ名'   },
  addRoutine:     { en: 'Add new routine...', ko: '루틴 추가...', ja: 'ルーティン追加...' },
  addTask:        { en: 'Add new task...', ko: '할 일 추가...', ja: 'タスク追加...' },
  startWriting:   { en: 'Start writing...', ko: '작성 시작...', ja: '書き始める...' },
  noTasks:        { en: 'No tasks. Chill out!', ko: '할 일 없음. 쉬어요!', ja: 'タスクなし。一休み！' },
  noDdays:        { en: 'No D-Days yet', ko: 'D-Day 없음',   ja: 'D-Dayなし'    },
  noSchedules:    { en: 'No schedules yet', ko: '일정이 없습니다', ja: 'スケジュールなし' },
  noNotes:        { en: 'No notes',      ko: '노트 없음',    ja: 'ノートなし'   },
  noRoutines:     { en: 'Build a daily routine!', ko: '루틴을 만들어보세요!', ja: 'ルーティンを作ろう！' },
  trash:          { en: 'Trash',          ko: '휴지통',       ja: 'ゴミ箱'       },
  starred:        { en: 'Starred',        ko: '즐겨찾기',     ja: 'スター'       },
  editSchedule:   { en: 'Edit Schedule', ko: '일정 편집',    ja: 'スケジュール編集' },
  newSchedule:    { en: 'New Schedule',  ko: '새 일정',      ja: '新しいスケジュール' },
  editDday:       { en: 'Edit D-Day',    ko: 'D-Day 편집',   ja: 'D-Day編集'    },
  newDday:        { en: 'New D-Day',     ko: '새 D-Day',     ja: '新しいD-Day'  },
  nextDay:        { en: 'Next day',      ko: '익일',         ja: '翌日'         },
  labelText:      { en: 'Text',          ko: '내용',         ja: 'テキスト'     },
  labelCategory:  { en: 'Category',      ko: '카테고리',     ja: 'カテゴリ'     },
  labelStart:     { en: 'Start',         ko: '시작',         ja: '開始'         },
  labelEnd:       { en: 'End',           ko: '종료',         ja: '終了'         },
  labelColor:     { en: 'Color',         ko: '색상',         ja: 'カラー'       },
  setAsDday:      { en: 'Set as D-Day',  ko: 'D-Day로 설정', ja: 'D-Dayとして設定' },
  saveSchedule:   { en: 'Save Schedule', ko: '일정 저장',    ja: 'スケジュールを保存' },
  saveDday:       { en: 'Save D-Day',    ko: 'D-Day 저장',   ja: 'D-Dayを保存'  },
  saveException:  { en: 'Save Exception', ko: '예외일 저장', ja: '例外日を保存'  },
  memoPlaceholder: { en: "Today's condition, notes, etc...", ko: '오늘의 컨디션, 특이사항 등을 기록하세요…', ja: '今日のコンディション、特記事項など…' },
  overlapMsg:     { en: 'This schedule overlaps. Save anyway?', ko: '일정이 겹칩니다. 저장할까요?', ja: 'スケジュールが重複しています。保存しますか？' },
  exceptionDay:   { en: 'Exception day — routines excluded from stats', ko: '예외일 — 루틴 통계 제외', ja: '例外日 — ルーティン統計除外' },
  setException:   { en: 'Set Exception Days', ko: '예외일 설정', ja: '例外日設定' },
  exceptionDesc:  { en: 'Routines on these days will be excluded from completion stats.', ko: '해당 날짜의 루틴은 달성률 통계에서 제외됩니다.', ja: 'この期間のルーティンは達成率の統計から除外されます。' },
  exStartEndRequired: { en: 'Start and end date required', ko: '시작일과 종료일을 입력하세요', ja: '開始日と終了日を入力してください' },
  exEndAfterStart:    { en: 'End date must be after start date', ko: '종료일은 시작일 이후여야 합니다', ja: '終了日は開始日より後にしてください' },
  exceptionSaved:     { en: 'Exception saved', ko: '예외일 저장됨', ja: '例外日を保存しました' },
  startDate:      { en: 'Start Date',    ko: '시작일',       ja: '開始日'       },
  endDate:        { en: 'End Date',      ko: '종료일',       ja: '終了日'       },
  exReason:       { en: 'Reason (optional)', ko: '사유 (선택)', ja: '理由（任意）' },
  exReasonPh:     { en: 'e.g. Business trip', ko: '예: 출장', ja: '例：出張'    },

  // ── Toast messages ─────────────────────────────────────────────────
  enterText:      { en: 'Enter text!',   ko: '내용을 입력하세요!', ja: 'テキストを入力してください！' },
  enterTitle:     { en: 'Enter title',   ko: '제목을 입력하세요', ja: 'タイトルを入力してください' },
  enterTitleDate: { en: 'Enter title and date!', ko: '제목과 날짜를 입력하세요!', ja: 'タイトルと日付を入力してください！' },
  endTimeError:   { en: 'End time must be after start time!', ko: '종료 시간이 시작 시간 이후여야 합니다!', ja: '終了時間は開始時間より後にしてください！' },
  endTimeLater:   { en: 'End time must be later!', ko: '종료 시간을 더 늦게 설정하세요!', ja: '終了時間をもっと遅くしてください！' },
  deleteRoutine:  { en: 'Delete this routine?', ko: '이 루틴을 삭제할까요?', ja: 'このルーティンを削除しますか？' },
  deleteSchedule: { en: 'Delete this schedule?', ko: '이 일정을 삭제할까요?', ja: 'このスケジュールを削除しますか？' },
  deleteDday:     { en: 'Delete this D-Day?', ko: 'D-Day를 삭제할까요?', ja: 'このD-Dayを削除しますか？' },
  deleted:        { en: 'Deleted',       ko: '삭제됨',       ja: '削除しました' },
  ddaySaved:      { en: 'D-Day saved',   ko: 'D-Day 저장됨', ja: 'D-Day保存しました' },
  scheduleSaved:  { en: 'Schedule saved', ko: '일정 저장됨', ja: 'スケジュール保存しました' },
  routineDeleted: { en: 'Routine deleted', ko: '루틴 삭제됨', ja: 'ルーティン削除しました' },

  // ── HealthView ────────────────────────────────────────────────────
  workout:        { en: 'Workout',       ko: '운동',         ja: 'ワークアウト' },
  inbody:         { en: 'InBody',        ko: 'InBody',       ja: 'InBody'       },
  exerciseName:   { en: 'Exercise Name', ko: '운동 이름',    ja: '種目名'       },
  loadRoutine:    { en: 'Load Routine',  ko: '루틴 불러오기', ja: 'ルーティン読込' },
  saveWorkout:    { en: 'Save Workout',  ko: '운동 저장',    ja: 'ワークアウト保存' },
  workoutSaved:   { en: 'Workout Saved! 💪', ko: '운동 저장됨! 💪', ja: 'ワークアウト保存！💪' },
  alreadyAdded:   { en: 'Already added!', ko: '이미 추가됨!', ja: 'すでに追加済み！' },
  noWorkouts:     { en: 'No workouts to save', ko: '저장할 운동이 없음', ja: '保存するワークアウトがありません' },
  failedSave:     { en: 'Failed to save workout', ko: '운동 저장 실패', ja: 'ワークアウト保存に失敗しました' },
  failedRemove:   { en: 'Failed to remove', ko: '삭제 실패', ja: '削除に失敗しました' },
  loaded:         { en: 'Loaded!',       ko: '불러옴!',      ja: '読み込みました！' },
  noBlocks:       { en: 'No blocks assembled.', ko: '조합된 블록 없음.', ja: 'ブロックが未設定です。' },
  enterName:      { en: 'Enter name!',   ko: '이름을 입력하세요!', ja: '名前を入力してください！' },
  enterWeight:    { en: 'Enter weight!', ko: '몸무게를 입력하세요!', ja: '体重を入力してください！' },
  valuesNegative: { en: 'Values cannot be negative', ko: '음수는 입력할 수 없습니다', ja: '負の値は入力できません' },
  inbodySaved:    { en: 'InBody Saved! 📈', ko: 'InBody 저장됨! 📈', ja: 'InBody保存！📈' },
  deleteBlock:    { en: 'Delete this block?', ko: '이 블록을 삭제할까요?', ja: 'このブロックを削除しますか？' },
  blockUpdated:   { en: 'Block updated', ko: '블록 업데이트됨', ja: 'ブロック更新しました' },
  blockCreated:   { en: 'Block created', ko: '블록 생성됨', ja: 'ブロック作成しました' },
  blockDeleted:   { en: 'Block deleted', ko: '블록 삭제됨', ja: 'ブロック削除しました' },
  routineSaved:   { en: 'Routine Saved', ko: '루틴 저장됨', ja: 'ルーティン保存しました' },
  strength:       { en: 'Strength',      ko: '웨이트',       ja: 'ストレングス' },
  bodyweight:     { en: 'Bodyweight',    ko: '맨몸',         ja: '自重'         },
  cardio:         { en: 'Cardio',        ko: '유산소',       ja: 'カーディオ'   },
  cardioMode:     { en: 'Record mode',   ko: '기록 방식',    ja: '記録方式'     },
  cardioTime:     { en: 'Time only',     ko: '시간만',       ja: '時間のみ'     },
  cardioDistance: { en: 'Distance only', ko: '거리만',       ja: '距離のみ'     },
  cardioBoth:     { en: 'Time + Distance', ko: '시간 + 거리', ja: '時間＋距離'  },

  // ── AnalyticsView ─────────────────────────────────────────────────
  weeklyTimetable: { en: 'Weekly Timetable', ko: '주간 타임테이블', ja: '週間タイムテーブル' },
  addActivity:    { en: 'Add',           ko: '추가',         ja: '追加'         },
  dayOfWeek:      { en: 'Day of Week',   ko: '요일',         ja: '曜日'         },
  editActivity:   { en: 'Edit Activity', ko: '활동 편집',    ja: 'アクティビティ編集' },
  newActivity:    { en: 'New Activity',  ko: '새 활동',      ja: '新しいアクティビティ' },
  failedAnalytics: { en: 'Failed to load analytics data', ko: '분석 데이터 불러오기 실패', ja: '分析データの読み込みに失敗しました' },
  enterTitleAct:  { en: 'Enter title',   ko: '제목 입력',    ja: 'タイトルを入力' },
  exceptionDays:  { en: 'Exception Days', ko: '예외일 목록', ja: '例外日一覧'   },
  exception:      { en: '🏖 Exception',  ko: '🏖 예외일',    ja: '🏖 例外日'    },
  routineRate:    { en: 'Routine completion', ko: '루틴 달성률', ja: 'ルーティン達成率' },

  // ── SettingsView ───────────────────────────────────────────────────
  settingsTitle:  { en: 'Settings',      ko: '설정',         ja: '設定'         },
  settingsDesc:   { en: 'Customize your planner and manage your data.', ko: '플래너를 커스터마이징하고 데이터를 관리하세요.', ja: 'プランナーをカスタマイズしてデータを管理します。' },
  plannerDefaults: { en: 'Planner Defaults', ko: '플래너 기본값', ja: 'プランナーのデフォルト' },
  defaultCategory: { en: 'Default Category', ko: '기본 카테고리', ja: 'デフォルトカテゴリ' },
  defaultCategoryDesc: { en: 'Pre-selected category.', ko: '기본 선택 카테고리.', ja: 'デフォルト選択カテゴリ。' },
  defaultColor:   { en: 'Default Color', ko: '기본 색상',    ja: 'デフォルトカラー' },
  defaultColorDesc: { en: 'Pre-selected timeline color.', ko: '기본 타임라인 색상.', ja: 'デフォルトタイムラインカラー。' },
  language:       { en: 'Language',      ko: '언어',         ja: '言語'         },
  languageDesc:   { en: 'Select display language.', ko: '표시 언어를 선택하세요.', ja: '表示言語を選択します。' },
  dataManagement: { en: 'Data Management', ko: '데이터 관리', ja: 'データ管理'  },
  exportCsv:      { en: 'Export Data (CSV)', ko: '데이터 내보내기 (CSV)', ja: 'データエクスポート（CSV）' },
  exportDesc:     { en: 'Download all your records.', ko: '모든 기록을 다운로드합니다.', ja: '全記録をダウンロードします。' },
  comingSoon:     { en: 'Coming Soon',   ko: '준비 중',      ja: '準備中'       },
  resetData:      { en: 'Reset All Data', ko: '모든 데이터 초기화', ja: '全データリセット' },
  resetDesc:      { en: 'This action cannot be undone.', ko: '되돌릴 수 없는 작업입니다.', ja: 'この操作は元に戻せません。' },
  resetConfirm:   { en: 'Are you sure? This will permanently delete ALL your data.', ko: '정말로 모든 데이터를 영구 삭제하시겠습니까?', ja: '本当によろしいですか？すべてのデータが完全に削除されます。' },
  resetSuccess:   { en: 'All data has been permanently deleted.', ko: '모든 데이터가 삭제되었습니다.', ja: 'すべてのデータが削除されました。' },
  resetFailed:    { en: 'Failed to reset data.', ko: '데이터 초기화 실패.', ja: 'データのリセットに失敗しました。' },

  // ── Recipe ───────────────────────────────────────────────────────
  recipe:         { en: 'Recipe',        ko: '레시피',       ja: 'レシピ'       },

  // ── HealthView ────────────────────────────────────────────────────
  workoutBlocks:  { en: 'Workout Blocks',   ko: '운동 블록',     ja: 'ワークアウトブロック' },
  routineSetup:   { en: 'Routine Setup',    ko: '루틴 설정',     ja: 'ルーティン設定'   },
  todayWorkout:   { en: "Today's Workout",  ko: '오늘의 운동',   ja: '本日のワークアウト' },
  completeWorkout:{ en: 'Complete Workout', ko: '운동 완료',     ja: 'ワークアウト完了' },
  tapEditModify:  { en: 'Tap Edit to modify', ko: '편집하려면 Edit 클릭', ja: '編集をタップして変更' },
  dropSet:        { en: 'DROP SET',         ko: '드롭세트',      ja: 'ドロップセット'   },
  orderDrag:      { en: 'ORDER (drag to reorder)', ko: '순서 (드래그로 변경)', ja: '順番（ドラッグで変更）' },
  splits:         { en: 'Split(s)',         ko: '분할',          ja: '分割'             },
  tagsPlaceholder:{ en: 'Tags (Enter or comma to add)', ko: '태그 (Enter 또는 쉼표로 추가)', ja: 'タグ（EnterまたはカンマEで追加）' },
  tapBlockHint:   { en: "Tap a block to add to today's workout. Use tags to filter blocks.", ko: '블록을 탭하여 오늘 운동에 추가. 태그로 필터링하세요.', ja: 'ブロックをタップして今日のワークアウトに追加。タグでフィルタリング。' },
  exNamePlaceholder: { en: 'e.g. chest, push, upper', ko: '예: 가슴, 밀기, 상체', ja: '例：胸、プッシュ、上半身' },

  // ── AnalyticsView ───────────────────────────────────────────────────
  yourAnalytics:  { en: 'Your Analytics',    ko: '나의 분석',     ja: 'マイ分析'         },
  from:           { en: 'From',              ko: '시작',          ja: '開始'             },
  selectBothDates:{ en: 'Select both dates', ko: '날짜를 선택하세요', ja: '両方の日付を選択してください' },
  activityTitle:  { en: 'Title',             ko: '제목',          ja: 'タイトル'         },
  activityPh:     { en: 'e.g. Morning Workout', ko: '예: 아침 운동', ja: '例：朝のワークアウト' },
  colorTheme:     { en: 'Color Theme',       ko: '색상 테마',     ja: 'カラーテーマ'     },

  // ── RecipeView ────────────────────────────────────────────────────
  recipes:        { en: 'Recipes',          ko: '레시피',        ja: 'レシピ'           },
  recipeStarred:  { en: 'Starred',          ko: '즐겨찾기',      ja: 'スター'           },
  recipeLoading:  { en: 'Loading...',       ko: '불러오는 중...', ja: '読み込み中...'   },
  ingredients:    { en: 'Ingredients',      ko: '재료',          ja: '材料'             },
  steps:          { en: 'Steps',            ko: '조리 순서',     ja: '手順'             },
  recipeMemo:     { en: 'Memo',             ko: '메모',          ja: 'メモ'             },
  category:       { en: 'Category',         ko: '카테고리',      ja: 'カテゴリ'         },
  searchRecipe:   { en: 'Search recipes or ingredients...', ko: '레시피 또는 재료 검색...', ja: 'レシピや材料を検索...' },
  recipeName:     { en: 'Recipe name...',   ko: '레시피 이름...', ja: 'レシピ名...'     },
  recipeTips:     { en: 'Tips, variations, source...', ko: '팁, 변형, 출처...', ja: 'ヒント、バリエーション、出典...' },
  newRecipe:      { en: 'New Recipe',       ko: '새 레시피',     ja: '新しいレシピ'     },
  editRecipe:     { en: 'Edit Recipe',      ko: '레시피 편집',   ja: 'レシピ編集'       },
  saveRecipe:     { en: 'Save Recipe',      ko: '레시피 저장',   ja: 'レシピを保存'     },
  updateRecipe:   { en: 'Update Recipe',    ko: '레시피 업데이트', ja: 'レシピを更新'   },
  addStarred:     { en: 'Add to Starred',   ko: '즐겨찾기 추가', ja: 'スターに追加'     },
  noRecipes:      { en: 'No recipes yet. Add your first recipe!', ko: '레시피가 없습니다. 첫 레시피를 추가해보세요!', ja: 'レシピがありません。最初のレシピを追加しましょう！' },
  onePerLine:     { en: 'one per line',     ko: '한 줄에 하나씩', ja: '1行に1つ'        },
  deleteRecipe:   { en: 'Delete this recipe?', ko: '이 레시피를 삭제할까요?', ja: 'このレシピを削除しますか？' },
  recipeUpdated:  { en: 'Recipe updated',   ko: '레시피 업데이트됨', ja: 'レシピを更新しました' },
  recipeSaved:    { en: 'Recipe saved',     ko: '레시피 저장됨', ja: 'レシピを保存しました' },
  recipeDeleted:  { en: 'Deleted',          ko: '삭제됨',        ja: '削除しました'     },
  failLoadRecipes:{ en: 'Failed to load recipes', ko: '레시피 불러오기 실패', ja: 'レシピの読み込みに失敗しました' },
  failSaveRecipe: { en: 'Failed to save recipe', ko: '레시피 저장 실패', ja: 'レシピの保存に失敗しました' },
  failDeleteRecipe:{ en: 'Failed to delete', ko: '삭제 실패',    ja: '削除に失敗しました' },
  enterRecipeTitle:{ en: 'Enter recipe title!', ko: '레시피 제목을 입력하세요!', ja: 'レシピタイトルを入力してください！' },

  other:          { en: 'Other',          ko: '기타',         ja: 'その他'       },
  workoutSavedShort: { en: 'Workout Saved', ko: '운동 저장됨', ja: '保存しました' },

  // ── Session divider ───────────────────────────────────────────────
  addSession:      { en: '+ Session',      ko: '+ 세션',       ja: '+ セッション'  },
  sessionMorning:  { en: '🌅 Morning',     ko: '🌅 아침',      ja: '🌅 朝'         },
  sessionAfternoon:{ en: '🏋️ Afternoon',   ko: '🏋️ 오후',     ja: '🏋️ 午後'      },
  sessionEvening:  { en: '🌙 Evening',     ko: '🌙 저녁',      ja: '🌙 夜'         },

  // ── Protein Tracker ──────────────────────────────────────────────
  proteinTracker:   { en: 'Protein Tracker',     ko: '프로틴 트래커',   ja: 'プロテイントラッカー'      },
  proteinProfile:   { en: 'Daily Goal',           ko: '일일 목표',       ja: '1日の目標'                 },
  proteinSources:   { en: 'Protein Sources',      ko: '단백질 소스',     ja: 'タンパク質ソース'          },
  proteinLog:       { en: "Today's Intake",       ko: '오늘 섭취량',     ja: '今日の摂取量'              },
  proteinGoalSaved: { en: 'Goal saved! 🥩',       ko: '목표 저장됨! 🥩', ja: '目標保存しました！🥩'      },
  saveGoal:         { en: 'Save Goal',            ko: '목표 저장',       ja: '目標を保存'                },
  bodyWeight:       { en: 'Body Weight',          ko: '체중',            ja: '体重'                      },
  goal:             { en: 'Goal',                 ko: '목표',            ja: '目標'                      },
  goalMuscle:       { en: 'Build Muscle',         ko: '근육 증가',       ja: '筋肉増量'                  },
  goalMaintain:     { en: 'Maintain',             ko: '유지',            ja: '維持'                      },
  goalFat:          { en: 'Fat Loss',             ko: '체지방 감소',     ja: '脂肪燃焼'                  },
  goalAthlete:      { en: 'Athlete',              ko: '운동선수',        ja: 'アスリート'                },
  activityLevel:    { en: 'Activity Level',       ko: '활동량',          ja: '活動量'                    },
  actLow:           { en: 'Low (1–2×/wk)',        ko: '낮음 (주 1–2회)', ja: '低 (週1–2回)'              },
  actMod:           { en: 'Moderate (3–4×/wk)',   ko: '보통 (주 3–4회)', ja: '中 (週3–4回)'              },
  actHigh:          { en: 'High (5–6×/wk)',       ko: '높음 (주 5–6회)', ja: '高 (週5–6回)'              },
  actVery:          { en: 'Very High (daily)',    ko: '매우 높음 (매일)', ja: '非常に高 (毎日)'           },
  dailyProtein:     { en: 'Daily Protein',        ko: '일일 단백질',     ja: '1日のタンパク質'           },
  proteinFixed:     { en: 'Fixed (per serving)',  ko: '고정 (1회 분량)', ja: '固定 (1回分)'              },
  proteinPer100g:   { en: 'Per 100g',             ko: '100g 당',         ja: '100gあたり'                },
  addIntake:        { en: 'Add Intake',           ko: '섭취 추가',       ja: '摂取を追加'                },
  noSources:        { en: 'Add sources to track', ko: '소스를 추가하면 기록할 수 있어요', ja: 'ソースを追加して記録しましょう' },
  proteinSourceName:{ en: 'Source name (e.g. Chicken)', ko: '소스 이름 (예: 닭가슴살)', ja: 'ソース名 (例：鶏肉)' },
  sourceCreated:    { en: 'Source added',         ko: '소스 추가됨',     ja: 'ソースを追加しました'      },
  sourceDeleted:    { en: 'Source deleted',       ko: '소스 삭제됨',     ja: 'ソースを削除しました'      },
  sourceUpdated:    { en: 'Source updated',       ko: '소스 수정됨',     ja: 'ソースを更新しました'      },
  serving:          { en: 'serving',              ko: '1회',             ja: '1回分'                     },
  unit:             { en: 'unit',                 ko: '개',              ja: '個'                        },
  memoOptional:     { en: 'Memo (optional)',       ko: '메모 (선택)',     ja: 'メモ（任意）'              },
  intakeLogged:     { en: 'Logged! 💪',           ko: '기록됨! 💪',      ja: '記録しました！💪'          },
  intakeDeleted:    { en: 'Removed',              ko: '삭제됨',          ja: '削除しました'              },
  directInput:      { en: '✏️ Custom entry',      ko: '✏️ 직접 입력',    ja: '✏️ 直接入力'               },
  noIntakeToday:    { en: 'No records today',     ko: '오늘 기록이 없습니다', ja: '今日の記録はありません'   },
  addSourceFirst:   { en: '+ Add a source first →', ko: '+ 소스 먼저 추가하기 →', ja: '+ ソースを先に追加 →' },
  addIntakeLabel:   { en: 'Add intake…',          ko: '섭취 추가…',      ja: '摂取を追加…'               },
  customEntryLabel: { en: 'Custom entry',         ko: '직접 입력',       ja: '直接入力'                  },
  progressOf:       { en: 'of goal',              ko: '목표 달성',       ja: '目標達成'                  },

  // ── 카테고리 ──────────────────────────────────────────────────────
  catStudy:       { en: 'Study',         ko: '공부',         ja: '勉強'         },
  catWork:        { en: 'Work',          ko: '업무',         ja: '仕事'         },
  catExercise:    { en: 'Workout',       ko: '운동',         ja: 'ワークアウト'  },
  catPersonal:    { en: 'Personal',      ko: '개인',         ja: '個人'         },
  catSleep:       { en: 'Sleep',         ko: '수면',         ja: '睡眠'         },
  catSocial:      { en: 'Social',        ko: '사교',         ja: '交流'         },
} as const;

export type TranslationKey = keyof typeof translations;

// ── 번역 함수 ────────────────────────────────────────────────────────
export function getTranslator(lang: Language) {
  return function t(key: TranslationKey): string {
    return translations[key]?.[lang] ?? translations[key]?.en ?? key;
  };
}

// ── React 훅 ─────────────────────────────────────────────────────────
import { useAppStore } from '../store/useAppStore';

export function useTranslation() {
  const lang = (useAppStore(s => s.appSettings.language) ?? 'en') as Language;
  return { t: getTranslator(lang), lang };
}
