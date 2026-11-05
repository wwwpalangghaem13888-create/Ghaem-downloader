"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Task = { id: string; source_url: string; status: string; title: string | null; error: string | null; created_at: string };
const labels: Record<string, string> = { queued: "در صف", downloading: "در حال دانلود", completed: "تکمیل‌شده", failed: "ناموفق", cancelled: "لغوشده" };

export default function Home() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const value = sessionStorage.getItem("ghaem_dashboard_token") || "";
    setToken(value);
    setSaved(Boolean(value));
  }, []);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", "X-Dashboard-Token": token, ...(init.headers || {}) }, cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "درخواست ناموفق بود");
    }
    return response.json();
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try { setTasks(await api("/api/tasks")); setNotice(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "خطای ارتباط"); }
  }, [api, token]);

  useEffect(() => {
    if (!saved || !token) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [saved, token, refresh]);

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((t) => ["queued", "downloading"].includes(t.status)).length,
    complete: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  }), [tasks]);

  function login(event: FormEvent) {
    event.preventDefault();
    sessionStorage.setItem("ghaem_dashboard_token", token);
    setSaved(true);
  }

  async function createTask(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await api("/api/tasks", { method: "POST", body: JSON.stringify({ source_url: url }) });
      setUrl(""); setNotice("درخواست به صف اضافه شد."); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "ثبت درخواست ناموفق بود"); }
    finally { setBusy(false); }
  }

  async function cancelTask(id: string) {
    try { await api("/api/tasks/" + id, { method: "DELETE" }); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "لغو درخواست ناموفق بود"); }
  }

  async function downloadTask(id: string) {
    try {
      const response = await fetch("/api/tasks/" + id + "/file", { headers: { "X-Dashboard-Token": token }, cache: "no-store" });
      if (!response.ok) throw new Error("فایل دیگر در دسترس نیست.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = id;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "دریافت فایل ناموفق بود");
    }
  }

  if (!saved) return <main className="login"><section className="login-card"><div className="logo">G</div><p className="eyebrow">GHAEM / CONTROL ROOM</p><h1>ورود به پنل مدیریت</h1><p className="muted">توکن دسترسی پنل را وارد کن. مقدار آن فقط در نشست همین مرورگر ذخیره می‌شود.</p><form onSubmit={login}><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Dashboard access token" required /><button className="primary">ورود به پنل</button></form></section></main>;

  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="logo">G</div><div><b>GHAEM</b><small>DOWNLOAD MANAGER</small></div></div><div className="top-actions"><span className="live">سیستم مدیریت</span><button className="secondary" onClick={() => { sessionStorage.removeItem("ghaem_dashboard_token"); setSaved(false); setToken(""); }}>خروج</button></div></header>
    <section className="hero"><div><p className="eyebrow">CONTROL ROOM / OVERVIEW</p><h1>مرکز مدیریت دانلود</h1><p className="muted">وضعیت صف، اجرای دانلودها و خروجی‌های آماده را از یک نقطه مدیریت کن.</p></div><button className="secondary" onClick={() => void refresh()}>↻ به‌روزرسانی</button></section>
    <section className="stats"><article><span>کل درخواست‌ها</span><b>{stats.total}</b><small>آخرین ۵۰ مورد</small></article><article><span>در حال پردازش</span><b>{stats.active}</b><small>صف و دانلود فعال</small></article><article><span>تکمیل‌شده</span><b>{stats.complete}</b><small>آماده دریافت</small></article><article><span>ناموفق</span><b>{stats.failed}</b><small>نیازمند بررسی</small></article></section>
    <section className="panel form-panel"><div><p className="eyebrow">NEW JOB</p><h2>ساخت درخواست دانلود</h2><p className="muted">فقط لینک عمومی از دامنه‌های مجاز.</p></div><form onSubmit={createTask}><input dir="ltr" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." required /><button className="primary" disabled={busy}>{busy ? "در حال ثبت..." : "افزودن به صف"}</button></form></section>
    {notice && <div className="notice">{notice}</div>}
    <section className="panel"><div className="section-title"><div><p className="eyebrow">TASK QUEUE</p><h2>درخواست‌های اخیر</h2></div><small>{tasks.length} مورد</small></div><div className="table-wrap"><table><thead><tr><th>وضعیت</th><th>عنوان / لینک</th><th>شناسه</th><th>زمان ثبت</th><th>عملیات</th></tr></thead><tbody>
      {tasks.map((task) => <tr key={task.id}><td><span className={"status " + task.status}>{labels[task.status] || task.status}</span></td><td className="url"><b>{task.title || "در انتظار پردازش"}</b><a href={task.source_url} target="_blank" rel="noreferrer">{task.source_url}</a>{task.error && <small className="error">{task.error}</small>}</td><td className="mono">{task.id.slice(0, 8)}</td><td>{new Date(task.created_at).toLocaleString("fa-IR")}</td><td>{task.status === "completed" && <button className="download" onClick={() => void downloadTask(task.id)}>دریافت فایل</button>}{["queued", "downloading"].includes(task.status) && <button className="danger" onClick={() => void cancelTask(task.id)}>لغو</button>}</td></tr>)}
      {tasks.length === 0 && <tr><td colSpan={5} className="empty">هنوز درخواستی ثبت نشده است.</td></tr>}
    </tbody></table></div></section>
    <footer>GHAEM DOWNLOADER <span>نسخهٔ توسعه 0.2.0 · نگه‌داری فایل‌ها: ۲۴ ساعت</span></footer>
  </main>;
}
