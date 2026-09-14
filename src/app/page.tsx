"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PALETTE = ["coral", "mint", "lilac", "yellow", "blue"] as const;

type Site = {
  id?: string;
  name: string;
  url: string;
  niche: string;
  audience: string;
  tone: string;
  styleNotes: string;
  status: "concluído" | "pendente" | "erro";
  color: string;
  keywords: string[];
};

type SiteFormState = { nome: string; url: string; nicho: string; publicoAlvo: string; tomDeVoz: string; palavrasChaveBase: string; notasDeEstilo: string };

type GenerationResult = { texto_otimizado: string; meta_title: string; meta_description: string; palavras_chave_usadas: string[]; palavras_chave_sugeridas: string[]; alt_texts: string[] };

type Generation = { id: string; siteName: string; textoOtimizado: string; metaTitle: string; metaDescription: string; palavrasChaveUsadas: string[]; altTexts: string[]; criadoEm: string };

type CurrentUser = { id: string; nome: string; email: string; role: "ADMIN" | "MEMBRO" };

type UserAccount = { id: string; nome: string; email: string; role: "ADMIN" | "MEMBRO"; criadoEm: string };

type AiProviderName = "GEMINI" | "OPENAI" | "ANTHROPIC" | "GROQ";

type AiSettingsState = { provider: AiProviderName; model: string; apiKeyMasked: string; hasApiKey: boolean };

const AI_PROVIDER_LABELS: Record<AiProviderName, string> = {
  GEMINI: "Google Gemini",
  OPENAI: "OpenAI (ChatGPT)",
  ANTHROPIC: "Anthropic (Claude)",
  GROQ: "Groq (Llama e outros)",
};

const AI_PROVIDER_HINTS: Record<AiProviderName, string> = {
  GEMINI: "ex. gemini-3.6-flash",
  OPENAI: "ex. gpt-4o-mini",
  ANTHROPIC: "ex. claude-sonnet-5",
  GROQ: "ex. llama-3.1-8b-instant",
};

const initialSites: Site[] = [
  { name: "Karol Festas", url: "karolfestas.com.br", niche: "artigos para festas infantis", audience: "Pais e organizadores de festa infantil", tone: "Alegre e próximo", styleNotes: "Frases curtas, CTA direto no fim do texto.", status: "concluído", color: "coral", keywords: ["decoração de festa", "festa infantil", "balões"] },
  { name: "Bello Festas", url: "bellofestas.com.br", niche: "artigos para celebrações", audience: "Anfitriões de eventos e celebrações", tone: "Inspirador e acolhedor", styleNotes: "Parágrafos médios, tom emocional na abertura.", status: "concluído", color: "mint", keywords: ["festa personalizada", "lembrancinhas", "decoração"] },
  { name: "Casa Nuvem", url: "casanuvem.com.br", niche: "papelaria criativa", audience: "Consumidores de papelaria e presentes", tone: "Leve e criativo", styleNotes: "Aguardando scan da IA.", status: "pendente", color: "lilac", keywords: ["papelaria", "presentes criativos"] },
];

const baseNavItems = [
  ["Visão geral", "⌂"],
  ["Gerar conteúdo", "✦"],
  ["Sites e perfis", "◎"],
  ["Histórico", "↺"],
] as const;

function mapApiSite(site: Record<string, unknown>, index = 0): Site {
  const status = site.statusScan === "CONCLUIDO" ? "concluído" : site.statusScan === "ERRO" ? "erro" : "pendente";
  return {
    id: typeof site.id === "string" ? site.id : undefined,
    name: String(site.nome ?? "Site sem nome"),
    url: String(site.url ?? ""),
    niche: String(site.nicho ?? "") || "Aguardando scan da IA",
    audience: String(site.publicoAlvo ?? ""),
    tone: String(site.tomDeVoz ?? "") || "A definir",
    styleNotes: String(site.notasDeEstilo ?? ""),
    status,
    color: PALETTE[index % PALETTE.length],
    keywords: Array.isArray(site.palavrasChaveBase) ? site.palavrasChaveBase.filter((value): value is string => typeof value === "string") : [],
  };
}

function mapApiGeneration(row: Record<string, unknown>): Generation {
  const site = row.site as Record<string, unknown> | undefined;
  return {
    id: String(row.id ?? ""),
    siteName: String(site?.nome ?? "Site removido"),
    textoOtimizado: String(row.textoOtimizado ?? ""),
    metaTitle: String(row.metaTitle ?? ""),
    metaDescription: String(row.metaDescription ?? ""),
    palavrasChaveUsadas: Array.isArray(row.palavrasChaveUsadas) ? row.palavrasChaveUsadas.filter((v): v is string => typeof v === "string") : [],
    altTexts: Array.isArray(row.altTexts) ? row.altTexts.filter((v): v is string => typeof v === "string") : [],
    criadoEm: String(row.criadoEm ?? ""),
  };
}

