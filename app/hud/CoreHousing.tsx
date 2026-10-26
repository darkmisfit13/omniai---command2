"use client";

/**
 * CoreHousing — High-Tech Containment Frame
 * ==========================================
 * The dark carbon-fiber housing unit from the reference image.
 * Wraps CoreEntity with:
 *  - Carbon-fiber textured outer frame (CSS diagonal weave)
 *  - Deep rectangular recessed viewport with chamfered beveled bezels
 *  - Polished dark-metal inner surfaces (reflect the orb's glow)
 *  - Top status bar with readouts ("5L4R", parameter text)
 *  - Left/right side UI panels with status lights and text blocks
 *  - Bottom status bar with legalese-like text
 *  - Corner bolts/rivets
 *  - The orb's cyan/magenta glow reflects on inner walls
 */

import { useEffect, useRef, useState } from "react";
import CoreEntity, { type CoreState } from "./CoreEntity";

export interface CoreHousingProps {
  state?: CoreState;
  quality?: 0.5|1|1.5;
  onActivated?: ()=>void;
  /** compact mode for the chat sidebar (smaller size) */
  compact?: boolean;
}

/* Tiny animated readout that changes value over time */
function LiveReadout({label,value,unit=""}: {label:string,value:string,unit?:string}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:1}}>
      <span style={{fontSize:7,letterSpacing:"0.15em",color:"#2a7a8a",textTransform:"uppercase"}}>{label}</span>
      <span style={{fontSize:9,color:"#00e5ff",fontFamily:"monospace",letterSpacing:"0.1em"}}>{value}{unit}</span>
    </div>
  );
}

function StatusDot({color="green",blink=false}:{color?:string,blink?:boolean}){
  return(
    <span style={{
      display:"inline-block",width:5,height:5,borderRadius:"50%",
      background:color,boxShadow:`0 0 5px ${color}`,
      opacity:blink?undefined:1,
      animation:blink?"core-blink 1.2s ease-in-out infinite":undefined,
    }}/>
  );
}

