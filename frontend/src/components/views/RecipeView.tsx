import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Search, Star, X, ChevronDown, ChevronUp, Trash2, Pencil, Check, BookMarked } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { API_URL } from '../../lib/config';
import { useConfirm } from '../../hooks/useConfirm';
import { useTranslation } from '../../lib/i18n';
import { ConfirmModal } from '../common/ConfirmModal';
import { EmptyState } from '../common/EmptyState';
import { BaseViewProps } from '../../types';

// ── 타입 ────────────────────────────────────────────────────────────
export interface Recipe {
  id: string;
  title: string;
  category: string;
  ingredients: string;   // 줄바꿈 구분
  steps: string;         // 줄바꿈 구분
  memo: string;
  starred: boolean;
  created_at: string;
}

interface RecipeViewProps extends BaseViewProps {}

// ── 상수 ────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Korean', 'Japanese', 'Chinese', 'Western', 'Fusion', 'Dessert', 'Drink', 'Other'] as const;
type Category = typeof CATEGORIES[number];

const EMPTY_FORM = {
  title: '', category: 'Korean', ingredients: '', steps: '', memo: '', starred: false,
};

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export const RecipeView = ({ showToast, appSettings, theme }: RecipeViewProps) => {
  const { t } = useTranslation();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  // ── 상태 ─────────────────────────────────────────────────────────
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const titleRef = useRef<HTMLInputElement>(null);

  // ── 데이터 로드 ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/recipes`);
      if (!res.ok) throw new Error(`[${res.status}]`);
      setRecipes(await res.json());
    } catch (e) {
      showToast('Failed to load recipes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showForm) setTimeout(() => titleRef.current?.focus(), 50);
  }, [showForm]);

  // ── 필터 ──────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return recipes.filter(r => {
      if (showStarredOnly && !r.starred) return false;
      if (activeCategory !== 'All' && r.category !== activeCategory) return false;
      if (q && !(r.title ?? '').toLowerCase().includes(q) && !(r.ingredients ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipes, searchQuery, activeCategory, showStarredOnly]);

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return showToast('Enter recipe title!', 'error');

    const payload = { ...form, title: form.title.trim() };
    try {
      const url = editingId
        ? `${API_URL}/api/recipes/${editingId}`
        : `${API_URL}/api/recipes`;
      const res = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const saved: Recipe = await res.json();

      setRecipes(prev =>
        editingId
          ? prev.map(r => r.id === editingId ? saved : r)
          : [saved, ...prev]
      );
      showToast(editingId ? 'Recipe updated' : 'Recipe saved');
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      setExpandedId(saved.id);
    } catch {
      showToast('Failed to save recipe', 'error');
    }
  }, [form, editingId, showToast]);

  const handleDelete = useCallback((id: string, title: string) => {
    showConfirm(`Delete "${title}"?`, async () => {
      try {
        const res = await authFetch(`${API_URL}/api/recipes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        setRecipes(prev => prev.filter(r => r.id !== id));
        if (expandedId === id) setExpandedId(null);
        showToast('Deleted');
      } catch {
        showToast('Failed to delete', 'error');
      }
    }, { confirmLabel: 'Delete' });
  }, [showConfirm, expandedId, showToast]);

  const handleToggleStar = useCallback(async (recipe: Recipe) => {
    const updated = { ...recipe, starred: !recipe.starred };
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updated : r));
    try {
      const res = await authFetch(`${API_URL}/api/recipes/${recipe.id}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRecipes(prev => prev.map(r => r.id === recipe.id ? recipe : r));
      showToast('Failed to update', 'error');
    }
  }, [showToast]);

  const openEdit = useCallback((recipe: Recipe) => {
    setForm({
      title: recipe.title,
      category: recipe.category,
      ingredients: recipe.ingredients ?? '',
      steps: recipe.steps ?? '',
      memo: recipe.memo ?? '',
      starred: recipe.starred,
    });
    setEditingId(recipe.id);
    setShowForm(true);
  }, []);

  const openNew = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
  }, []);

  // ── 색상 ──────────────────────────────────────────────────────────
  const catColor: Record<string, string> = {
    Korean:   'bg-orange-400',
    Japanese: 'bg-pink-400',
    Chinese:  'bg-red-500',
    Western:  'bg-blue-500',
    Fusion:   'bg-purple-500',
    Dessert:  'bg-yellow-400',
    Drink:    'bg-cyan-500',
    Other:    'bg-gray-400',
  };

  // ── 렌더 ──────────────────────────────────────────────────────────
  return (
    <div className={`flex-1 overflow-hidden flex flex-col h-full rounded-none lg:rounded-[32px] lg:ml-3 ${dark ? 'bg-[#1C1C1E]' : 'bg-[#F5F4F0]'}`}>

      {/* 헤더 */}
      <div className={`flex items-center justify-between px-5 pt-5 pb-3 shrink-0`}>
        <h1 className="font-heading text-2xl font-black tracking-tight flex items-center gap-2">
          <BookMarked size={22} className="text-[#FACC15]"/>
          Recipes
        </h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-[#FACC15] text-[#1C1C1E] px-4 py-2 rounded-2xl text-sm font-bold shadow-sm hover:scale-105 transition-transform active:scale-95">
          <Plus size={15}/> New
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="px-5 pb-3 space-y-2 shrink-0">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${theme.border} ${theme.input}`}>
          <Search size={14} className={theme.textMuted}/>
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search recipes or ingredients..."
            className="flex-1 bg-transparent outline-none text-sm"/>
          {searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} className={theme.textMuted}/></button>}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-[#1C1C1E] text-[#FACC15]'
                  : `${dark ? 'bg-[#2C2C2E] text-gray-400' : 'bg-white text-gray-500'}`
              }`}>{cat}</button>
          ))}
          <button onClick={() => setShowStarredOnly(p => !p)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              showStarredOnly ? 'bg-yellow-400 text-[#1C1C1E]' : `${dark ? 'bg-[#2C2C2E] text-gray-400' : 'bg-white text-gray-500'}`
            }`}>
            <Star size={11} fill={showStarredOnly ? '#1C1C1E' : 'none'}/> Starred
          </button>
        </div>
      </div>

      {/* 레시피 목록 */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
        {loading && (
          <div className={`text-center py-10 text-sm ${theme.textMuted}`}>Loading...</div>
        )}
        {!loading && visible.length === 0 && (
          <EmptyState theme={theme} icon={BookMarked} text="No recipes yet. Add your first recipe!"/>
        )}
        {visible.map(recipe => {
          const isExpanded = expandedId === recipe.id;
          const ingredients = (recipe.ingredients ?? '').split('\n').filter(Boolean);
          const steps = (recipe.steps ?? '').split('\n').filter(Boolean);

          return (
            <div key={recipe.id}
              className={`rounded-3xl border shadow-sm overflow-hidden transition-all ${theme.border} ${dark ? 'bg-[#2C2C2E]' : 'bg-white'}`}>

              {/* 카드 헤더 */}
              <div className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : recipe.id)}>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${catColor[recipe.category] ?? 'bg-gray-400'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{recipe.title}</p>
                  <p className={`text-xs ${theme.textMuted}`}>
                    {recipe.category}
                    {ingredients.length > 0 && ` · ${ingredients.length} ingredients`}
                    {steps.length > 0 && ` · ${steps.length} steps`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); handleToggleStar(recipe); }}
                    className="p-1.5 rounded-xl hover:bg-yellow-400/20 transition-colors">
                    <Star size={14} fill={recipe.starred ? '#FACC15' : 'none'} color={recipe.starred ? '#FACC15' : undefined} className={recipe.starred ? '' : theme.textMuted}/>
                  </button>
                  <button onClick={e => { e.stopPropagation(); openEdit(recipe); }}
                    className={`p-1.5 rounded-xl transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                    <Pencil size={13} className={theme.textMuted}/>
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(recipe.id, recipe.title); }}
                    className="p-1.5 rounded-xl hover:bg-red-500/20 transition-colors">
                    <Trash2 size={13} className={`${theme.textMuted} hover:text-red-500`}/>
                  </button>
                  {isExpanded ? <ChevronUp size={15} className={theme.textMuted}/> : <ChevronDown size={15} className={theme.textMuted}/>}
                </div>
              </div>

              {/* 펼쳐진 내용 */}
              {isExpanded && (
                <div className={`px-4 pb-4 border-t ${theme.border} space-y-4 pt-4`}>
                  {/* 재료 */}
                  {ingredients.length > 0 && (
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme.textMuted}`}>Ingredients</p>
                      <ul className="space-y-1">
                        {ingredients.map((ing, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-[#FACC15] font-bold shrink-0 mt-0.5">·</span>
                            <span>{ing}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 조리 순서 */}
                  {steps.length > 0 && (
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme.textMuted}`}>Steps</p>
                      <ol className="space-y-2">
                        {steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${dark ? 'bg-[#3A3A3C] text-[#FACC15]' : 'bg-[#F0EDE5] text-[#1C1C1E]'}`}>{i + 1}</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* 메모 */}
                  {recipe.memo?.trim() && (
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>Memo</p>
                      <p className={`text-sm leading-relaxed ${theme.textMuted}`}>{recipe.memo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 레시피 추가/편집 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end lg:items-center justify-center z-[100] backdrop-blur-sm"
          onClick={() => { setShowForm(false); setEditingId(null); }}>
          <div
            className={`w-full lg:max-w-lg rounded-t-[32px] lg:rounded-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto ${dark ? 'bg-[#1C1C1E]' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">{editingId ? 'Edit Recipe' : 'New Recipe'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className={`p-2 rounded-full ${theme.textMuted} ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4">
              {/* 제목 */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>Title *</label>
                <input ref={titleRef} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Recipe name..."
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FACC15] ${theme.input}`}/>
              </div>

              {/* 카테고리 */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        form.category === cat
                          ? 'bg-[#1C1C1E] text-[#FACC15]'
                          : `${dark ? 'bg-[#2C2C2E] text-gray-400' : 'bg-gray-100 text-gray-500'}`
                      }`}>{cat}</button>
                  ))}
                </div>
              </div>

              {/* 재료 */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>Ingredients <span className={`font-normal ${theme.textMuted}`}>(one per line)</span></label>
                <textarea value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
                  placeholder={"200g chicken breast\n1 tbsp olive oil\n2 cloves garlic"}
                  rows={4}
                  className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-[#FACC15] ${theme.input}`}/>
              </div>

              {/* 조리 순서 */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>Steps <span className={`font-normal ${theme.textMuted}`}>(one per line)</span></label>
                <textarea value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
                  placeholder={"Preheat oven to 200°C\nSeason chicken with salt and pepper\nBake for 25 minutes"}
                  rows={5}
                  className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-[#FACC15] ${theme.input}`}/>
              </div>

              {/* 메모 */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>Memo</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  placeholder="Tips, variations, source..."
                  rows={2}
                  className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-[#FACC15] ${theme.input}`}/>
              </div>

              {/* 즐겨찾기 */}
              <button onClick={() => setForm(f => ({ ...f, starred: !f.starred }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
                  form.starred ? 'bg-yellow-400/20 text-yellow-500' : `${dark ? 'bg-[#2C2C2E]' : 'bg-gray-100'} ${theme.textMuted}`
                }`}>
                <Star size={14} fill={form.starred ? '#FACC15' : 'none'} color={form.starred ? '#FACC15' : undefined}/>
                {form.starred ? 'Starred' : 'Add to Starred'}
              </button>
            </div>

            {/* 저장 버튼 */}
            <button onClick={handleSave}
              className="w-full mt-6 py-3.5 rounded-2xl font-bold text-sm bg-[#FACC15] text-[#1C1C1E] hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2">
              <Check size={16}/> {editingId ? 'Update Recipe' : 'Save Recipe'}
            </button>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={handleConfirm}
          onCancel={clearConfirm}
          darkMode={dark}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}/>
      )}
    </div>
  );
};
