import React, { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass } from "./Field";
import { SocialIcon } from "../SocialIcon";
import { StoreInfo } from "../../types/store";
import { errorMessage } from "../../utils/api";

interface ContactFormProps {
  info: StoreInfo;
  onSave: (info: StoreInfo) => Promise<void>;
}

export function ContactForm({ info, onSave }: ContactFormProps) {
  const [form, setForm] = useState<StoreInfo>(info);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(info);

  const setHours = (lang: "vi" | "en", value: string) =>
  setForm((f) => ({ ...f, contact: { ...f.contact, hours: { ...f.contact.hours, [lang]: value } } }));

  const setContact = (key: "phone" | "email", value: string) =>
  setForm((f) => ({
    ...f,
    contact: {
      ...f.contact,
      [key]: value,
      ...(key === "phone" ? { phoneHref: `tel:${value.replace(/[^\d+]/g, "")}` } : {})
    }
  }));

  const setSocial = (i: number, key: "handle" | "href", value: string) =>
  setForm((f) => ({ ...f, socials: f.socials.map((s, idx) => idx === i ? { ...s, [key]: value } : s) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      toast.success("Đã lưu thông tin liên hệ");
    } catch (err) {
      toast.error(errorMessage(err, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="contact-admin-title">
      <h2 id="contact-admin-title" className="text-2xl font-semibold">
        Liên hệ
      </h2>
      <p className="mt-1 text-sm text-white/55">Hiển thị ở cuối cửa hàng và cạnh nút Nghe ngay.</p>

      <div className="mt-6 space-y-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Số điện thoại" htmlFor="c-phone">
            <input id="c-phone" inputMode="tel" value={form.contact.phone} onChange={(e) => setContact("phone", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email" htmlFor="c-email">
            <input id="c-email" type="email" value={form.contact.email} onChange={(e) => setContact("email", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Giờ hỗ trợ · Tiếng Việt" htmlFor="c-hours-vi">
            <input id="c-hours-vi" value={form.contact.hours.vi} onChange={(e) => setHours("vi", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Giờ hỗ trợ · English" htmlFor="c-hours-en">
            <input id="c-hours-en" value={form.contact.hours.en} onChange={(e) => setHours("en", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-white/80">Mạng xã hội</p>
          <ul className="divide-y divide-white/[0.06] rounded-2xl ring-1 ring-inset ring-white/10">
            {form.socials.map((s, i) =>
            <li key={s.kind} className="grid items-center gap-3 p-4 md:grid-cols-[8rem_minmax(0,12rem)_minmax(0,1fr)]">
                <span className="flex items-center gap-2 text-sm text-white">
                  <SocialIcon kind={s.kind} />
                  {s.label}
                </span>
                <input
                aria-label={`Tên hiển thị ${s.label}`}
                value={s.handle}
                onChange={(e) => setSocial(i, "handle", e.target.value)}
                placeholder="@tenban"
                className={inputClass} />
              
                <input
                aria-label={`Link ${s.label}`}
                type="url"
                value={s.href}
                onChange={(e) => setSocial(i, "href", e.target.value)}
                placeholder="https://"
                className={inputClass} />
              
              </li>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          {dirty &&
          <button type="button" onClick={() => setForm(info)} className="rounded-full px-5 py-2.5 text-sm text-white/70 hover:text-white">
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
    </form>);

}