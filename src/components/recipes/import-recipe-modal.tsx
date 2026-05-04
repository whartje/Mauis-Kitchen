"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Link as LinkIcon, Camera, X, Loader2, AlertCircle,
  Upload, CheckCircle2, Clipboard, Plus, FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

type Tab = "url" | "photo";

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
    const file = e.target.files?.[0];
    if (!file) return;
    addPage(file);
    e.target.value = "";
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

      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Import Recipe</h2>
          <button onClick={handleClose} disabled={isBusy} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {([
            { id: "url" as Tab, icon: LinkIcon, label: "From URL" },
            { id: "photo" as Tab, icon: Camera, label: "Scan Photo" },
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { if (!isBusy) setTab(id); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === id ? "border-brand-orange text-brand-orange" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
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
                  Works with most recipe sites — Minimalist Baker, Oh She Glows, Lazy Cat Kitchen, and more.
                  You can also{" "}
                  <button type="button" onClick={() => setTab("photo")} className="underline hover:text-foreground transition-colors">
                    paste a screenshot
                  </button>{" "}
                  to import from anywhere.
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
                      <span className="text-sm font-medium text-foreground">Upload File</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">JPEG, PNG, or WEBP · up to 10 MB each</p>
                </>
              )}

              {/* Pages collected */}
              {isPages && (
                <>
                  {/* Page thumbnails */}
                  <div className="space-y-2">
                    {(photoStep as { kind: "pages"; pages: PageFile[] }).pages.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-secondary rounded-lg">
                        <div className="relative w-14 h-10 rounded overflow-hidden shrink-0 bg-background">
                          <Image src={p.objectUrl} alt={`Page ${i + 1}`} fill className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Page {i + 1}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.file.name || "screenshot"}</p>
                        </div>
                        <button
                          onClick={() => removePage(i)}
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1"
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
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
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
