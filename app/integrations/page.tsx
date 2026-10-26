"use client";

import { useState } from "react";

type Connector = {id:string;name:string;category:string;mark:string};
const connectors:Connector[]=[
  {id:"github",name:"GitHub",category:"Developer tools",mark:"⌘"},
  {id:"salesforce",name:"Salesforce",category:"CRM",mark:"☁"},
  {id:"hubspot",name:"HubSpot",category:"Marketing CRM",mark:"◉"},
];
const blank={clientId:"",callback:""};

export default function IntegrationsPage() {
  const [selected,setSelected]=useState<Connector|null>(null);
  const [forms,setForms]=useState<Record<string,typeof blank>>({});
  const [verified,setVerified]=useState<Record<string,boolean>>({});
  const [error,setError]=useState("");

  function update(field:"clientId"|"callback",value:string) {
    if(!selected)return;
    setForms(current=>({...current,[selected.id]:{...(current[selected.id]||blank),[field]:value}}));
    setVerified(current=>({...current,[selected.id]:false}));
    setError("");
  }

  function verify() {
    if(!selected)return;
    const values=forms[selected.id]||blank;
    let callback:URL;
    try { callback=new URL(values.callback); } catch { setError("Enter a valid HTTPS callback URL.");return; }
    if(!values.clientId.trim()) { setError("Enter the OAuth client ID.");return; }
    if(callback.protocol!=="https:") { setError("Callback targets must use HTTPS.");return; }
    setVerified(current=>({...current,[selected.id]:true}));
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#07080d] p-5 text-slate-100 md:p-8">
      <header className="mx-auto max-w-6xl"><p className="text-[10px] uppercase tracking-[.32em] text-cyan-200">OmniConnect · Integration catalog</p><h1 className="mt-2 text-2xl font-semibold">Connect your tools</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Configure and validate OAuth connection details. Provider authentication remains pending until a server-side OAuth app is configured.</p></header>
      <section className="mx-auto mt-6 grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]">
        <div className="grid content-start gap-3 sm:grid-cols-2">{connectors.map(connector=><button key={connector.id} onClick={()=>{setSelected(connector);setError("");}} className={"group rounded-2xl border p-4 text-left transition duration-200 "+(selected?.id===connector.id?"border-cyan-200/50 bg-cyan-300/[.07] shadow-[0_0_28px_rgba(0,242,254,.13)]":"border-white/10 bg-[#0c1018] hover:border-violet-300/50 hover:shadow-[0_0_30px_rgba(108,99,255,.15)]")}><div className="flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/15 to-violet-400/20 text-xl text-cyan-100">{connector.mark}</span><span className={"rounded-full border px-2 py-1 text-[9px] "+(verified[connector.id]?"border-teal-300/25 text-teal-200":"border-amber-300/20 text-amber-200")}>{verified[connector.id]?"Setup verified":"Preview · not connected"}</span></div><h2 className="mt-5 text-sm font-semibold">{connector.name}</h2><p className="mt-1 text-xs text-slate-500">{connector.category}</p><p className="mt-4 text-[10px] text-cyan-200/70">Configure OAuth details →</p></button>)}</div>
        <aside className="min-h-[410px] rounded-2xl border border-cyan-300/20 bg-[#0c1018] p-5 shadow-[0_0_24px_rgba(0,242,254,.06)]">{selected?<><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.22em] text-cyan-200">Authentication gate</p><h2 className="mt-2 text-lg font-semibold">{selected.name}</h2></div><button onClick={()=>setSelected(null)} aria-label="Close connector setup" className="text-slate-500 hover:text-white">×</button></div>
            <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-3 text-[11px] leading-5 text-amber-100/80">Preview — not connected. OAuth credentials are checked locally and are not transmitted or stored by this catalog.</div>
            <label className="mt-5 block text-[10px] uppercase tracking-widest text-slate-500">OAuth client ID<input autoComplete="off" value={(forms[selected.id]||blank).clientId} onChange={e=>update("clientId",e.target.value)} placeholder="Client ID from provider console" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm normal-case text-white outline-none focus:border-cyan-300/40"/></label>
            <label className="mt-4 block text-[10px] uppercase tracking-widest text-slate-500">Callback / webhook target<input autoComplete="url" value={(forms[selected.id]||blank).callback} onChange={e=>update("callback",e.target.value)} placeholder="https://your-domain.example/oauth/callback" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm normal-case text-white outline-none focus:border-violet-300/40"/></label>
            {error&&<p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
            <button onClick={verify} className="mt-5 w-full rounded-xl border border-cyan-300/30 bg-cyan-300/[.08] py-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/[.14]">Validate connection setup</button>
            {verified[selected.id]&&<div className="mt-4 rounded-xl border border-teal-300/20 bg-teal-300/[.04] p-3"><p className="text-xs font-semibold text-teal-200">Configuration verified · OAuth pending</p><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span className="text-slate-500">Client ID</span><span className="text-teal-100">Provided</span><span className="text-slate-500">Callback target</span><span className="truncate text-teal-100">{(forms[selected.id]||blank).callback}</span><span className="text-slate-500">Provider session</span><span className="text-amber-200">Not connected</span></div><p className="mt-3 border-t border-white/[.07] pt-3 text-[10px] leading-4 text-slate-500">Live connection metrics appear after a server-side OAuth flow is configured. This check does not sign in or connect an account.</p></div>}
          </>:<div className="grid h-full min-h-[350px] place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-violet-300/20 text-xl text-violet-200">↗</div><p className="mt-4 text-sm font-medium">Choose an integration</p><p className="mt-1 text-xs text-slate-600">Select a card to configure its authentication details.</p></div></div>}</aside>
      </section>
    </main>
  );
}
