import React, { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass } from "./Field";
import { FileUpload } from "./FileUpload";
import { Producer } from "../../types/store";
import { errorMessage } from "../../utils/api";

interface ProducerFormProps {
  producer: Producer;
  onSave: (p: Producer) => Promise<void>;
}

export function ProducerForm({ producer, onSave }: ProducerFormProps) {
  const [form, setForm] = useState<Producer>(producer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(producer);

  const set = <K extends keyof Producer,>(key: K, value: Producer[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Nhập tên producer.");
    if (!form.photo) return setError("Cần ảnh chân dung.");
    setError("");
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
      toast.success("Đã lưu thông tin producer");
    } catch (err) {
      toast.error(errorMessage(err, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="producer-title">
      <h2 id="producer-title" className="text-2xl font-semibold">
        Producer
      </h2>
      <p className="mt-1 text-sm text-white/55">Phần giới thiệu ở đầu cửa hàng.</p>

      <div className="mt-6 grid gap-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:grid-cols-[18rem_minmax(0,1fr)]">
        <FileUpload kind="image" label="Ảnh chân dung" value={form.photo} onChange={(url) => set("photo", url ?? "")} hint="Ảnh vuông." />

        <div className="space-y-5">
          <Field label="Tên" htmlFor="p-name">
            <input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dòng phụ · Tiếng Việt" htmlFor="p-tagline-vi" hint="Hiện phía trên tên">
              <input
                id="p-tagline-vi"
                value={form.tagline.vi}
                onChange={(e) => set("tagline", { ...form.tagline, vi: e.target.value })}
                className={inputClass} />
              
            </Field>
            <Field label="Dòng phụ · English" htmlFor="p-tagline-en">
              <input
                id="p-tagline-en"
                value={form.tagline.en}
                onChange={(e) => set("tagline", { ...form.tagline, en: e.target.value })}
                className={inputClass} />
              
            </Field>
          </div>
          <Field label="Giới thiệu · Tiếng Việt" htmlFor="p-bio-vi">
            <textarea
              id="p-bio-vi"
              rows={4}
              value={form.bio.vi}
              onChange={(e) => set("bio", { ...form.bio, vi: e.target.value })}
              className={`${inputClass} resize-y`} />
            
          </Field>
          <Field label="Giới thiệu · English" htmlFor="p-bio-en" hint="Để trống thì bản tiếng Anh sẽ hiện nội dung tiếng Việt.">
            <textarea
              id="p-bio-en"
              rows={4}
              value={form.bio.en}
              onChange={(e) => set("bio", { ...form.bio, en: e.target.value })}
              className={`${inputClass} resize-y`} />
            
          </Field>

          {error &&
          <p className="text-sm text-ember" role="alert">
              {error}
            </p>
          }

          <div className="flex justify-end gap-3">
            {dirty &&
            <button type="button" onClick={() => setForm(producer)} className="rounded-full px-5 py-2.5 text-sm text-white/70 hover:text-white">
                Hoàn tác
              </button>
            }
            <button
              type="submit"
              disabled={!dirty || saving}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition-opacity duration-150 disabled:opacity-40">
              
              {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
              Lưu
            </button>
          </div>
        </div>
      </div>
    </form>);

}