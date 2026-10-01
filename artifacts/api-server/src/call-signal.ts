import {DurableObject,DurableObjectState} from "cloudflare:workers";

type CallScope = {scope:"inbox"|"room";userId:number};
type HibernatableWebSocket = WebSocket & {
  serializeAttachment(value:CallScope):void;
  deserializeAttachment():CallScope|null;
};
type DurableObjectStateLike = {
  acceptWebSocket(ws:WebSocket,tags?:string[]):void;
  getWebSockets(tag?:string):HibernatableWebSocket[];
  setWebSocketAutoResponse(pair:WebSocketRequestResponsePairLike):void;
  storage:{
    get<T>(key:string):Promise<T|undefined>;
    put<T>(key:string,value:T):Promise<void>;
    delete(key:string):Promise<boolean>;
    setAlarm(scheduledTime:number):Promise<void>;
    deleteAlarm():Promise<void>;
  };
};
type WebSocketRequestResponsePairLike = {request:string;response:string};
declare const WebSocketRequestResponsePair:new(request:string,response:string)=>WebSocketRequestResponsePairLike;
type WorkerWebSocketPair = {0:WebSocket;1:WebSocket};

declare const WebSocketPair:new()=>WorkerWebSocketPair;

export class CallSignalRoom extends DurableObject {
  protected readonly ctx:DurableObjectStateLike;
  constructor(ctx:DurableObjectStateLike,_env:unknown){
    super(ctx as DurableObjectState,_env);
    this.ctx=ctx;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"));
  }
  async fetch(request:Request){
    if(request.headers.get("Upgrade")!=="websocket")return new Response("Expected WebSocket",{status:426});
    const u=new URL(request.url);
    const scope=u.searchParams.get("scope")==="inbox"?"inbox":"room";
    const userId=Number(u.searchParams.get("userId")||0);
    if(!Number.isInteger(userId)||userId<=0)return new Response("Invalid user",{status:400});
    const [client,server]=Object.values(new WebSocketPair()) as [WebSocket,HibernatableWebSocket];
    this.ctx.acceptWebSocket(server,[scope]);
    server.serializeAttachment({scope,userId});
    if(scope==="room"){
      const status=await this.ctx.storage.get<string>("status");
      if(status==="connected")server.send(JSON.stringify({type:"call-accepted"}));
      else if(status==="rejected")server.send(JSON.stringify({type:"call-rejected"}));
      else if(status==="timeout")server.send(JSON.stringify({type:"call-timeout"}));
      else if(status==="ended")server.send(JSON.stringify({type:"call-ended"}));
    }
    const responseInit={status:101,webSocket:client} as ResponseInit;
    return new Response(null,responseInit);
  }
  async isInboxOnline(){return this.ctx.getWebSockets("inbox").some(ws=>ws.readyState===WebSocket.OPEN);}
  async startCall(){await this.ctx.storage.put("status","ringing");await this.ctx.storage.setAlarm(Date.now()+30000);}
  async acceptCall(){const status=await this.ctx.storage.get<string>("status");if(status!=="ringing")return false;await this.ctx.storage.put("status","connected");await this.ctx.storage.deleteAlarm();await this.emit("call-accepted",{});return true;}
  async rejectCall(){const status=await this.ctx.storage.get<string>("status");if(status!=="ringing")return false;await this.ctx.storage.put("status","rejected");await this.ctx.storage.deleteAlarm();await this.emit("call-rejected",{});return true;}
  async endCall(){const status=await this.ctx.storage.get<string>("status");if(status==="ended"||status==="rejected"||status==="timeout")return false;await this.ctx.storage.put("status","ended");await this.ctx.storage.deleteAlarm();await this.emit("call-ended",{});return true;}
  async alarm(){const status=await this.ctx.storage.get<string>("status");if(status!=="ringing")return;await this.ctx.storage.put("status","timeout");await this.emit("call-timeout",{});}
  async sendInvite(payload:unknown){
    const message=JSON.stringify(payload);
    for(const ws of this.ctx.getWebSockets("inbox"))
      if(ws.readyState===WebSocket.OPEN)ws.send(message);
  }
  async emit(event:string,payload:unknown){
    const message=JSON.stringify({type:event,...(payload&&typeof payload==="object"?payload:{payload})});
    for(const ws of this.ctx.getWebSockets("room"))
      if(ws.readyState===WebSocket.OPEN)ws.send(message);
  }
  async webSocketMessage(ws:HibernatableWebSocket,message:string|ArrayBuffer){
    const state=ws.deserializeAttachment();
    if(!state||state.scope!=="room")return;
    let parsed:unknown;
    try{parsed=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message));}catch{return}
    if(!parsed||typeof parsed!=="object")return;
    const data=parsed as Record<string,unknown>;
    const type=String(data.type||"");
    if(!["offer","answer","ice","hangup"].includes(type))return;
    const outgoing=JSON.stringify({type,fromUserId:state.userId,payload:data.payload??null});
    for(const peer of this.ctx.getWebSockets("room"))
      if(peer!==ws&&peer.readyState===WebSocket.OPEN)peer.send(outgoing);
  }
  webSocketClose(ws:HibernatableWebSocket,code:number,reason:string){
    if(ws.readyState!==WebSocket.CLOSED)ws.close(code,reason);
  }
}
