import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { ContentItem, User } from "./types";

const EMPTY: Partial<ContentItem> = {
  title: "",
  description: "",
  type: "movie",
  genre: "",
  year: null,
  duration_seconds: null,
  poster_url: "",
  hls_path: null,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.catalog();
      setItems(data.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setUser(await api.login(email, password));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      if (editing.id) await api.update(editing.id, editing);
      else await api.create(editing);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this title?")) return;
    try {
      await api.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const visible = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1>OTT Starter Kit — Admin</h1>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}

      {!user ? (
        <form onSubmit={handleLogin} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
          <p>Sign in with an admin account (the first account registered on the backend is the admin).</p>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Sign in</button>
        </form>
      ) : (
        <p>
          Signed in as {user.email} ({user.role}){" "}
          <button onClick={() => { api.logout(); setUser(null); }}>Sign out</button>
        </p>
      )}

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input placeholder="Search titles…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button disabled={!user || user.role !== "admin"} onClick={() => setEditing({ ...EMPTY })}>
          + Add title
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSave} style={{ display: "grid", gap: 8, border: "1px solid #ccc", padding: 16, marginBottom: 16 }}>
          <h2>{editing.id ? "Edit title" : "Add title"}</h2>
          <input placeholder="Title *" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
          <textarea placeholder="Description" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <select value={editing.type ?? "movie"} onChange={(e) => setEditing({ ...editing, type: e.target.value as ContentItem["type"] })}>
            <option value="movie">Movie</option>
            <option value="episode">Episode</option>
            <option value="live">Live</option>
          </select>
          <input placeholder="Genre" value={editing.genre ?? ""} onChange={(e) => setEditing({ ...editing, genre: e.target.value })} />
          <input type="number" placeholder="Year" value={editing.year ?? ""} onChange={(e) => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : null })} />
          <input type="number" placeholder="Duration (seconds)" value={editing.duration_seconds ?? ""} onChange={(e) => setEditing({ ...editing, duration_seconds: e.target.value ? Number(e.target.value) : null })} />
          <input placeholder="Poster URL (https://…)" value={editing.poster_url ?? ""} onChange={(e) => setEditing({ ...editing, poster_url: e.target.value })} />
          <input placeholder="HLS path, e.g. sample/master.m3u8" value={editing.hls_path ?? ""} onChange={(e) => setEditing({ ...editing, hls_path: e.target.value || null })} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Title</th>
            <th style={{ textAlign: "left" }}>Type</th>
            <th style={{ textAlign: "left" }}>Genre</th>
            <th style={{ textAlign: "left" }}>Stream</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => (
            <tr key={item.id} style={{ borderTop: "1px solid #ddd" }}>
              <td>{item.title}</td>
              <td>{item.type}</td>
              <td>{item.genre}</td>
              <td>{item.hls_path ? "Yes" : "—"}</td>
              <td style={{ textAlign: "right" }}>
                <button disabled={!user || user.role !== "admin"} onClick={() => setEditing({ ...item })}>Edit</button>{" "}
                <button disabled={!user || user.role !== "admin"} onClick={() => handleDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{visible.length} of {items.length} titles shown.</p>
    </main>
  );
}
