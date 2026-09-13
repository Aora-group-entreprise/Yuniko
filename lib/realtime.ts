import { apiFetch } from "@/lib/api";

export type RealtimeEvent<T=unknown>={type:string;data:T};

export function openRealtime(path:string,onEvent:(event:RealtimeEvent)=>void){
  const controller=new AbortController();
  let stopped=false;
  let retryTimer:number|undefined;
  const parse=(chunk:string)=>{
    for(const frame of chunk.split("\n\n")){
      const lines=frame.split("\n");
      let eventType="message";
      const dataLines:string[]=[];
      for(const line of lines){
        if(line.startsWith("event:")) eventType=line.slice(6).trim()||"message";
        else if(line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if(!dataLines.length) continue;
      try{onEvent({type:eventType,data:JSON.parse(dataLines.join("\n"))});}catch{}
    }
  };
  const sleep=(ms:number)=>new Promise<void>(resolve=>{retryTimer=window.setTimeout(resolve,ms);});
  const connect=async()=>{
    while(!stopped){
      try{
        const response=await apiFetch(path,{headers:{Accept:"text/event-stream"},signal:controller.signal});
        if(!response.ok){
          if(response.status===401||response.status===403) break;
          await sleep(1500);
          continue;
        }
        if(!response.body) throw new Error("Realtime stream unavailable");
        const reader=response.body.getReader();
        const decoder=new TextDecoder();
        let buffer="";
        while(!stopped){
          const {value,done}=await reader.read();
          if(done) break;
          buffer+=decoder.decode(value,{stream:true});
          const frames=buffer.split("\n\n");
          buffer=frames.pop()??"";
          for(const frame of frames) parse(frame+"\n\n");
        }
      }catch(error){
        if(stopped||controller.signal.aborted) break;
      }
      if(!stopped) await sleep(1000);
    }
  };
  void connect();
  return()=>{stopped=true;controller.abort();if(retryTimer)window.clearTimeout(retryTimer);};
}

export function subscribeToChat(conversationId:number,onMessage:(data:unknown)=>void){return openRealtime(`/conversations/${conversationId}/stream`,e=>onMessage(e.data))}
export function subscribeToNotifications(onNotification:(data:unknown)=>void){return openRealtime("/notifications/stream",e=>onNotification(e.data))}
export function subscribeToFeed(onPost:(data:unknown)=>void){return openRealtime("/feed/stream",e=>onPost(e.data))}