export default function CoreHousing({state="idle",quality=1,onActivated,compact=false}:CoreHousingProps){
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Animate the live readouts
  useEffect(()=>{
    const id=setInterval(()=>{tickRef.current++;setTick(t=>t+1);},800);
    return()=>clearInterval(id);
  },[]);

  // Generate fake-but-plausible readout values
  const t=tickRef.current;
  const freq  = (180+Math.sin(t*0.4)*12).toFixed(1);
  const amp   = (87+Math.sin(t*0.7)*8).toFixed(1);
  const temp  = (3412+Math.floor(Math.sin(t*0.3)*80)).toString();
  const flux  = (0.882+Math.sin(t*0.5)*0.04).toFixed(3);
  const seq   = ["5L4R","4R2L","6L1R","3L5R"][t%4];
  const cycleN= (1024+t*3).toString();

  const isActive = state==="thinking"||state==="responding"||state==="activated";
  const glowColor = state==="error" ? "#ff3030" : "#00e5ff";
  const glowMag   = "#cc00ff";

  return(
    <div
      className="core-housing"
      data-state={state}
      data-compact={compact?"1":undefined}
      style={{
        position:"relative",
        display:"flex",
        flexDirection:"column",
        width:"100%",
        height:"100%",
        // Carbon fiber outer texture (CSS)
        background:"repeating-linear-gradient(45deg,#0a0a0f 0px,#0a0a0f 2px,#0d0d14 2px,#0d0d14 4px)",
        borderRadius:compact?8:12,
        border:"1px solid #1a1a2e",
        boxShadow:`0 0 40px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.04)`,
        fontFamily:"monospace",
        userSelect:"none",
      }}
    >

      {/* ── TOP STATUS BAR ── */}
      <div style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:compact?"2px 8px":"4px 12px",
        background:"linear-gradient(180deg,#080810,#050508)",
        borderBottom:"1px solid #0e1a2a",
        borderRadius:`${compact?7:11}px ${compact?7:11}px 0 0`,
        gap:8,flexShrink:0,
      }}>
        {/* Left side */}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <StatusDot color="#00e5ff" blink={isActive}/>
          <StatusDot color="#cc00ff" blink={false}/>
          <span style={{fontSize:7,color:"#1a4a5a",letterSpacing:"0.2em"}}>OMNIAI·CORE</span>
        </div>
        {/* Centre sequence readout */}
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:9,color:glowColor,letterSpacing:"0.25em",textShadow:`0 0 8px ${glowColor}`}}>{seq}</span>
          {!compact&&<span style={{fontSize:7,color:"#1a4a5a",letterSpacing:"0.1em"}}>SEQ·{cycleN}</span>}
        </div>
        {/* Right readouts */}
        {!compact&&(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <LiveReadout label="FREQ" value={freq} unit="THz"/>
            <LiveReadout label="AMP"  value={amp}  unit="%"/>
            <span style={{fontSize:6,color:"#0a3040",letterSpacing:"0.12em",maxWidth:100,textAlign:"right",lineHeight:1.4}}>
              {"SYSTEM DIAGNOSTICS\nPARAMETER READ"}
            </span>
          </div>
        )}
      </div>

      {/* ── MAIN BODY: side panels + viewport ── */}
      <div style={{display:"flex",flex:1,minHeight:0,overflow:"hidden"}}>

        {/* LEFT PANEL */}
        {!compact&&(
          <div style={{
            width:32,flexShrink:0,
            background:"linear-gradient(90deg,#050508,#080812)",
            borderRight:"1px solid #0e1a2a",
            display:"flex",flexDirection:"column",justifyContent:"space-between",
            padding:"8px 4px",
          }}>
            {/* Status lights column */}
            <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
              <StatusDot color="#00e5ff" blink={isActive}/>
              <StatusDot color="#004455"/>
              <StatusDot color={isActive?"#cc00ff":"#220033"} blink={isActive}/>
              <StatusDot color="#004455"/>
              <StatusDot color="#004455"/>
            </div>
            {/* Small text readout rotated */}
            <div style={{transform:"rotate(-90deg)",transformOrigin:"center",whiteSpace:"nowrap"}}>
              <span style={{fontSize:6,color:"#0a3040",letterSpacing:"0.15em"}}>FLUX·{flux}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
              <div style={{width:22,height:16,background:"#050508",border:"1px solid #0a2030",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:5,color:"#0a4050",letterSpacing:"0.1em"}}>SYS</span>
              </div>
              <div style={{width:22,height:8,background:"linear-gradient(90deg,#00e5ff22,#cc00ff22)",borderRadius:1}}/>
            </div>
          </div>
        )}

        {/* ── RECESSED VIEWPORT ── */}
        <div style={{flex:1,position:"relative",display:"flex",minWidth:0}}>

          {/* Outer bezel shadow — creates depth illusion */}
          <div style={{
            position:"absolute",inset:0,zIndex:2,pointerEvents:"none",
            boxShadow:`inset 0 0 30px rgba(0,0,0,0.95), inset 0 0 8px rgba(0,0,0,0.9)`,
            borderRadius:2,
          }}/>

          {/* Chamfered inner bezel (4 trapezoid-like dark panels) */}
          {/* Top bevel */}
          <div style={{position:"absolute",top:0,left:0,right:0,height:compact?6:12,zIndex:3,pointerEvents:"none",
            background:"linear-gradient(180deg,#03030a,transparent)",
            borderBottom:"1px solid #0a1520",
          }}/>
          {/* Bottom bevel */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:compact?6:12,zIndex:3,pointerEvents:"none",
            background:"linear-gradient(0deg,#03030a,transparent)",
            borderTop:"1px solid #0a1520",
          }}/>
          {/* Left bevel */}
          <div style={{position:"absolute",top:0,bottom:0,left:0,width:compact?6:12,zIndex:3,pointerEvents:"none",
            background:"linear-gradient(90deg,#03030a,transparent)",
            borderRight:"1px solid #0a1520",
          }}/>
          {/* Right bevel */}
          <div style={{position:"absolute",top:0,bottom:0,right:0,width:compact?6:12,zIndex:3,pointerEvents:"none",
            background:"linear-gradient(270deg,#03030a,transparent)",
            borderLeft:"1px solid #0a1520",
          }}/>

          {/* The dark interior chamber — where the orb lives */}
          {/* This is the "mirror floor" / polished interior */}
          <div style={{
            position:"absolute",inset:0,
            background:"radial-gradient(ellipse at 50% 60%, #08051a 0%, #040309 60%, #020206 100%)",
            // Subtle reflective shimmer on walls
            boxShadow:`inset 0 -60px 60px -20px ${glowColor}18, inset 0 0 80px ${glowMag}10`,
          }}/>

          {/* Glow reflection on floor */}
          <div style={{
            position:"absolute",bottom:0,left:"15%",right:"15%",height:"30%",zIndex:1,pointerEvents:"none",
            background:`radial-gradient(ellipse at 50% 100%, ${glowColor}25 0%, ${glowMag}15 40%, transparent 70%)`,
            filter:"blur(8px)",
            transition:"opacity 600ms ease",
            opacity:0.5+Math.sin(Date.now()/1500)*0.2,
          }}/>

          {/* The WebGL canvas */}
          <div style={{position:"absolute",inset:compact?6:12,zIndex:2}}>
            <CoreEntity
              state={state}
              quality={quality}
              onActivated={onActivated}
              className="core-entity-canvas"
            />
          </div>

          {/* Inner HUD text overlay (matches reference left/bottom text) */}
          {!compact&&(
            <div style={{position:"absolute",bottom:compact?4:18,left:compact?4:18,zIndex:4,pointerEvents:"none",
              display:"flex",flexDirection:"column",gap:3,
            }}>
              <span style={{fontSize:6,color:`${glowColor}aa`,letterSpacing:"0.15em"}}>PARAMETER READ</span>
              <span style={{fontSize:5,color:"#0a3040",letterSpacing:"0.1em",lineHeight:1.6}}>
                {"SYSTEM DIAGNOSTICS\n"}
                {`CORE TEMP ${temp}K\n`}
                {"CONTAINMENT OK"}
              </span>
            </div>
          )}
          {!compact&&(
            <div style={{position:"absolute",bottom:18,right:18,zIndex:4,pointerEvents:"none",
              display:"flex",flexDirection:"column",gap:2,alignItems:"flex-end",
            }}>
              <span style={{fontSize:5,color:"#0a3040",letterSpacing:"0.08em",textAlign:"right",lineHeight:1.8}}>
                {`FLUX ${flux}\n`}
                {`CYCLE ${cycleN}\n`}
                {"DRK 5T3.8"}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        {!compact&&(
          <div style={{
            width:32,flexShrink:0,
            background:"linear-gradient(270deg,#050508,#080812)",
            borderLeft:"1px solid #0e1a2a",
            display:"flex",flexDirection:"column",justifyContent:"space-between",
            padding:"8px 4px",
            alignItems:"center",
          }}>
            <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
              <StatusDot color="#004455"/>
              <StatusDot color="#00e5ff" blink={isActive}/>
              <StatusDot color="#004455"/>
              <StatusDot color={isActive?"#cc00ff":"#220033"}/>
              <StatusDot color="#004455"/>
            </div>
            <div style={{transform:"rotate(90deg)",transformOrigin:"center",whiteSpace:"nowrap"}}>
              <span style={{fontSize:6,color:"#0a3040",letterSpacing:"0.15em"}}>TEMP·{temp}K</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
              <div style={{width:22,height:8,background:"linear-gradient(90deg,#cc00ff22,#00e5ff22)",borderRadius:1}}/>
              <div style={{width:22,height:16,background:"#050508",border:"1px solid #0a2030",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:5,color:"#0a4050",letterSpacing:"0.1em"}}>AUX</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:compact?"2px 8px":"4px 12px",
        background:"linear-gradient(0deg,#080810,#050508)",
        borderTop:"1px solid #0e1a2a",
        borderRadius:`0 0 ${compact?7:11}px ${compact?7:11}px`,
        flexShrink:0,gap:8,
      }}>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <div style={{width:14,height:6,background:`${glowColor}33`,border:`1px solid ${glowColor}44`,borderRadius:1}}/>
          <div style={{width:14,height:6,background:`${glowMag}22`,border:`1px solid ${glowMag}33`,borderRadius:1}}/>
        </div>
        {!compact&&(
          <span style={{fontSize:5,color:"#0a3040",letterSpacing:"0.1em",textAlign:"center",lineHeight:1.7}}>
            {"PRO C.7 COPYRIGHT OMNI·AI\n"}
            {"SYSTEM DIAGNOSTICS ACTIVE"}
          </span>
        )}
        <span style={{fontSize:7,color:isActive?glowColor:"#0a3040",letterSpacing:"0.2em",
          textShadow:isActive?`0 0 8px ${glowColor}`:undefined,
          transition:"color 600ms ease, text-shadow 600ms ease",
        }}>
          {isActive?"ACTIVE":"STANDBY"}
        </span>
      </div>

      {/* Corner bolts */}
      {[{t:4,l:4},{t:4,r:4},{b:4,l:4},{b:4,r:4}].map((pos,i)=>(
        <div key={i} style={{
          position:"absolute",width:8,height:8,
          top:  "t" in pos?pos.t:undefined,
          bottom:"b" in pos?pos.b:undefined,
          left: "l" in pos?pos.l:undefined,
          right: "r" in pos?pos.r:undefined,
          borderRadius:"50%",
          background:"radial-gradient(circle at 35% 35%,#2a2a3a,#0a0a0f)",
          border:"1px solid #1a1a2a",
          boxShadow:"inset 0 1px 0 rgba(255,255,255,0.05)",
          pointerEvents:"none",
          zIndex:10,
        }}/>
      ))}

      <style>{`
        @keyframes core-blink {
          0%,100%{opacity:1;} 50%{opacity:0.3;}
        }
      `}</style>
    </div>
  );
}
