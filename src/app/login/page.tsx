"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => (response.ok ? response.json() : { needsSetup: false }))
      .then((data: { needsSetup: boolean }) => setNeedsSetup(data.needsSetup))
      .catch(() => setNeedsSetup(false))
      .finally(() => setCheckingSetup(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const endpoint = needsSetup ? "/api/auth/setup" : "/api/auth/login";
    const body = needsSetup ? { nome, email, senha } : { email, senha };
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) router.push("/");
    else setError((await response.json()).error ?? "Não foi possível entrar");
    setLoading(false);
  }

  if (checkingSetup) return <main className="login-shell" />;

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand login-brand"><span className="brand-mark">✳</span><span>nítida</span><small>SEO + GEO</small></div>
        <p className="eyebrow">{needsSetup ? "PRIMEIRO ACESSO" : "WORKSPACE PRIVADO"}</p>
        <h1>{needsSetup ? "Crie a conta de administrador." : "Conteúdo mais nítido começa aqui."}</h1>
        <p className="login-copy">{needsSetup ? "Essa conta poderá cadastrar os demais usuários do workspace." : "Entre para acessar os perfis editoriais e o estúdio de otimização."}</p>
        <form onSubmit={submit}>
          {needsSetup && <label>Nome<input value={nome} onChange={(event) => setNome(event.target.value)} autoFocus placeholder="Seu nome" /></label>}
          <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus={!needsSetup} placeholder="voce@empresa.com.br" /></label>
          <label>Senha<input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder={needsSetup ? "Mínimo de 6 caracteres" : "Digite sua senha"} /></label>
          {error && <p className="login-error">{error}</p>}
          <button className="button button-dark" disabled={loading || !email || !senha || (needsSetup && !nome)}>{loading ? "Entrando..." : needsSetup ? "Criar conta e entrar →" : "Entrar no workspace →"}</button>
        </form>
      </div>
      <div className="login-aside"><span>✦</span><p>SEO para ser encontrado.<br />GEO para ser citado.</p></div>
    </main>
  );
}
