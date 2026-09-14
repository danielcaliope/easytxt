"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) router.push("/");
    else setError((await response.json()).error ?? "Não foi possível entrar");
    setLoading(false);
  }

  return <main className="login-shell"><div className="login-card"><div className="brand login-brand"><span className="brand-mark">✳</span><span>nítida</span><small>SEO + GEO</small></div><p className="eyebrow">WORKSPACE PRIVADO</p><h1>Conteúdo mais nítido começa aqui.</h1><p className="login-copy">Entre para acessar os perfis editoriais e o estúdio de otimização.</p><form onSubmit={submit}><label>Senha de acesso<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus placeholder="Digite a senha compartilhada" /></label>{error && <p className="login-error">{error}</p>}<button className="button button-dark" disabled={loading || !password}>{loading ? "Entrando..." : "Entrar no workspace →"}</button></form></div><div className="login-aside"><span>✦</span><p>SEO para ser encontrado.<br />GEO para ser citado.</p></div></main>;
}
