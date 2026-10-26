"use client";

import { useState } from "react";

type FileKey = "page.tsx" | "layout.tsx" | "globals.css" | "route.ts";
type Log = { id:number; text:string; tone:"muted"|"good"|"warn" };
const files: {name:FileKey; folder:string; language:string; code:string}[] = [
  {name:"page.tsx",folder:"app",language:"tsx",code:"export default function HomePage() {\n  return (\n    <main className=\"min-h-screen bg-[#070910] text-white\">\n      <h1>Build something remarkable.</h1>\n      <StudioCanvas />\n    </main>\n  );\n}"},
  {name:"layout.tsx",folder:"app",language:"tsx",code:"import \"./globals.css\";\n\nexport default function RootLayout({ children }) {\n  return <html lang=\"en\"><body>{children}</body></html>;\n}"},
  {name:"globals.css",folder:"app",language:"css",code:":root {\n  color-scheme: dark;\n  --canvas: #070910;\n  --cyan: #00f2fe;\n  --violet: #6c63ff;\n}\n.hud-panel { border: 1px solid rgb(0 242 254 / 20%); }"},
  {name:"route.ts",folder:"app/api/preview",language:"ts",code:"export async function GET() {\n  return Response.json({ status: \"ready\", preview: true });\n}"},
];

export default function AppBuilderEnginePage() {
  const [file,setFile] = useState<FileKey>("page.tsx");
  const [source,setSource] = useState(files[0].code);
  const [logs,setLogs] = useState<Log[]>([{id:1,text:"OmniCode workspace initialized.",tone:"good"}]);
  const [busy,setBusy] = useState(false);
  const [tab,setTab] = useState("TERMINAL");
  const [status,setStatus] = useState("Preview workspace");
  const selected=files.find(item=>item.name===file)||files[0];

  function choose(item:typeof files[number]) { setFile(item.name);setSource(item.code);setStatus(item.folder+"/"+item.name); }
  function addLog(text:string,tone:Log["tone"]="muted") { setLogs(current=>[...current,{id:Date.now()+Math.random(),text,tone}]); }

  function build() {
    if(busy)return;
    setBusy(true);setTab("TERMINAL");setStatus("Building preview");
    addLog("Starting local preview build simulation…");
    const messages=["Simulated dependency resolution…","Simulated compile pass for "+file+"…","Self-healing stream monitor checked the draft…","Preview build simulation completed."];
    messages.forEach((message,index)=>setTimeout(()=>{addLog(message,index===messages.length-1?"good":"muted");if(index===messages.length-1){setBusy(false);setStatus("Preview ready");}},500+index*550));
  }

  return (
    <main className="flex h-screen min-h-[640px] flex-col gap-3 overflow-hidden bg-[#06070b] p-4 text-slate-100">
      <header className="flex shrink-0 items-center justify-between rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3"><div><p className="text-[10px] uppercase tracking-[.3em] text-cyan-200">OmniCode · App & Web Builder</p><h1 className="text-lg font-semibold">Development workspace</h1></div><div className="flex items-center gap-2"><span className="hidden text-[10px] text-slate-500 sm:block">{status}</span><button onClick={build} disabled={busy} className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100">{busy?"Building…":"▶ Build preview"}</button><button onClick={()=>addLog("Deployment provider is not configured for this workspace.","warn")} className="rounded-lg border border-violet-300/25 px-4 py-2 text-xs text-violet-100">Deploy</button></div></header>
      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[220px_minmax(400px,1fr)_minmax(280px,34%)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0b0e16] shadow-[0_0_24px_rgba(0,242,254,.06)]"><div className="border-b border-white/10 p-4"><p className="text-[10px] uppercase tracking-[.2em] text-cyan-200">Explorer</p><h2 className="mt-1 text-sm font-semibold">Project files</h2></div><div className="min-h-0 flex-1 overflow-y-auto p-2"><p className="px-2 py-2 text-[10px] uppercase tracking-widest text-slate-600">⌄ omniai-app</p>{files.map(item=><button key={item.folder+item.name} onClick={()=>choose(item)} className={"flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs "+(file===item.name?"bg-cyan-300/10 text-cyan-100":"text-slate-400 hover:bg-white/[.04]")}><span className="text-cyan-300">{item.language==="css"?"◈":"◇"}</span><span className="min-w-0 flex-1 truncate">{item.folder}/<b className="font-normal text-slate-200">{item.name}</b></span></button>)}<button onClick={()=>addLog("New file creation is available through the project source tree integration.","warn")} className="mt-2 w-full rounded-lg border border-dashed border-white/10 py-2 text-xs text-slate-600">＋ Add file</button></div><div className="border-t border-white/10 p-3 text-[10px] text-slate-600">Source editor · local draft</div></aside>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-[#0b0e16] shadow-[0_0_24px_rgba(108,99,255,.06)]"><div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="text-[10px] uppercase tracking-[.2em] text-violet-200">Editor · {selected.language}</p><h2 className="mt-1 text-xs text-slate-300">{selected.folder}/{selected.name}</h2></div><span className="text-[10px] text-teal-300">● Modified locally</span></div><div className="flex min-h-0 flex-1 overflow-auto bg-[#080a10] font-mono text-xs leading-6"><pre aria-hidden className="select-none border-r border-white/[.06] px-3 py-4 text-right text-slate-700">{source.split("\n").map((_,i)=>i+1).join("\n")}</pre><textarea aria-label={"Edit "+selected.name} spellCheck={false} value={source} onChange={e=>setSource(e.target.value)} className="min-w-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-6 text-cyan-50 outline-none selection:bg-violet-400/30"/></div><div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-slate-600"><span>UTF-8 · {selected.language.toUpperCase()}</span><span>Ln {source.split("\n").length} · Spaces: 2</span></div></section>
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-teal-300/20 bg-[#090c12] shadow-[0_0_24px_rgba(110,231,183,.05)]"><div className="flex shrink-0 border-b border-white/10 px-3 py-3">{["TERMINAL","BUILD","PREVIEW"].map(item=><button key={item} onClick={()=>setTab(item)} className={"mr-2 rounded px-2 py-1 text-[9px] tracking-widest "+(tab===item?"bg-teal-300/10 text-teal-200":"text-slate-600")}>{item}</button>)}</div>{tab==="TERMINAL"||tab==="BUILD"?<><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-black/30 p-4 font-mono text-[10px]">{logs.map(log=><p key={log.id} className={log.tone==="good"?"text-teal-300":log.tone==="warn"?"text-amber-200":"text-slate-400"}><span className="mr-2 text-slate-700">›</span>{log.text}</p>)}{busy&&<p className="animate-pulse text-cyan-200">▌</p>}</div><div className="border-t border-white/10 px-4 py-2 text-[9px] text-slate-600">Build output · simulated preview pipeline</div></>:<div className="grid min-h-0 flex-1 place-items-center p-6 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[.04] text-2xl text-cyan-200">⌘</div><p className="mt-3 text-sm font-semibold">Preview canvas</p><p className="mt-1 text-xs text-slate-600">Build the draft to refresh this local preview.</p><button onClick={build} className="mt-4 rounded-lg border border-cyan-300/25 px-3 py-2 text-xs text-cyan-100">Refresh preview</button></div></div>}</aside>
      </section>
      <footer className="flex shrink-0 items-center justify-between rounded-lg border border-white/[.07] bg-[#0b0d14] px-4 py-2 text-[10px] text-slate-600"><span>OmniCode · editor draft is held in this browser session</span><span>● Build simulation · no deployment connected</span></footer>
    </main>
  );
}
