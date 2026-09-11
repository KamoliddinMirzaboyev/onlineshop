import {
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { del, get, post, put } from "../api";
import { confirm } from "../components/Confirm";
import ImageUpload from "../components/ImageUpload";
import type { Banner } from "../types";

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const data = await get<Banner[]>("/admin/banners");
      setBanners(data);
    } catch (e) {
      toast.error(String(e).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setSubtitle("");
    setImageUrl(null);
    setLinkUrl("");
    setSortOrder(0);
    setIsActive(true);
    setOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || "");
    setImageUrl(b.image_url || null);
    setLinkUrl(b.link_url || "");
    setSortOrder(b.sort_order);
    setIsActive(b.is_active);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Banner sarlavhasini kiriting");
      return;
    }

    setSubmitting(true);
    const body = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      image_url: imageUrl || null,
      link_url: linkUrl.trim() || null,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    };

    try {
      if (editing) {
        await put(`/admin/banners/${editing.id}`, body);
        toast.success("Banner yangilandi");
      } else {
        await post("/admin/banners", body);
        toast.success("Yangi banner qo'shildi");
      }
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(String(err).replace("Error: ", ""));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (b: Banner) => {
    try {
      await put(`/admin/banners/${b.id}`, {
        title: b.title,
        subtitle: b.subtitle,
        image_url: b.image_url,
        link_url: b.link_url,
        sort_order: b.sort_order,
        is_active: !b.is_active,
      });
      setBanners((prev) =>
        prev.map((item) =>
          item.id === b.id ? { ...item, is_active: !item.is_active } : item
        )
      );
      toast.success(
        b.is_active ? "Banner faolsizlantirildi" : "Banner faollashtirildi"
      );
    } catch (e) {
      toast.error(String(e).replace("Error: ", ""));
    }
  };

  const remove = async (b: Banner) => {
    const ok = await confirm({
      title: "Bannerni o'chirasizmi?",
      message: `"${b.title}" banneri butunlay o'chiriladi.`,
      danger: true,
      confirmText: "O'chirish",
    });
    if (!ok) return;

    try {
      await del(`/admin/banners/${b.id}`);
      setBanners((prev) => prev.filter((item) => item.id !== b.id));
      toast.success("Banner o'chirildi");
    } catch (e) {
      toast.error(String(e).replace("Error: ", ""));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bannerlar va Reklama
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mijoz ilovasi (mijoz_app) bosh sahifasida ko&apos;rinadigan
            aksiyalar, chegirmalar va yangiliklar karuseli.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn inline-flex items-center gap-2 justify-center shadow-sm"
        >
          <Plus size={18} />
          Yangi banner
        </button>
      </div>

      {/* ── BANNER LIST ── */}
      {loading ? (
        <div className="card p-12 text-center text-slate-400">
          Yuklanmoqda...
        </div>
      ) : banners.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-slate-100 grid place-items-center mx-auto text-slate-400">
            <ImageIcon size={24} />
          </div>
          <h3 className="font-semibold text-slate-800">
            Hozircha bannerlar mavjud emas
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Mijoz ilovasida aksiya yoki yangiliklarni ko&apos;rsatish uchun yangi
            banner qo&apos;shing.
          </p>
          <button onClick={openCreate} className="btn-ghost mx-auto">
            + Banner qo&apos;shish
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((b) => (
            <div
              key={b.id}
              className={`card overflow-hidden flex flex-col transition border ${
                b.is_active
                  ? "border-slate-200 shadow-sm"
                  : "border-dashed border-slate-300 opacity-70"
              }`}
            >
              {/* Image Preview */}
              <div className="relative h-36 bg-slate-100 overflow-hidden group">
                {b.image_url ? (
                  <img
                    src={b.image_url}
                    alt={b.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 bg-slate-100">
                    <ImageIcon size={28} />
                    <span className="text-xs">Rasm yo&apos;q</span>
                  </div>
                )}
                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm ${
                      b.is_active
                        ? "bg-emerald-500/90 text-white"
                        : "bg-slate-700/80 text-white"
                    }`}
                  >
                    {b.is_active ? "Faol" : "Nofaol"}
                  </span>
                </div>
                {/* Sort order badge */}
                <div className="absolute top-2 right-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/90 text-slate-700 shadow-sm">
                    Tartib: {b.sort_order}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 line-clamp-1">
                    {b.title}
                  </h3>
                  {b.subtitle && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {b.subtitle}
                    </p>
                  )}
                  {b.link_url && (
                    <a
                      href={b.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline mt-2 line-clamp-1"
                    >
                      <ExternalLink size={12} /> {b.link_url}
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleActive(b)}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                      b.is_active
                        ? "text-slate-600 hover:bg-slate-100"
                        : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                    }`}
                  >
                    {b.is_active ? (
                      <>
                        <EyeOff size={14} /> Yashirish
                      </>
                    ) : (
                      <>
                        <Eye size={14} /> Ko&apos;rsatish
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      className="icon-btn text-slate-600 hover:text-slate-900"
                      title="Tahrirlash"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(b)}
                      className="icon-btn text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      title="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-[fade_.12s_ease-out]"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-[pop_.14s_ease-out]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {editing ? "Bannerni tahrirlash" : "Yangi banner qo'shish"}
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="space-y-4">
              {/* Image Upload */}
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label="Banner rasmi (tavsiya etiladi, ~16:9 nisbat)"
                heightClass="h-44"
              />

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sarlavha <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: 30% chegirma barcha mevalarga!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input w-full"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Qo&apos;shimcha tavsif / Izoh
                </label>
                <textarea
                  rows={2}
                  placeholder="Aksiya muddati yoki qo'shimcha shartlar..."
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="input w-full resize-none"
                />
              </div>

              {/* Link URL & Sort Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Havola / Link (ixtiyoriy)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... yoki havola"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tartib raqami
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-brand focus:ring-brand h-4 w-4"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    Mijoz ilovasida ko&apos;rsatilsin (Faol)
                  </span>
                  <p className="text-xs text-slate-500">
                    O&apos;chirib qo&apos;yilsa, banner ilovada ko&apos;rinmaydi.
                  </p>
                </div>
              </label>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  className="btn-ghost flex-1 justify-center"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="btn flex-1 justify-center"
                  disabled={submitting}
                >
                  {submitting ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
