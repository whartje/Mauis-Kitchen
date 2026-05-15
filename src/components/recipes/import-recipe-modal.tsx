"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Link as LinkIcon, Camera, X, Loader2, AlertCircle,
  Upload, CheckCircle2, Clipboard, Plus, FileImage, FileText,
  GripVertical, ChevronUp, ChevronDown, Youtube, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

type Tab = "url" | "photo" | "text" | "youtube" | "social";

interface PageFile {
  file: File;
  objectUrl: string;
}

type PhotoStep =
  | { kind: "idle" }
  | { kind: "pages"; pages: PageFile[] }        // 1+ pages collected, waiting to scan
  | { kind: "loading"; message: string }
  | { kind: "select"; titles: string[]; imageUrl: string }
  | { kind: "selecting"; imageUrl: string }
  | { kind: "done" };

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// Create a side-by-side collage of multiple images for the thumbnail
async function createCollage(files: File[]): Promise<File> {
  if (files.length === 1) return files[0];
  return new Promise((resolve) => {
    const HEIGHT = 800;
    const imgs: HTMLImageElement[] = [];
    let loaded = 0;
    files.forEach((file, i) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        imgs[i] = img;
        if (++loaded === files.length) {
          const totalWidth = imgs.reduce((sum, img) => sum + Math.round(img.width * HEIGHT / img.height), 0);
          const canvas = document.createElement("canvas");
          canvas.width = totalWidth;
          canvas.height = HEIGHT;
          const ctx = canvas.getContext("2d")!;
          let x = 0;
          imgs.forEach((img) => {
            const w = Math.round(img.width * HEIGHT / img.height);
            ctx.drawImage(img, x, 0, w, HEIGHT);
            x += w;
          });
          canvas.toBlob((blob) => {
            resolve(blob ? new File([blob], "collage.jpg", { type: "image/jpeg" }) : files[0]);
          }, "image/jpeg", 0.85);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); imgs[i] = new window.Image(); if (++loaded === files.length) resolve(files[0]); };
      img.src = url;
    });
  });
}