function mapApiUser(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id ?? ""),
    nome: String(row.nome ?? ""),
    email: String(row.email ?? ""),
    role: row.role === "ADMIN" ? "ADMIN" : "MEMBRO",
    criadoEm: String(row.criadoEm ?? ""),
  };
}

function siteKey(site: Site) {
  return site.id ?? site.name;
}

function siteToForm(site: Site): SiteFormState {
  return { nome: site.name, url: site.url, nicho: site.niche === "Aguardando scan da IA" ? "" : site.niche, publicoAlvo: site.audience, tomDeVoz: site.tone === "A definir" ? "" : site.tone, palavrasChaveBase: site.keywords.join(", "), notasDeEstilo: site.styleNotes };
}

export default function Home() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Visão geral");
  const [sites, setSites] = useState(initialSites);
  const [selectedSite, setSelectedSite] = useState(siteKey(initialSites[0]));
  const [sourceText, setSourceText] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [copied, setCopied] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [showNewSite, setShowNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [siteError, setSiteError] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editForm, setEditForm] = useState<SiteFormState | null>(null);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ nome: "", email: "", senha: "", role: "MEMBRO" as "ADMIN" | "MEMBRO" });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [generationsLoaded, setGenerationsLoaded] = useState(false);
  const isLoadingGenerations = activeNav === "Histórico" && !generationsLoaded;
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettingsState | null>(null);
  const [aiSettingsLoaded, setAiSettingsLoaded] = useState(false);
  const [aiForm, setAiForm] = useState({ provider: "GEMINI" as AiProviderName, model: "", apiKey: "" });
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const isAdmin = currentUser?.role === "ADMIN";
  const isLoadingUsers = activeNav === "Usuários" && isAdmin && !usersLoaded;
  const isLoadingAiSettings = activeNav === "Modelo de IA" && isAdmin && !aiSettingsLoaded;
  const navItems = isAdmin ? [...baseNavItems, ["Usuários", "◈"] as const, ["Modelo de IA", "◆"] as const] : baseNavItems;

  const currentSite = sites.find((site) => siteKey(site) === selectedSite) ?? sites[0];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: CurrentUser | null) => setCurrentUser(data))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (!isLoadingUsers) return;
    fetch("/api/users")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Array<Record<string, unknown>>) => {
        setUsers(data.map(mapApiUser));
        setUsersLoaded(true);
      })
      .catch(() => {
        setSiteError("Não foi possível carregar os usuários.");
        setUsersLoaded(true);
      });
  }, [isLoadingUsers]);

  useEffect(() => {
    if (!isLoadingAiSettings) return;
    fetch("/api/settings/ai")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: AiSettingsState) => {
        setAiSettings(data);
        setAiForm({ provider: data.provider, model: data.model, apiKey: "" });
        setAiSettingsLoaded(true);
      })
      .catch(() => {
        setSiteError("Não foi possível carregar a configuração de IA.");
        setAiSettingsLoaded(true);
      });
  }, [isLoadingAiSettings]);

  async function saveAiSettings() {
    if (!aiForm.model.trim() || (!aiForm.apiKey.trim() && !aiSettings?.hasApiKey)) return;
    setIsSavingAiSettings(true);
    try {
      const response = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiForm.provider, model: aiForm.model.trim(), apiKey: aiForm.apiKey.trim() }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível salvar a configuração");
      const updated = (await response.json()) as AiSettingsState;
      setAiSettings(updated);
      setAiForm({ provider: updated.provider, model: updated.model, apiKey: "" });
      setScanMessage("Configuração de IA salva.");
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : "Não foi possível salvar a configuração de IA");
    } finally {
      setIsSavingAiSettings(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  useEffect(() => {
    fetch("/api/sites")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os sites");
        return response.json();
      })
      .then((data: Array<Record<string, unknown>>) => {
        if (!data.length) return;
        const mapped = data.map(mapApiSite);
        setSites(mapped);
        setSelectedSite(siteKey(mapped[0]));
      })
      .catch(() => setSiteError("Banco ainda não conectado. Exibindo dados de demonstração."))
      .finally(() => setIsLoadingSites(false));
  }, []);

  useEffect(() => {
    if (!isLoadingGenerations) return;
    fetch("/api/geracoes")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Array<Record<string, unknown>>) => {
        setGenerations(data.map(mapApiGeneration));
        setGenerationsLoaded(true);
      })
      .catch(() => {
        setSiteError("Não foi possível carregar o histórico.");
        setGenerationsLoaded(true);
      });
  }, [isLoadingGenerations]);

  async function optimize(text: string, images: File[]) {
    if (!text.trim()) return;
    setIsOptimizing(true);
    const formData = new FormData();
    formData.set("site_id", currentSite.id ?? "");
    formData.set("texto", text);
    images.forEach((image) => formData.append("imagens", image));
    try {
      const response = await fetch("/api/gerar-conteudo", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível gerar o conteúdo");
      setGenerationResult(payload as GenerationResult);
      setGenerationsLoaded(false);
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : "Não foi possível gerar o conteúdo");
    } finally {
      setIsOptimizing(false);
    }
  }

  function openEdit(site: Site) {
    setEditingSite(site);
    setEditForm(siteToForm(site));
  }

  function closeEdit() {
    setEditingSite(null);
    setEditForm(null);
  }

  function updateEditField(field: keyof SiteFormState, value: string) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function addSite() {
    if (!newSiteName.trim() || !newSiteUrl.trim()) return;
    setShowNewSite(false);
    try {
      const response = await fetch("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: newSiteName, url: newSiteUrl }) });
      if (!response.ok) throw new Error("Não foi possível criar o site");
      const created = mapApiSite(await response.json());
      setSites((current) => [...current, created]);
      setSelectedSite(siteKey(created));
      setNewSiteName("");
      setNewSiteUrl("");
      openEdit(created);
      setScanMessage("Escaneando o site para preencher o perfil...");
      if (created.id) {
        const scanResponse = await fetch(`/api/sites/${created.id}/scan`, { method: "POST" });
        if (scanResponse.ok) {
          const scanned = mapApiSite(await scanResponse.json());
          setSites((current) => current.map((site) => (site.id === scanned.id ? scanned : site)));
          setEditingSite(scanned);
          setEditForm(siteToForm(scanned));
          setScanMessage("Perfil preenchido pelo scan da IA. Revise e salve.");
        } else {
          setScanMessage("O scan falhou. Preencha os campos manualmente e salve.");
        }
      }
    } catch {
      setSiteError("Não foi possível salvar. Configure DATABASE_URL e execute npm run db:push.");
      setScanMessage("");
    }
  }

  async function saveEditedSite() {
    if (!editingSite?.id || !editForm) return;
    setIsSavingSite(true);
    try {
      const response = await fetch(`/api/sites/${editingSite.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editForm.nome,
          url: editForm.url,
          nicho: editForm.nicho,
          publicoAlvo: editForm.publicoAlvo,
          tomDeVoz: editForm.tomDeVoz,
          palavrasChaveBase: editForm.palavrasChaveBase.split(",").map((term) => term.trim()).filter(Boolean),
          notasDeEstilo: editForm.notasDeEstilo,
        }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar o site");
      const updated = mapApiSite(await response.json());
      setSites((current) => current.map((site) => (site.id === updated.id ? updated : site)));
      setSelectedSite((current) => (current === siteKey(editingSite) ? siteKey(updated) : current));
      setScanMessage("Site salvo.");
      closeEdit();
    } catch {
      setSiteError("Não foi possível salvar as alterações do site.");
    } finally {
      setIsSavingSite(false);
    }
  }

  async function rescanEditingSite() {
    if (!editingSite?.id) return;
    setIsRescanning(true);
    setScanMessage("Reescaneando o site...");
    try {
      const response = await fetch(`/api/sites/${editingSite.id}/scan`, { method: "POST" });
      if (!response.ok) throw new Error("Scan falhou");
      const scanned = mapApiSite(await response.json());
      setSites((current) => current.map((site) => (site.id === scanned.id ? scanned : site)));
      setEditingSite(scanned);
      setEditForm(siteToForm(scanned));
      setScanMessage("Perfil atualizado pelo scan da IA. Revise e salve.");
    } catch {
      setScanMessage("O reescaneio falhou. Ajuste os campos manualmente.");
    } finally {
      setIsRescanning(false);
    }
  }

  async function addUser() {
    if (!newUserForm.nome.trim() || !newUserForm.email.trim() || newUserForm.senha.length < 6) return;
    setIsSavingUser(true);
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUserForm) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível criar o usuário");
      const created = mapApiUser(await response.json());
      setUsers((current) => [...current, created]);
      setShowNewUser(false);
      setNewUserForm({ nome: "", email: "", senha: "", role: "MEMBRO" });
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : "Não foi possível criar o usuário");
    } finally {
      setIsSavingUser(false);
    }
  }

  async function removeUser(user: UserAccount) {
    if (!window.confirm(`Remover o acesso de ${user.nome}?`)) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível remover o usuário");
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : "Não foi possível remover o usuário");
    }
  }

  async function toggleUserRole(user: UserAccount) {
    const nextRole = user.role === "ADMIN" ? "MEMBRO" : "ADMIN";
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: nextRole }) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível atualizar o usuário");
      const updated = mapApiUser(await response.json());
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : "Não foi possível atualizar o usuário");
    }
  }

  function copyField(label: string, value?: string) {
    if (value) void navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedImages(files);
    setFileName(files.length > 1 ? `${files.length} imagens selecionadas` : files[0]?.name ?? "");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">✳</span><span>nítida</span><small>SEO + GEO</small></div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch"><span className="workspace-avatar">D</span><span>Daniel / Conteúdo</span><span className="chevron">⌄</span></div>
        <nav className="nav-list" aria-label="Navegação principal">
          {navItems.map(([label, icon]) => (
            <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => setActiveNav(label)}>
              <span className="nav-icon">{icon}</span>{label}
              {label === "Histórico" && generationsLoaded && generations.length > 0 && <span className="nav-count">{generations.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><span className="nav-icon">?</span>Ajuda e suporte</button>
          <div className="profile-row">
            <span className="profile-avatar">{currentUser ? currentUser.nome.slice(0, 2).toUpperCase() : "··"}</span>
            <span><strong>{currentUser?.nome ?? "Carregando..."}</strong><small>{currentUser?.role === "ADMIN" ? "Administrador" : "Membro"}</small></span>
            <button className="more" onClick={logout} title="Sair">⎋</button>
          </div>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{activeNav}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notificações">♧<span className="notification-dot" /></button><button className="button button-dark" onClick={() => setShowNewSite(true)}><span>＋</span> Novo site</button></div></header>
        {(siteError || scanMessage || isLoadingSites) && <div className="app-notice">{isLoadingSites ? "Sincronizando sites..." : siteError || scanMessage}<button onClick={() => { setSiteError(""); setScanMessage(""); }}>×</button></div>}

        {activeNav === "Visão geral" && <>
          <div className="page-heading"><div><p className="eyebrow">SEGUNDA-FEIRA, 14 DE SETEMBRO</p><h1>Bom dia, {currentUser?.nome.split(" ")[0] ?? ""} <span>✦</span></h1><p className="subtitle">Seu conteúdo está pronto para ficar mais nítido.</p></div><div className="heading-note"><span className="status-dot green" />Tudo sincronizado<br /><small>última verificação há 8 min</small></div></div>
          <div className="metric-grid"><Metric label="Sites ativos" value={String(sites.length)} detail={`${sites.filter((s) => s.status === "concluído").length} perfis completos`} accent="coral" /><Metric label="Conteúdos otimizados" value="28" detail="↑ 18% este mês" accent="blue" /><Metric label="Score médio SEO" value="87" detail="↑ 6 pts este mês" accent="yellow" /><Metric label="Sugestões aplicadas" value="64" detail="de 79 recomendações" accent="mint" /></div>
          <div className="dashboard-grid"><section className="panel sites-panel"><div className="panel-heading"><div><p className="section-kicker">SEUS SITES</p><h2>Perfis editoriais</h2></div><button className="text-button" onClick={() => setActiveNav("Sites e perfis")}>Ver todos <span>→</span></button></div><div className="site-list">{sites.map((site) => <SiteRow key={siteKey(site)} site={site} onClick={() => { setSelectedSite(siteKey(site)); setActiveNav("Gerar conteúdo"); }} />)}</div><button className="add-site-row" onClick={() => setShowNewSite(true)}><span>＋</span> Adicionar novo site</button></section><section className="panel activity-panel"><div className="panel-heading"><div><p className="section-kicker">ATIVIDADE RECENTE</p><h2>O que está acontecendo</h2></div><button className="icon-button small">···</button></div><div className="activity-list"><Activity icon="✦" color="coral" title="Conteúdo otimizado" description="Página de balões metalizados" time="há 12 min" /><Activity icon="↻" color="blue" title="Perfil atualizado" description="Bello Festas foi reescaneado" time="há 2 h" /><Activity icon="✓" color="mint" title="Meta aprovada" description="Coleção Festa Junina" time="ontem" /></div><div className="weekly-score"><div><span className="section-kicker">RITMO DA SEMANA</span><strong>12 conteúdos</strong></div><div className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></section></div>
          <div className="insight-banner"><div className="insight-icon">✦</div><div><strong>Uma oportunidade para hoje</strong><p>Conteúdos com resposta direta no primeiro parágrafo têm <b>2,4× mais chances</b> de serem citados por engines de IA.</p></div><button className="button button-outline" onClick={() => setActiveNav("Gerar conteúdo")}>Criar conteúdo <span>→</span></button></div>
        </>}

        {activeNav === "Gerar conteúdo" && (
          <Generator currentSite={currentSite} sites={sites} onSelectSite={setSelectedSite} sourceText={sourceText} setSourceText={setSourceText} optimize={() => optimize(sourceText, selectedImages)} isOptimizing={isOptimizing} result={generationResult} fileName={fileName} handleFile={handleFile} copied={copied} copyField={copyField} />
        )}
        {activeNav === "Sites e perfis" && <SitesView sites={sites} onNew={() => setShowNewSite(true)} onGenerate={(key) => { setSelectedSite(key); setActiveNav("Gerar conteúdo"); }} onEdit={openEdit} />}
        {activeNav === "Histórico" && <HistoryView generations={generations} isLoading={isLoadingGenerations} copied={copied} copyField={copyField} />}
        {activeNav === "Usuários" && <UsersView users={users} isLoading={isLoadingUsers} currentUserId={currentUser?.id} onNew={() => setShowNewUser(true)} onToggleRole={toggleUserRole} onRemove={removeUser} />}
        {activeNav === "Modelo de IA" && <AiSettingsView isLoading={isLoadingAiSettings} settings={aiSettings} form={aiForm} setForm={setAiForm} onSave={saveAiSettings} isSaving={isSavingAiSettings} />}
      </section>

      {showNewSite && (
        <div className="modal-backdrop" onClick={() => setShowNewSite(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowNewSite(false)}>×</button>
            <p className="eyebrow">NOVO PERFIL EDITORIAL</p>
            <h2>Adicione um site</h2>
            <p className="modal-copy">A IA vai analisar a home e páginas representativas para criar um rascunho de perfil.</p>
            <label>Nome do site<input value={newSiteName} onChange={(event) => setNewSiteName(event.target.value)} placeholder="ex. Karol Festas" /></label>
            <label>URL do site<input value={newSiteUrl} onChange={(event) => setNewSiteUrl(event.target.value)} placeholder="ex. karolfestas.com.br" /></label>
            <div className="modal-actions"><button className="button button-quiet" onClick={() => setShowNewSite(false)}>Cancelar</button><button className="button button-dark" onClick={addSite}>Adicionar e escanear <span>→</span></button></div>
          </div>
        </div>
      )}

      {editingSite && editForm && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeEdit}>×</button>
            <p className="eyebrow">PERFIL EDITORIAL · <span className={`scan-status ${editingSite.status === "concluído" ? "done" : "waiting"}`}><i />{editingSite.status}</span></p>
            <h2>{editingSite.id ? "Editar site" : "Novo site"}</h2>
            <p className="modal-copy">Os campos abaixo vieram do scan automático — revise e ajuste antes de salvar.</p>
            <div className="modal-grid">
              <label>Nome do site<input value={editForm.nome} onChange={(event) => updateEditField("nome", event.target.value)} /></label>
              <label>URL do site<input value={editForm.url} onChange={(event) => updateEditField("url", event.target.value)} /></label>
            </div>
            <label>Nicho<input value={editForm.nicho} onChange={(event) => updateEditField("nicho", event.target.value)} placeholder="ex. artigos para festas infantis" /></label>
            <div className="modal-grid">
              <label>Público-alvo<input value={editForm.publicoAlvo} onChange={(event) => updateEditField("publicoAlvo", event.target.value)} /></label>
              <label>Tom de voz<input value={editForm.tomDeVoz} onChange={(event) => updateEditField("tomDeVoz", event.target.value)} /></label>
            </div>
            <label>Palavras-chave base (separadas por vírgula)<input value={editForm.palavrasChaveBase} onChange={(event) => updateEditField("palavrasChaveBase", event.target.value)} /></label>
            <label>Notas de estilo<textarea value={editForm.notasDeEstilo} onChange={(event) => updateEditField("notasDeEstilo", event.target.value)} placeholder="Tamanho de parágrafo, CTA padrão, formalidade..." /></label>
            <div className="modal-actions modal-actions-split">
              <button className="button button-outline" onClick={rescanEditingSite} disabled={isRescanning || !editingSite.id}>{isRescanning ? "Escaneando..." : "Reescanear site"}</button>
              <div><button className="button button-quiet" onClick={closeEdit}>Cancelar</button><button className="button button-dark" onClick={saveEditedSite} disabled={isSavingSite}>{isSavingSite ? "Salvando..." : "Salvar site"}</button></div>
            </div>
          </div>
        </div>
      )}

      {showNewUser && (
        <div className="modal-backdrop" onClick={() => setShowNewUser(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowNewUser(false)}>×</button>
            <p className="eyebrow">NOVO ACESSO</p>
            <h2>Adicione um usuário</h2>
            <p className="modal-copy">A pessoa vai poder entrar com esse e-mail e senha. Você pode trocar a senha ou remover o acesso depois.</p>
            <label>Nome<input value={newUserForm.nome} onChange={(event) => setNewUserForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome completo" /></label>
            <label>E-mail<input type="email" value={newUserForm.email} onChange={(event) => setNewUserForm((current) => ({ ...current, email: event.target.value }))} placeholder="pessoa@empresa.com.br" /></label>
            <label>Senha<input type="password" value={newUserForm.senha} onChange={(event) => setNewUserForm((current) => ({ ...current, senha: event.target.value }))} placeholder="Mínimo de 6 caracteres" /></label>
            <label>Papel
              <select value={newUserForm.role} onChange={(event) => setNewUserForm((current) => ({ ...current, role: event.target.value === "ADMIN" ? "ADMIN" : "MEMBRO" }))}>
                <option value="MEMBRO">Membro</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <div className="modal-actions"><button className="button button-quiet" onClick={() => setShowNewUser(false)}>Cancelar</button><button className="button button-dark" onClick={addUser} disabled={isSavingUser}>{isSavingUser ? "Criando..." : "Criar acesso"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) { return <div className={`metric-card ${accent}`}><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></div>; }
function SiteRow({ site, onClick }: { site: Site; onClick: () => void }) { return <button className="site-row" onClick={onClick}><span className={`site-logo ${site.color}`}>{site.name.slice(0, 1)}</span><span className="site-info"><strong>{site.name}</strong><small>{site.url}</small></span><span className="site-niche">{site.niche}</span><span className={`scan-status ${site.status === "concluído" ? "done" : "waiting"}`}><i />{site.status}</span><span className="row-arrow">→</span></button>; }
function Activity({ icon, color, title, description, time }: { icon: string; color: string; title: string; description: string; time: string }) { return <div className="activity-row"><span className={`activity-icon ${color}`}>{icon}</span><span><strong>{title}</strong><small>{description}</small></span><time>{time}</time></div>; }

function Generator({ currentSite, sites, onSelectSite, sourceText, setSourceText, optimize, isOptimizing, result, fileName, handleFile, copied, copyField }: { currentSite: Site; sites: Site[]; onSelectSite: (key: string) => void; sourceText: string; setSourceText: (value: string) => void; optimize: () => void; isOptimizing: boolean; result: GenerationResult | null; fileName: string; handleFile: (event: ChangeEvent<HTMLInputElement>) => void; copied: string; copyField: (label: string, value?: string) => void }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) setSwitcherOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [switcherOpen]);

  return (
    <>
      <div className="page-heading generator-heading">
        <div><p className="eyebrow">ESTÚDIO DE CONTEÚDO</p><h1>Deixe seu texto mais nítido <span>✦</span></h1><p className="subtitle">SEO para ser encontrado. GEO para ser citado.</p></div>
        <div className="site-switcher" ref={switcherRef}>
          <button className="selected-site" onClick={() => setSwitcherOpen((open) => !open)}>
            <span className={`site-logo ${currentSite.color}`}>{currentSite.name.slice(0, 1)}</span>
            <span><small>PERFIL ATIVO</small><strong>{currentSite.name}</strong></span>
            <span className={switcherOpen ? "chevron-up" : ""}>⌄</span>
          </button>
          {switcherOpen && (
            <div className="site-switcher-menu">
              {sites.map((site) => (
                <button key={siteKey(site)} className={`site-switcher-item ${siteKey(site) === siteKey(currentSite) ? "active" : ""}`} onClick={() => { onSelectSite(siteKey(site)); setSwitcherOpen(false); }}>
                  <span className={`site-logo ${site.color}`}>{site.name.slice(0, 1)}</span>
                  <span className="site-info"><strong>{site.name}</strong><small>{site.url}</small></span>
                  {siteKey(site) === siteKey(currentSite) && <span className="switcher-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="generator-layout">
        <section className="panel editor-panel">
          <div className="editor-top"><div><p className="section-kicker">TEXTO ORIGINAL</p><h2>O que você quer otimizar?</h2></div><span className="counter">{sourceText.length} / 5.000</span></div>
          <textarea className="content-textarea" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Cole aqui o texto do produto, categoria ou página que você quer melhorar..." />
          <div className="editor-footer"><label className="upload-button"><span>⊙</span>{fileName || "Adicionar imagens"}<input type="file" accept="image/*" multiple onChange={handleFile} /></label><button className="button button-dark optimize-button" onClick={optimize} disabled={isOptimizing || !sourceText.trim()}>{isOptimizing ? "Analisando..." : "Otimizar texto"}<span>{isOptimizing ? "◌" : "✦"}</span></button></div>
          <div className="editor-hint"><span>◎</span> Usando o perfil de <b>{currentSite.name}</b> · {currentSite.tone}</div>
        </section>
        <section className="results-column">
          {result ? (
            <>
              <ResultCard label="TEXTO OTIMIZADO" title="Uma versão pronta para publicar" value={result.texto_otimizado || "A IA não retornou este campo."} copyLabel="texto" copied={copied} onCopy={copyField} large />
              <ResultCard label="META TITLE" title="Título para busca" value={result.meta_title || "A IA não retornou este campo."} copyLabel="meta title" copied={copied} onCopy={copyField} />
              <ResultCard label="META DESCRIPTION" title="Descrição para busca" value={result.meta_description || "A IA não retornou este campo."} copyLabel="meta description" copied={copied} onCopy={copyField} />
              {result.alt_texts.length > 0 && <ResultCard label="ALT TEXTS" title="Texto alternativo das imagens" value={result.alt_texts.join("\n")} copyLabel="alt texts" copied={copied} onCopy={copyField} />}
              <div className="keyword-card">
                <div className="result-heading"><div><p className="section-kicker">SINAIS DE RELEVÂNCIA</p><h3>Palavras-chave</h3></div><span className="ai-badge">IA</span></div>
                <div className="keyword-group"><small>USADAS</small><div>{result.palavras_chave_usadas.length ? result.palavras_chave_usadas.map((keyword) => <span className="keyword used" key={keyword}>{keyword}</span>) : <span className="keyword-empty">Nenhuma retornada</span>}</div></div>
                <div className="keyword-group"><small>SUGERIDAS</small><div>{result.palavras_chave_sugeridas.length ? result.palavras_chave_sugeridas.map((keyword) => <span className="keyword suggested" key={keyword}>{keyword}</span>) : <span className="keyword-empty">Nenhuma retornada</span>}</div></div>
                <p className="disclaimer">Sugestões baseadas em relevância temática, não em volume de busca real.</p>
              </div>
            </>
          ) : (
            <div className="empty-result"><div className="empty-sparkle">✦</div><h2>Seu resultado aparece aqui</h2><p>Cole um texto ao lado e deixe a IA encontrar a forma mais clara e relevante de dizer o que você já sabe.</p></div>
          )}
        </section>
      </div>
    </>
  );
}

function ResultCard({ label, title, value, copyLabel, copied, onCopy, large = false }: { label: string; title: string; value: string; copyLabel: string; copied: string; onCopy: (label: string, value?: string) => void; large?: boolean }) { return <div className={`result-card ${large ? "large" : ""}`}><div className="result-heading"><div><p className="section-kicker">{label}</p><h3>{title}</h3></div><button className="copy-button" onClick={() => onCopy(copyLabel, value)}>{copied === copyLabel ? "Copiado" : "⧉ Copiar"}</button></div><p className="result-value">{value}</p></div>; }

function SitesView({ sites, onNew, onGenerate, onEdit }: { sites: Site[]; onNew: () => void; onGenerate: (key: string) => void; onEdit: (site: Site) => void }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Sites e perfis <span>◎</span></h1><p className="subtitle">A personalidade de cada marca, em um só lugar.</p></div><button className="button button-dark" onClick={onNew}>＋ Novo site</button></div>
      <section className="panel full-panel">
        <div className="panel-heading"><div><p className="section-kicker">PERFIS CADASTRADOS</p><h2>{sites.length} sites no workspace</h2></div><span className="panel-muted">Clique em um site para editar</span></div>
        <div className="site-table">
          {sites.map((site) => (
            <div className="site-table-row" key={siteKey(site)} onClick={() => onEdit(site)} role="button" tabIndex={0}>
              <span className={`site-logo ${site.color}`}>{site.name.slice(0, 1)}</span>
              <span className="site-info"><strong>{site.name}</strong><small>{site.url}</small></span>
              <span className="table-detail"><small>NICHO</small>{site.niche}</span>
              <span className="table-detail"><small>TOM</small>{site.tone}</span>
              <span className={`scan-status ${site.status === "concluído" ? "done" : "waiting"}`}><i />{site.status}</span>
              <button className="text-button" onClick={(event) => { event.stopPropagation(); onGenerate(siteKey(site)); }}>Gerar <span>→</span></button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function HistoryView({ generations, isLoading, copied, copyField }: { generations: Generation[]; isLoading: boolean; copied: string; copyField: (label: string, value?: string) => void }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">ARQUIVO</p><h1>Histórico <span>↺</span></h1><p className="subtitle">Tudo o que já ganhou uma versão mais nítida.</p></div></div>
      <section className="panel full-panel">
        {isLoading ? (
          <div className="history-empty"><div className="empty-sparkle">↺</div><h2>Carregando histórico...</h2></div>
        ) : generations.length === 0 ? (
          <div className="history-empty"><div className="empty-sparkle">↺</div><h2>Seu histórico começa aqui</h2><p>Os conteúdos otimizados aparecerão nesta lista assim que você gerar o primeiro.</p></div>
        ) : (
          <div className="history-list">
            {generations.map((generation) => (
              <div className="history-row" key={generation.id}>
                <div className="history-row-top"><strong>{generation.siteName}</strong><time>{new Date(generation.criadoEm).toLocaleString("pt-BR")}</time></div>
                <p className="history-title">{generation.metaTitle || "Sem meta title"}</p>
                <p className="history-preview">{generation.textoOtimizado.slice(0, 220)}{generation.textoOtimizado.length > 220 ? "…" : ""}</p>
                <button className="copy-button" onClick={() => copyField(`hist-${generation.id}`, generation.textoOtimizado)}>{copied === `hist-${generation.id}` ? "Copiado" : "⧉ Copiar texto"}</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function UsersView({ users, isLoading, currentUserId, onNew, onToggleRole, onRemove }: { users: UserAccount[]; isLoading: boolean; currentUserId?: string; onNew: () => void; onToggleRole: (user: UserAccount) => void; onRemove: (user: UserAccount) => void }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">ACESSO</p><h1>Usuários <span>◈</span></h1><p className="subtitle">Quem pode entrar no workspace.</p></div><button className="button button-dark" onClick={onNew}>＋ Novo usuário</button></div>
      <section className="panel full-panel">
        <div className="panel-heading"><div><p className="section-kicker">CONTAS CADASTRADAS</p><h2>{users.length} usuários com acesso</h2></div></div>
        {isLoading ? (
          <div className="history-empty"><div className="empty-sparkle">◈</div><h2>Carregando usuários...</h2></div>
        ) : (
          <div className="site-table">
            {users.map((user) => (
              <div className="site-table-row user-row" key={user.id}>
                <span className={`site-logo ${user.role === "ADMIN" ? "coral" : "blue"}`}>{user.nome.slice(0, 1).toUpperCase()}</span>
                <span className="site-info"><strong>{user.nome}{user.id === currentUserId && " (você)"}</strong><small>{user.email}</small></span>
                <span className="table-detail"><small>PAPEL</small>{user.role === "ADMIN" ? "Administrador" : "Membro"}</span>
                <span className="table-detail"><small>DESDE</small>{new Date(user.criadoEm).toLocaleDateString("pt-BR")}</span>
                <button className="text-button" onClick={() => onToggleRole(user)}>{user.role === "ADMIN" ? "Tornar membro" : "Tornar admin"}</button>
                <button className="text-button danger" onClick={() => onRemove(user)} disabled={user.id === currentUserId}>Remover</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AiSettingsView({ isLoading, settings, form, setForm, onSave, isSaving }: { isLoading: boolean; settings: AiSettingsState | null; form: { provider: AiProviderName; model: string; apiKey: string }; setForm: (updater: (current: { provider: AiProviderName; model: string; apiKey: string }) => { provider: AiProviderName; model: string; apiKey: string }) => void; onSave: () => void; isSaving: boolean }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Modelo de IA <span>◆</span></h1><p className="subtitle">Escolha o provedor e a chave usados no scan e na geração de conteúdo.</p></div></div>
      <section className="panel full-panel">
        {isLoading ? (
          <div className="history-empty"><div className="empty-sparkle">◆</div><h2>Carregando configuração...</h2></div>
        ) : (
          <div className="ai-settings-form">
            <label>Provedor
              <select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as AiProviderName }))}>
                {(Object.keys(AI_PROVIDER_LABELS) as AiProviderName[]).map((provider) => <option key={provider} value={provider}>{AI_PROVIDER_LABELS[provider]}</option>)}
              </select>
            </label>
            <label>Modelo
              <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder={AI_PROVIDER_HINTS[form.provider]} />
            </label>
            <label>Chave de API
              <input type="password" value={form.apiKey} onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder={settings?.hasApiKey ? `Atual: ${settings.apiKeyMasked} — deixe em branco para manter` : "Cole a chave de API"} />
            </label>
            <button className="button button-dark" onClick={onSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar configuração"}</button>
            <p className="disclaimer">A chave fica salva no banco de dados, visível apenas para administradores (e sempre mascarada na tela).</p>
          </div>
        )}
      </section>
    </>
  );
}
