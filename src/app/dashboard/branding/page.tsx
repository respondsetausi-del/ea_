"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Upload, Save, Image as ImageIcon } from "lucide-react";
import type { Branding } from "@/lib/database.types";

const ACCENT = "#FFB800";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(255,184,0,0.1)";

const GLOW_PRESETS = [
  "#00BFFF", "#A855F7", "#00FF88", "#FF3366", "#FF6B00",
  "#FFD700", "#FF00FF", "#EF4444", "#3B82F6", "#14B8A6",
  "#84CC16", "#00FFCC", "#EC4899", "#FFFFFF",
];

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ app_name: "Free Robot", glow_color: "#FFFFFF", tagline: "" });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [robotPreview, setRobotPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const robotRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [robotFile, setRobotFile] = useState<File | null>(null);

  useEffect(() => {
    async function load() {
      if (DEV_MODE) {
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("branding").select("*").eq("distributor_id", user.id).single();
      if (data) {
        setBranding(data);
        setForm({ app_name: data.app_name, glow_color: data.glow_color, tagline: data.tagline || "" });
        setLogoPreview(data.logo_url);
        setRobotPreview(data.robot_image_url);
      }
      setLoading(false);
    }
    load();
  }, []);

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(data.path);
    return publicUrl;
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      let logo_url = branding?.logo_url || null;
      let robot_image_url = branding?.robot_image_url || null;

      if (logoFile) {
        logo_url = await uploadFile(logoFile, `${user.id}/logo-${Date.now()}.${logoFile.name.split('.').pop()}`);
      }
      if (robotFile) {
        robot_image_url = await uploadFile(robotFile, `${user.id}/robot-${Date.now()}.${robotFile.name.split('.').pop()}`);
      }

      const payload = {
        app_name: form.app_name,
        glow_color: form.glow_color,
        tagline: form.tagline || null,
        logo_url,
        robot_image_url,
        updated_at: new Date().toISOString(),
      };

      if (branding) {
        await supabase.from("branding").update(payload).eq("id", branding.id);
      } else {
        await supabase.from("branding").insert({ ...payload, distributor_id: user.id });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
    setSaving(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "robot") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === "logo") { setLogoFile(file); setLogoPreview(url); }
    else { setRobotFile(file); setRobotPreview(url); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">White-Label Branding</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>Customize how your app looks for your users</p>
      </div>

      <div className="rounded-2xl p-6 space-y-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div>
          <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>APP NAME</label>
          <input value={form.app_name} onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))}
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
            onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
            onBlur={e => e.target.style.borderColor = BORDER}
            placeholder="Your App Name" />
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>TAGLINE</label>
          <input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
            onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
            onBlur={e => e.target.style.borderColor = BORDER}
            placeholder="e.g. Fully automated mobile EA" />
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>GLOW COLOR</label>
          <div className="flex flex-wrap gap-3">
            {GLOW_PRESETS.map(color => (
              <button key={color} onClick={() => setForm(f => ({ ...f, glow_color: color }))}
                className="w-8 h-8 rounded-full transition"
                style={{
                  backgroundColor: color,
                  border: form.glow_color === color ? "2px solid #F0F6FC" : `2px solid rgba(255,255,255,0.1)`,
                  boxShadow: form.glow_color === color ? `0 0 12px ${color}` : "none",
                  transform: form.glow_color === color ? "scale(1.15)" : "scale(1)",
                }} />
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: BORDER }} />

        <div>
          <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>APP LOGO</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                 style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon style={{ color: MUTED }} size={24} />
              )}
            </div>
            <button onClick={() => logoRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
              <Upload size={14} />
              Upload Logo
            </button>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "logo")} />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>ROBOT / HERO IMAGE</label>
          <p className="text-[10px] mb-3" style={{ color: MUTED }}>This appears as the main avatar in the app</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                 style={{ border: `2px solid ${form.glow_color}60`, background: "rgba(255,255,255,0.04)" }}>
              {robotPreview ? (
                <img src={robotPreview} alt="Robot" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🤖</span>
              )}
            </div>
            <button onClick={() => robotRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
              <Upload size={14} />
              Upload Image
            </button>
            <input ref={robotRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e, "robot")} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-[10px] font-bold tracking-widest mb-4" style={{ color: MUTED }}>PREVIEW</p>
        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden mb-3"
               style={{ border: `2px solid ${form.glow_color}`, boxShadow: `0 0 20px ${form.glow_color}40` }}>
            {robotPreview ? (
              <img src={robotPreview} alt="Robot" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-black" style={{ color: form.glow_color }}>{form.app_name.charAt(0)}</span>
            )}
          </div>
          <p className="text-lg font-black tracking-wider" style={{ color: form.glow_color }}>{form.app_name || "App Name"}</p>
          {form.tagline && <p className="text-xs mt-1" style={{ color: MUTED }}>{form.tagline}</p>}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
        style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(255,184,0,0.3)" }}>
        <Save size={16} />
        {saving ? "Saving..." : success ? "Saved!" : "Save Branding"}
      </button>
    </div>
  );
}