// Compress image to max 1600px and ~80% quality before uploading
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const MAX_PX = 1600;
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
        else { width = Math.round(width * MAX_PX / height); height = MAX_PX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], file.name || "photo.jpg", { type: "image/jpeg" }) : file);
      }, "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function ImportRecipeModal({ open, onClose, initialTab = "url" }: Props) {
  const router = useRouter();

  // ── URL tab ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlLoadingMsg, setUrlLoadingMsg] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  // ── Photo tab ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>(initialTab);
  const [photoStep, setPhotoStep] = useState<PhotoStep>({ kind: "idle" });
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Text / paste tab ──────────────────────────────────────────────────────
  const [textInput, setTextInput] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textLoadingMsg, setTextLoadingMsg] = useState("");
  const [textError, setTextError] = useState<string | null>(null);

  // ── YouTube tab ───────────────────────────────────────────────────────────
  const [ytUrl, setYtUrl] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytLoadingMsg, setYtLoadingMsg] = useState("");
  const [ytError, setYtError] = useState<string | null>(null);

  // ── Social tab (Instagram / TikTok) ───────────────────────────────────────
  const [socialUrl, setSocialUrl] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialLoadingMsg, setSocialLoadingMsg] = useState("");
  const [socialError, setSocialError] = useState<string | null>(null);

  // ── Cookbook / collection ─────────────────────────────────────────────────
  const [collection, setCollection] = useState("");
  const [cookbooks, setCookbooks] = useState<string[]>([]);

  // Sync tab when opened with a specific initialTab
  useEffect(() => {
    if (open) setTab(initialTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch existing cookbooks when modal opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/cookbooks")
      .then((r) => r.json())
      .then((d) => setCookbooks(d.cookbooks ?? []))
      .catch(() => {});
  }, [open]);

  // ── Add a page (used by paste, click-to-paste, and file picker) ──────────
  const addPage = useCallback((file: File) => {
    if (!ALLOWED.includes(file.type)) return false;
    const objectUrl = URL.createObjectURL(file);
    setPhotoStep((prev) => {
      const existing = prev.kind === "pages" ? prev.pages : [];
      return { kind: "pages", pages: [...existing, { file, objectUrl }] };
    });
    setPhotoError(null);
    setTab("photo");
    return true;
  }, []);

  // ── Global paste listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      // Don't intercept paste inside text inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file && addPage(file)) {
            e.preventDefault();
            break;
          }
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, addPage]);

  if (!open) return null;

  function handleClose() {
    if (photoStep.kind === "pages") photoStep.pages.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    setPhotoStep({ kind: "idle" });
    setPhotoError(null);
    setUrl("");
    setUrlError(null);
    setTextInput("");
    setTextError(null);
    setYtUrl("");
    setYtError(null);
    setSocialUrl("");
    setSocialError(null);
    onClose();
  }

  function removePage(idx: number) {
    setPhotoStep((prev) => {
      if (prev.kind !== "pages") return prev;
      URL.revokeObjectURL(prev.pages[idx].objectUrl);
      const next = prev.pages.filter((_, i) => i !== idx);
      return next.length === 0 ? { kind: "idle" } : { kind: "pages", pages: next };
    });
  }

  // ── URL import ────────────────────────────────────────────────────────────
  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!collection.trim()) {
      setUrlError("Please choose or enter a cookbook/collection.");
      return;
    }
    setUrlError(null);
    setUrlLoading(true);
    setUrlLoadingMsg("Fetching recipe...");
    const t1 = setTimeout(() => setUrlLoadingMsg("Reading ingredients..."), 1500);
    const t2 = setTimeout(() => setUrlLoadingMsg("Saving to library..."), 3000);
    try {
      const res = await fetch("/api/recipes/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, collection: collection.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(
          res.status === 409
            ? "You already have this recipe saved."
            : data.error?.message ?? "Could not import this recipe. Make sure the URL links directly to a recipe page."
        );
        return;
      }
      router.push(`/recipes/${data.id}`);
      router.refresh();
      handleClose();
    } catch {
      setUrlError("Something went wrong. Please try again.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setUrlLoading(false);
      setUrlLoadingMsg("");
    }
  }

  // ── Photo import ──────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => addPage(f));
    e.target.value = "";
  }

  function movePage(idx: number, dir: -1 | 1) {
    setPhotoStep((prev) => {
      if (prev.kind !== "pages") return prev;
      const pages = [...prev.pages];
      const j = idx + dir;
      if (j < 0 || j >= pages.length) return prev;
      [pages[idx], pages[j]] = [pages[j], pages[idx]];
      return { kind: "pages", pages };
    });
  }

  function handleDragStart(i: number) {
    dragIndexRef.current = i;
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  function handleDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(null);
    const from = dragIndexRef.current;
    if (from === null || from === i) return;
    dragIndexRef.current = null;
    setPhotoStep((prev) => {
      if (prev.kind !== "pages") return prev;
      const pages = [...prev.pages];
      const [moved] = pages.splice(from, 1);
      pages.splice(i, 0, moved);
      return { kind: "pages", pages };
    });
  }

  function handleDragEnd() {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  }

  async function handlePhotoUpload() {
    if (photoStep.kind !== "pages") return;
    if (!collection.trim()) {
      setPhotoError("Please choose or enter a cookbook/collection.");
      return;
    }
    const pages = photoStep.pages;
    pages.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    setPhotoError(null);

    const messages = [
      "Reading your screenshot…",
      "Identifying ingredients…",
      "Combining pages…",
      "Building the recipe…",
    ];
    let msgIdx = 0;
    setPhotoStep({ kind: "loading", message: messages[0] });
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setPhotoStep({ kind: "loading", message: messages[msgIdx] });
    }, 2500);

    try {
      // Compress images before uploading to reduce upload time on mobile
      const compressed = await Promise.all(pages.map((p) => compressImage(p.file)));
      // Create collage thumbnail from all pages
      const thumbnail = await createCollage(compressed);
      const form = new FormData();
      compressed.forEach((f) => form.append("file", f));
      form.append("thumbnail", thumbnail);
      form.append("collection", collection.trim());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      let res: Response;
      try {
        res = await fetch("/api/recipes/import-image", { method: "POST", body: form, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res.json();

      if (!res.ok) {
        setPhotoError(data.error?.message ?? "Could not read a recipe from this image. Try a clearer photo.");
        setPhotoStep({ kind: "idle" });
        return;
      }

      if (data.multipleRecipes) {
        setPhotoStep({ kind: "select", titles: data.titles, imageUrl: data.imageUrl });
        return;
      }

      router.push(`/recipes/${data.id}`);
      router.refresh();
      setPhotoStep({ kind: "done" });
      setTimeout(handleClose, 800);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setPhotoError(isTimeout
        ? "Scan timed out — try with fewer or smaller photos."
        : "Something went wrong. Please try again.");
      setPhotoStep({ kind: "idle" });
    } finally {
      clearInterval(interval);
    }
  }

  // ── Text / paste import ───────────────────────────────────────────────────
  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!collection.trim()) {
      setTextError("Please choose or enter a cookbook/collection.");
      return;
    }
    if (textInput.trim().length < 10) {
      setTextError("Please paste or type the recipe text first.");
      return;
    }
    setTextError(null);
    setTextLoading(true);
    setTextLoadingMsg("Reading your recipe…");
    const t1 = setTimeout(() => setTextLoadingMsg("Identifying ingredients…"), 2000);
    const t2 = setTimeout(() => setTextLoadingMsg("Building the recipe…"), 4500);
    try {
      const res = await fetch("/api/recipes/import-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput.trim(), collection: collection.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTextError(data.error?.message ?? "Could not parse a recipe from this text. Make sure it includes a title, ingredients, and instructions.");
        return;
      }
      router.push(`/recipes/${data.id}`);
      router.refresh();
      handleClose();
    } catch {
      setTextError("Something went wrong. Please try again.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setTextLoading(false);
      setTextLoadingMsg("");
    }
  }

  // ── YouTube import ────────────────────────────────────────────────────────
  async function handleYouTubeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!collection.trim()) {
      setYtError("Please choose or enter a cookbook/collection.");
      return;
    }
    setYtError(null);
    setYtLoading(true);
    setYtLoadingMsg("Fetching transcript…");
    const t1 = setTimeout(() => setYtLoadingMsg("Reading recipe steps…"), 4000);
    const t2 = setTimeout(() => setYtLoadingMsg("Saving to library…"), 9000);
    try {
      const res = await fetch("/api/recipes/import-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl, collection: collection.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setYtError(
          res.status === 409
            ? "You already have this video saved."
            : data.error?.message ?? "Could not import a recipe from this video."
        );
        return;
      }
      router.push(`/recipes/${data.id}`);
      router.refresh();
      handleClose();
    } catch {
      setYtError("Something went wrong. Please try again.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setYtLoading(false);
      setYtLoadingMsg("");
    }
  }

  // ── Social import (Instagram / TikTok) ───────────────────────────────────
  function detectSocialPlatform(url: string): "instagram" | "tiktok" | null {
    try {
      const u = new URL(url);
      if (u.hostname.includes("instagram.com")) return "instagram";
      if (u.hostname.includes("tiktok.com")) return "tiktok";
    } catch { /* invalid */ }
    return null;
  }

  async function handleSocialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!collection.trim()) {
      setSocialError("Please choose or enter a cookbook/collection.");
      return;
    }
    const platform = detectSocialPlatform(socialUrl);
    if (!platform) {
      setSocialError("Please enter a valid Instagram or TikTok URL.");
      return;
    }
    setSocialError(null);
    setSocialLoading(true);
    setSocialLoadingMsg("Fetching post…");
    const t1 = setTimeout(() => setSocialLoadingMsg("Reading recipe…"), 5000);
    const t2 = setTimeout(() => setSocialLoadingMsg("Saving to library…"), 12000);
    try {
      const res = await fetch("/api/recipes/import-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: socialUrl, collection: collection.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSocialError(
          res.status === 409
            ? "You already have this post saved."
            : data.error?.message ?? "Could not import a recipe from this post."
        );
        return;
      }
      router.push(`/recipes/${data.id}`);
      router.refresh();
      handleClose();
    } catch {
      setSocialError("Something went wrong. Please try again.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setSocialLoading(false);
      setSocialLoadingMsg("");
    }
  }

  async function handleSelectRecipe(imageUrl: string, selectedTitle: string) {
    setPhotoStep({ kind: "selecting", imageUrl });
    setPhotoError(null);
    try {
      const res = await fetch("/api/recipes/import-image/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, selectedTitle, collection: collection.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError("Could not import that recipe. Please try again.");
        setPhotoStep({ kind: "idle" });
        return;
      }
      router.push(`/recipes/${data.id}`);
      router.refresh();
      setPhotoStep({ kind: "done" });
      setTimeout(handleClose, 800);
    } catch {
      setPhotoError("Something went wrong. Please try again.");
      setPhotoStep({ kind: "idle" });
    }
  }

  async function readFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith("image/"));
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split("/")[1] ?? "png";
          addPage(new File([blob], `paste.${ext}`, { type: imgType }));
          break;
        }
      }
    } catch {
      // Clipboard API blocked — Ctrl+V still works
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isBusy =
    urlLoading ||
    textLoading ||
    ytLoading ||
    socialLoading ||
    photoStep.kind === "loading" ||
    photoStep.kind === "selecting" ||
    photoStep.kind === "done";

  const isPages = photoStep.kind === "pages";

  // Shared cookbook combobox
  const cookbookField = (
    <div>
      <label className="text-sm text-muted-foreground block mb-1.5">
        Cookbook / Collection <span className="text-red-400">*</span>
      </label>
      <input
        list="cookbook-datalist"
        value={collection}
        onChange={(e) => setCollection(e.target.value)}
        placeholder="e.g. Weeknight Dinners"
        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
      />
      <datalist id="cookbook-datalist">
        {cookbooks.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={isBusy ? undefined : handleClose} />

      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: "min(90dvh, 90vh)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Add Recipe</h2>
          <button onClick={handleClose} disabled={isBusy} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {([
            { id: "url"     as Tab, icon: LinkIcon, label: "From URL"   },
            { id: "photo"   as Tab, icon: Camera,   label: "Scan Photo" },
            { id: "text"    as Tab, icon: FileText,  label: "Paste Text"},
            { id: "youtube" as Tab, icon: Youtube,  label: "YouTube"    },
            { id: "social"  as Tab, icon: Share2,   label: "IG / TikTok"},
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { if (!isBusy) setTab(id); }}
              className={cn(
                "flex-1 min-w-0 flex items-center justify-center gap-1 py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap px-2",
                tab === id
                  ? id === "youtube"
                    ? "border-red-500 text-red-500"
                    : id === "social"
                    ? "border-pink-500 text-pink-500"
                    : "border-brand-orange text-brand-orange"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Body — flex-1 + min-h-0 so it shrinks properly inside the flex column */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">

          {/* ── URL tab ── */}
          {tab === "url" && (
            urlLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
                <p className="text-sm text-muted-foreground">{urlLoadingMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Paste a recipe URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://minimalistbaker.com/..."
                    required
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
                  />
                </div>
                {cookbookField}
                {urlError && (
                  <div className="flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{urlError}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Works with AllRecipes, Food.com, Minimalist Baker, and most recipe sites.
                  Can&apos;t get the URL to work? Try{" "}
                  <button type="button" onClick={() => setTab("photo")} className="underline hover:text-foreground transition-colors">
                    Scan Photo
                  </button>{" "}
                  or{" "}
                  <button type="button" onClick={() => setTab("text")} className="underline hover:text-foreground transition-colors">
                    Type / Paste
                  </button>.
                </p>
                <button
                  type="submit"
                  disabled={!url}
                  className="w-full bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Recipe
                </button>
              </form>
            )
          )}

          {/* ── Photo tab ── */}
          {tab === "photo" && (
            <div className="space-y-4">

              {/* Idle — no pages yet */}
              {photoStep.kind === "idle" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Paste a screenshot, upload, or take a photo. Add multiple pages for recipes that span several screenshots.
                  </p>

                  {/* Paste zone */}
                  <button
                    type="button"
                    onClick={readFromClipboard}
                    className="w-full flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-brand-orange/40 bg-brand-orange/5 hover:bg-brand-orange/10 transition-colors"
                  >
                    <Clipboard className="w-7 h-7 text-brand-orange" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Paste screenshot</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Press{" "}
                        <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs font-mono">Ctrl+V</kbd>{" "}
                        or click here
                      </p>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { fileInputRef.current?.setAttribute("capture", "environment"); fileInputRef.current?.click(); }}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors"
                    >
                      <Camera className="w-7 h-7 text-brand-orange" />
                      <span className="text-sm font-medium text-foreground">Take Photo</span>
                    </button>
                    <button
                      onClick={() => { fileInputRef.current?.removeAttribute("capture"); fileInputRef.current?.click(); }}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors"
                    >
                      <Upload className="w-7 h-7 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Upload Files</span>
                      <span className="text-xs text-muted-foreground -mt-2">Select multiple</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">JPEG, PNG, or WEBP · up to 10 MB each</p>
                </>
              )}

              {/* Pages collected */}
              {isPages && (
                <>
                  {/* Page thumbnails — capped height, scrollable, drag-to-reorder */}
                  <div className="overflow-y-auto space-y-1.5" style={{ maxHeight: "13rem" }}>
                    {(photoStep as { kind: "pages"; pages: PageFile[] }).pages.map((p, i, arr) => (
                      <div
                        key={p.objectUrl}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={(e) => handleDrop(e, i)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg transition-colors",
                          dragOverIndex === i
                            ? "bg-brand-orange/15 ring-1 ring-brand-orange/40"
                            : "bg-secondary"
                        )}
                      >
                        {/* Drag handle */}
                        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />

                        {/* Thumbnail */}
                        <div className="relative w-14 h-10 rounded overflow-hidden shrink-0 bg-background">
                          <Image src={p.objectUrl} alt={`Page ${i + 1}`} fill className="object-cover" />
                        </div>

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Page {i + 1}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.file.name || "screenshot"}</p>
                        </div>

                        {/* Up / down — mobile-friendly reorder */}
                        <div className="flex flex-col gap-0 shrink-0">
                          <button
                            onClick={() => movePage(i, -1)}
                            disabled={i === 0}
                            aria-label="Move up"
                            className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => movePage(i, 1)}
                            disabled={i === arr.length - 1}
                            aria-label="Move down"
                            className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removePage(i)}
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1 shrink-0"
                          aria-label="Remove page"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add another page */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={readFromClipboard}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-brand-orange/40 text-sm text-brand-orange hover:bg-brand-orange/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Paste next page
                    </button>
                    <button
                      type="button"
                      onClick={() => { fileInputRef.current?.removeAttribute("capture"); fileInputRef.current?.click(); }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <FileImage className="w-4 h-4" />
                      Upload page
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {(photoStep as { kind: "pages"; pages: PageFile[] }).pages.length} page{(photoStep as { kind: "pages"; pages: PageFile[] }).pages.length !== 1 ? "s" : ""} · Claude will merge them into one recipe
                  </p>

                  {cookbookField}
                </>
              )}

              {/* Loading */}
              {photoStep.kind === "loading" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
                  <p className="text-sm text-muted-foreground">{photoStep.message}</p>
                </div>
              )}

              {/* Multiple recipes found */}
              {photoStep.kind === "select" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Multiple recipes found. Which one would you like to import?
                  </p>
                  <div className="space-y-2">
                    {photoStep.titles.map((title) => (
                      <button
                        key={title}
                        onClick={() => handleSelectRecipe(photoStep.imageUrl, title)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-brand-orange/50 hover:bg-brand-orange/5 text-sm font-medium text-foreground transition-colors"
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Selecting */}
              {photoStep.kind === "selecting" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
                  <p className="text-sm text-muted-foreground">Building recipe...</p>
                </div>
              )}

              {/* Done */}
              {photoStep.kind === "done" && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <p className="text-sm font-medium text-foreground">Recipe saved!</p>
                </div>
              )}

              {/* Error */}
              {photoError && (
                <div className="flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{photoError}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* ── Text / Paste tab ── */}
          {tab === "text" && (
            textLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
                <p className="text-sm text-muted-foreground">{textLoadingMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">
                    Paste or type your recipe
                  </label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={`Paste a recipe from an email, cookbook, or anywhere else…\n\nExample:\nChocolate Chip Cookies\nMakes 24 cookies\n\n1 cup butter\n2 eggs\n2 cups flour\n…`}
                    rows={10}
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Include the title, ingredients, and instructions — Claude will parse and structure everything automatically.
                  </p>
                </div>
                {cookbookField}
                {textError && (
                  <div className="flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{textError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={textInput.trim().length < 10}
                  className="w-full bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Parse &amp; Save Recipe
                </button>
              </form>
            )
          )}

          {/* ── Social tab (Instagram / TikTok) ── */}
          {tab === "social" && (
            socialLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                <p className="text-sm text-muted-foreground">{socialLoadingMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSocialSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">
                    Instagram or TikTok post URL
                  </label>
                  <input
                    type="url"
                    value={socialUrl}
                    onChange={(e) => setSocialUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/... or https://www.tiktok.com/..."
                    required
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-500 transition"
                  />
                  {socialUrl && (
                    <p className={cn(
                      "text-xs mt-1.5 font-medium",
                      detectSocialPlatform(socialUrl) === "instagram" ? "text-pink-500" :
                      detectSocialPlatform(socialUrl) === "tiktok" ? "text-teal-500" :
                      "text-red-400"
                    )}>
                      {detectSocialPlatform(socialUrl) === "instagram" ? "📸 Instagram post detected" :
                       detectSocialPlatform(socialUrl) === "tiktok" ? "🎵 TikTok video detected" :
                       "⚠️ Must be an Instagram or TikTok URL"}
                    </p>
                  )}
                </div>
                {cookbookField}
                {socialError && (
                  <div className="flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{socialError}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Works best with posts where the creator shared the full recipe in their caption.
                  For TikTok, look for posts tagged{" "}
                  <span className="font-mono">#recipeincaption</span>.
                </p>
                <button
                  type="submit"
                  disabled={!socialUrl || !detectSocialPlatform(socialUrl)}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Import from{" "}
                  {detectSocialPlatform(socialUrl) === "tiktok" ? "TikTok" :
                   detectSocialPlatform(socialUrl) === "instagram" ? "Instagram" :
                   "Social"}
                </button>
              </form>
            )
          )}

          {/* ── YouTube tab ── */}
          {tab === "youtube" && (
            ytLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                <p className="text-sm text-muted-foreground">{ytLoadingMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleYouTubeSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">YouTube video URL</label>
                  <input
                    type="url"
                    value={ytUrl}
                    onChange={(e) => setYtUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition"
                  />
                </div>

                {cookbookField}

                {ytError && (
                  <div className="flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{ytError}</span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Works best with cooking tutorials that have auto-generated captions. Supports youtube.com and youtu.be links.
                </p>

                <button
                  type="submit"
                  disabled={!ytUrl}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Youtube className="w-4 h-4" />
                  Import from YouTube
                </button>
              </form>
            )
          )}
        </div>

        {/* Sticky action footer — always visible when pages are collected */}
        {isPages && (
          <div className="px-6 pb-5 pt-4 shrink-0 border-t border-border bg-card">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  (photoStep as { kind: "pages"; pages: PageFile[] }).pages.forEach((p) => URL.revokeObjectURL(p.objectUrl));
                  setPhotoStep({ kind: "idle" });
                }}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Start over
              </button>
              <button
                onClick={handlePhotoUpload}
                className="flex-1 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-dark text-black text-sm font-semibold transition-colors"
              >
                Scan Recipe
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
