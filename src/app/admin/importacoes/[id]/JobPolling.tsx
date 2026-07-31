"use client";
import { useEffect } from "react"; import { useRouter } from "next/navigation";
export function JobPolling({active}:{active:boolean}){const router=useRouter();useEffect(()=>{if(!active)return;const timer=setInterval(()=>router.refresh(),5000);return()=>clearInterval(timer);},[active,router]);return active?<p className="mt-3 text-sm font-semibold text-amber-800">Acompanhamento automático ativo.</p>:null;}
