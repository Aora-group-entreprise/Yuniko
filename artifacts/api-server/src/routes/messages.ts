import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { deleteRows, eq, insertRow, selectRows, updateRows, supabaseError } from "../lib/supabase";

const messagesRouter = Router();
type AuthenticatedRequest = Request & { userId?: number };
type UserRow = Record<string, unknown>;

async function getUser(id:number){
  const [user]=await selectRows<UserRow>("users",{filters:[eq("id",id)],limit:1});
  return user??null;
}

async function areFriends(a:number,b:number){
  const [follows,blocked]=await Promise.all([
    selectRows("follows",{limit:5000}),
    selectRows("blocked_users",{limit:5000}),
  ]);
  const blockedBetween=blocked.some(r=>
    (Number(r.blockerId)===a&&Number(r.blockedId)===b) ||
    (Number(r.blockerId)===b&&Number(r.blockedId)===a)
  );
  if(blockedBetween) return false;
  return follows.some(r=>Number(r.followerId)===a&&Number(r.followingId)===b)&&
    follows.some(r=>Number(r.followerId)===b&&Number(r.followingId)===a);
}

async function conversationForUser(conversationId:number,userId:number){
  const [member]=await selectRows("conversation_members",{
    filters:[eq("conversationId",conversationId),eq("userId",userId)],
    limit:1,
  });
  return member??null;
}

async function findConversation(a:number,b:number){
  const members=await selectRows("conversation_members",{limit:5000});
  const byConversation=new Map<number,Set<number>>();
  for(const member of members){
    const conversationId=Number(member.conversationId), userId=Number(member.userId);
    if(!Number.isInteger(conversationId)||!Number.isInteger(userId)) continue;
    const users=byConversation.get(conversationId)??new Set<number>();
    users.add(userId); byConversation.set(conversationId,users);
  }
  for(const [id,users] of byConversation){
    if(users.size===2&&users.has(a)&&users.has(b)) return id;
  }
  return null;
}

export async function ensureFriendConversation(a:number,b:number){
  const existing=await findConversation(a,b);
  if(existing) return existing;
  const conversation=await insertRow("conversations",{createdAt:new Date(),updatedAt:new Date()});
  const conversationId=Number(conversation.id);
  if(!conversationId) throw new Error("Conversation creation failed");
  await insertRow("conversation_members",{conversationId,userId:a,lastReadAt:new Date(),muted:false});
  await insertRow("conversation_members",{conversationId,userId:b,lastReadAt:new Date(),muted:false});
  return conversationId;
}

function dateValue(value:unknown){return value instanceof Date?value.toISOString():value?String(value):null;}

messagesRouter.get("/messages/conversations",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId);
  try{
    const [follows,archivedRows,blockedRows]=await Promise.all([
      selectRows("follows",{limit:5000}),
      selectRows("archived_conversations",{filters:[eq("userId",currentId)],limit:5000}),
      selectRows("blocked_users",{limit:5000}),
    ]);
    const archivedIds=new Set(archivedRows.map(r=>Number(r.conversationId)));
    const blockedIds=new Set<number>();
    for(const row of blockedRows){
      const blocker=Number(row.blockerId),blocked=Number(row.blockedId);
      if(blocker===currentId) blockedIds.add(blocked);
      if(blocked===currentId) blockedIds.add(blocker);
    }
    const following=new Set(follows.filter(r=>Number(r.followerId)===currentId).map(r=>Number(r.followingId)));
    const friendIds=follows
      .filter(r=>Number(r.followingId)===currentId&&following.has(Number(r.followerId)))
      .map(r=>Number(r.followerId))
      .filter(id=>!blockedIds.has(id));
    if(!friendIds.length) return res.json({conversations:[]});

    const [memberships,conversations,messages,users]=await Promise.all([
      selectRows("conversation_members",{limit:5000}),
      selectRows("conversations",{order:{column:"updatedAt",ascending:false},limit:1000}),
      selectRows("messages",{order:{column:"createdAt",ascending:false},limit:5000}),
      selectRows<UserRow>("users",{limit:1000}),
    ]);
    const userById=new Map(users.map(u=>[Number(u.id),u]));
    const membersByConversation=new Map<number,typeof memberships>();
    for(const member of memberships){
      const id=Number(member.conversationId);
      const list=membersByConversation.get(id)??[];
      list.push(member); membersByConversation.set(id,list);
    }

    const result=[];
    for(const friendId of friendIds){
      let conversation=conversations.find(item=>{
        const ids=new Set((membersByConversation.get(Number(item.id))??[]).map(m=>Number(m.userId)));
        return ids.size===2&&ids.has(currentId)&&ids.has(friendId);
      });
      if(!conversation){
        const conversationId=await ensureFriendConversation(currentId,friendId);
        conversation={id:conversationId,createdAt:new Date(),updatedAt:new Date()};
      }
      const conversationId=Number(conversation.id);
      if(archivedIds.has(conversationId)) continue;
      const members=membersByConversation.get(conversationId)??[];
      const currentMember=members.find(m=>Number(m.userId)===currentId);
      const friend=userById.get(friendId);
      const latest=messages.find(m=>Number(m.conversationId)===conversationId);
      const lastReadAt=currentMember?.lastReadAt?new Date(String(currentMember.lastReadAt)).getTime():0;
      const unread=messages.filter(m=>Number(m.conversationId)===conversationId&&Number(m.senderId)===friendId&&new Date(String(m.createdAt)).getTime()>lastReadAt).length;
      if(friend) result.push({
        id:conversationId,
        user:{id:friendId,username:friend.username,displayName:friend.displayName,avatarUrl:friend.avatarUrl??null,verified:String(friend.verificationStatus??"")==="verified"},
        lastMessage:latest?.kind==="image"?"Photo":String(latest?.body??""),
        lastMessageTime:dateValue(latest?.createdAt??conversation.updatedAt),
        unread,
      });
    }
    result.sort((a,b)=>new Date(String(b.lastMessageTime??0)).getTime()-new Date(String(a.lastMessageTime??0)).getTime());
    return res.json({conversations:result});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.get("/messages/archived",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId);
  try{
    const [archived,memberships,conversations,users,messages]=await Promise.all([
      selectRows("archived_conversations",{filters:[eq("userId",currentId)],order:{column:"archivedAt",ascending:false},limit:1000}),
      selectRows("conversation_members",{filters:[eq("userId",currentId)],limit:1000}),
      selectRows("conversations",{limit:1000}),
      selectRows<UserRow>("users",{limit:1000}),
      selectRows("messages",{order:{column:"createdAt",ascending:false},limit:5000}),
    ]);
    const userById=new Map(users.map(u=>[Number(u.id),u]));
    const conversationById=new Map(conversations.map(c=>[Number(c.id),c]));
    const result=[];
    for(const row of archived){
      const conversationId=Number(row.conversationId);
      const membership=memberships.find(m=>Number(m.conversationId)===conversationId);
      if(!membership) continue;
      const members=await selectRows("conversation_members",{filters:[eq("conversationId",conversationId)],limit:10});
      const otherId=members.map(m=>Number(m.userId)).find(id=>id!==currentId);
      const friend=otherId?userById.get(otherId):null;
      if(!friend) continue;
      const latest=messages.find(m=>Number(m.conversationId)===conversationId);
      result.push({
        id:conversationId,
        user:{id:otherId,username:friend.username,displayName:friend.displayName,avatarUrl:friend.avatarUrl??null,verified:String(friend.verificationStatus??"")==="verified"},
        lastMessage:latest?.kind==="image"?"Photo":String(latest?.body??""),
        lastMessageTime:dateValue(latest?.createdAt??conversationById.get(conversationId)?.updatedAt),
        archivedAt:dateValue(row.archivedAt),
      });
    }
    return res.json({conversations:result});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/messages/conversations/:id/archive",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const conversationId=Number(req.params["id"]),userId=Number(req.userId);
  if(!Number.isInteger(conversationId)||conversationId<=0) return res.status(400).json({error:"Invalid conversation id"});
  try{
    if(!(await conversationForUser(conversationId,userId))) return res.status(404).json({error:"Conversation not found"});
    const existing=await selectRows("archived_conversations",{filters:[eq("conversationId",conversationId),eq("userId",userId)],limit:1});
    if(!existing.length) await insertRow("archived_conversations",{conversationId,userId,archivedAt:new Date()});
    return res.json({archived:true});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.delete("/messages/conversations/:id/archive",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const conversationId=Number(req.params["id"]),userId=Number(req.userId);
  if(!Number.isInteger(conversationId)||conversationId<=0) return res.status(400).json({error:"Invalid conversation id"});
  try{
    await deleteRows("archived_conversations",[eq("conversationId",conversationId),eq("userId",userId)]);
    return res.json({archived:false});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.delete("/messages/conversations/:id",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const conversationId=Number(req.params["id"]),userId=Number(req.userId);
  if(!Number.isInteger(conversationId)||conversationId<=0) return res.status(400).json({error:"Invalid conversation id"});
  try{
    if(!(await conversationForUser(conversationId,userId))) return res.status(404).json({error:"Conversation not found"});
    await deleteRows("archived_conversations",[eq("conversationId",conversationId),eq("userId",userId)]);
    await deleteRows("conversation_members",[eq("conversationId",conversationId),eq("userId",userId)]);
    const remaining=await selectRows("conversation_members",{filters:[eq("conversationId",conversationId)],limit:2});
    if(!remaining.length){
      await deleteRows("messages",[eq("conversationId",conversationId)]);
      await deleteRows("conversations",[eq("id",conversationId)]);
    }
    return res.json({deleted:true});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.get("/messages/conversations/:userId",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId),friendId=Number(req.params["userId"]);
  if(!Number.isInteger(friendId)||friendId<=0) return res.status(400).json({error:"Invalid user id"});
  if(!(await areFriends(currentId,friendId))) return res.status(403).json({error:"You can only chat with friends"});
  try{
    const conversationId=await ensureFriendConversation(currentId,friendId);
    const [friend,messages]=await Promise.all([
      getUser(friendId),
      selectRows("messages",{filters:[eq("conversationId",conversationId)],order:{column:"createdAt",ascending:true},limit:500}),
    ]);
    if(!friend) return res.status(404).json({error:"User not found"});
    await updateRows("conversation_members",{lastReadAt:new Date()},[eq("conversationId",conversationId),eq("userId",currentId)]);
    return res.json({
      conversationId,
      user:{id:friendId,username:friend.username,displayName:friend.displayName,avatarUrl:friend.avatarUrl??null,verified:String(friend.verificationStatus??"")==="verified"},
      messages:messages.map(m=>({id:Number(m.id),senderId:Number(m.senderId),text:m.kind==="text"?String(m.body??""):undefined,imageUrl:m.kind==="image"?String(m.mediaUrl??""):undefined,timestamp:dateValue(m.createdAt),read:Boolean(m.readAt),reactions:[],type:m.kind==="image"?"image":"text"})),
    });
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/messages/conversations/:userId",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId),friendId=Number(req.params["userId"]);
  const text=typeof req.body?.text==="string"?req.body.text.trim():"";
  if(!Number.isInteger(friendId)||friendId<=0) return res.status(400).json({error:"Invalid user id"});
  if(!text||text.length>4000) return res.status(400).json({error:"Message must be between 1 and 4000 characters"});
  if(!(await areFriends(currentId,friendId))) return res.status(403).json({error:"You can only message friends"});
  try{
    const conversationId=await ensureFriendConversation(currentId,friendId),now=new Date();
    const message=await insertRow("messages",{conversationId,senderId:currentId,kind:"text",body:text,mediaUrl:null,durationMs:null,deliveredAt:now,readAt:null,createdAt:now});
    await updateRows("conversations",{updatedAt:now},[eq("id",conversationId)]);
    return res.status(201).json({message:{id:Number(message.id),senderId:currentId,text,timestamp:dateValue(message.createdAt),read:false,reactions:[],type:"text"}});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.get("/message-requests",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId);
  try{
    const [requests,users,blockedRows]=await Promise.all([
      selectRows("message_requests",{filters:[eq("recipientId",currentId),eq("status","pending")],order:{column:"createdAt",ascending:false},limit:100}),
      selectRows<UserRow>("users",{limit:1000}),selectRows("blocked_users",{limit:5000}),
    ]);
    const blockedIds=new Set<number>();
    for(const row of blockedRows){const blocker=Number(row.blockerId),blocked=Number(row.blockedId);if(blocker===currentId)blockedIds.add(blocked);if(blocked===currentId)blockedIds.add(blocker);}
    const userById=new Map(users.map(user=>[Number(user.id),user]));
    const result=requests.flatMap(request=>{const senderId=Number(request.senderId),sender=userById.get(senderId);if(!sender||blockedIds.has(senderId))return [];return [{id:Number(request.id),user:{id:senderId,username:String(sender.username??""),displayName:String(sender.displayName??sender.username??""),avatarUrl:sender.avatarUrl??null,verified:String(sender.verificationStatus??"")==="verified"},message:String(request.message??""),timestamp:dateValue(request.createdAt)}];});
    return res.json({requests:result});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/message-requests/:userId",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId),targetId=Number(req.params["userId"]);
  const message=typeof req.body?.message==="string"?req.body.message.trim():"";
  if(!Number.isInteger(targetId)||targetId<=0||targetId===currentId)return res.status(400).json({error:"Invalid user id"});
  if(!message||message.length>4000)return res.status(400).json({error:"Message must be between 1 and 4000 characters"});
  try{
    const [target,existing,blocked]=await Promise.all([getUser(targetId),selectRows("message_requests",{filters:[eq("senderId",currentId),eq("recipientId",targetId),eq("status","pending")],limit:1}),selectRows("blocked_users",{limit:5000})]);
    if(!target)return res.status(404).json({error:"User not found"});
    const blockedBetween=blocked.some(row=>(Number(row.blockerId)===currentId&&Number(row.blockedId)===targetId)||(Number(row.blockerId)===targetId&&Number(row.blockedId)===currentId));
    if(blockedBetween)return res.status(403).json({error:"Cannot send message request"});
    if(await areFriends(currentId,targetId))return res.status(409).json({error:"You are already friends"});
    if(existing.length)return res.status(409).json({error:"Message request already exists"});
    const request=await insertRow("message_requests",{senderId:currentId,recipientId:targetId,message,status:"pending",createdAt:new Date(),updatedAt:new Date()});
    return res.status(201).json({request:{id:Number(request.id),status:"pending"}});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/message-requests/:id/accept",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const requestId=Number(req.params["id"]),currentId=Number(req.userId);
  if(!Number.isInteger(requestId)||requestId<=0)return res.status(400).json({error:"Invalid request id"});
  try{
    const [request]=await selectRows("message_requests",{filters:[eq("id",requestId),eq("recipientId",currentId),eq("status","pending")],limit:1});
    if(!request)return res.status(404).json({error:"Message request not found"});
    const senderId=Number(request.senderId);
    const [existingFollow]=await selectRows("follows",{filters:[eq("followerId",currentId),eq("followingId",senderId)],limit:1});
    if(existingFollow)await updateRows("follows",{status:"accepted",isFriend:true},[eq("followerId",currentId),eq("followingId",senderId)]);else await insertRow("follows",{followerId:currentId,followingId:senderId,isFriend:true,status:"accepted"});
    const [reverseFollow]=await selectRows("follows",{filters:[eq("followerId",senderId),eq("followingId",currentId)],limit:1});
    if(reverseFollow)await updateRows("follows",{status:"accepted",isFriend:true},[eq("followerId",senderId),eq("followingId",currentId)]);else await insertRow("follows",{followerId:senderId,followingId:currentId,isFriend:true,status:"accepted"});
    await updateRows("message_requests",{status:"accepted",updatedAt:new Date()},[eq("id",requestId),eq("recipientId",currentId)]);
    const conversationId=await ensureFriendConversation(currentId,senderId);
    return res.json({accepted:true,conversationId,userId:senderId});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.delete("/message-requests/:id",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const requestId=Number(req.params["id"]),currentId=Number(req.userId);
  if(!Number.isInteger(requestId)||requestId<=0)return res.status(400).json({error:"Invalid request id"});
  try{
    const [request]=await selectRows("message_requests",{filters:[eq("id",requestId),eq("recipientId",currentId),eq("status","pending")],limit:1});
    if(!request)return res.status(404).json({error:"Message request not found"});
    await updateRows("message_requests",{status:"declined",updatedAt:new Date()},[eq("id",requestId),eq("recipientId",currentId)]);
    return res.json({declined:true});
  }catch(err){return supabaseError(res,err);}
});


messagesRouter.get("/calls/history",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId);
  try{
    const [outgoing,incoming,users]=await Promise.all([
      selectRows("calls",{filters:[eq("callerId",currentId)],order:{column:"createdAt",ascending:false},limit:500}),
      selectRows("calls",{filters:[eq("targetUserId",currentId)],order:{column:"createdAt",ascending:false},limit:500}),
      selectRows<UserRow>("users",{limit:1000}),
    ]);
    const userById=new Map(users.map(user=>[Number(user.id),user]));
    type CallHistoryRow = Record<string, unknown> & {
      callDirection: "incoming" | "outgoing";
      otherUserId: number;
    };
    const rows: CallHistoryRow[]=[
      ...outgoing.map(call=>({...call,callDirection:"outgoing" as const,otherUserId:Number(call.targetUserId)})),
      ...incoming.map(call=>({...call,callDirection:"incoming" as const,otherUserId:Number(call.callerId)})),
    ];
    rows.sort((a,b)=>new Date(String(b.createdAt??b.startedAt??0)).getTime()-new Date(String(a.createdAt??a.startedAt??0)).getTime());
    const result=rows.flatMap(call=>{
      const user=userById.get(call.otherUserId);
      if(!user)return [];
      const started=call.startedAt?new Date(String(call.startedAt)).getTime():0;
      const ended=call.endedAt?new Date(String(call.endedAt)).getTime():0;
      const duration=started&&ended&&ended>=started?Math.floor((ended-started)/1000):0;
      const status=String(call.status??"");
      const missed=call.callDirection==="incoming"&&!["answered","completed","connected"].includes(status);
      return [{
        id:String(call.id),
        user:{
          id:call.otherUserId,
          username:String(user.username??""),
          displayName:String(user.displayName??user.username??""),
          avatarUrl:user.avatarUrl??null,
          verified:String(user.verificationStatus??"")==="verified",
        },
        type:call.callDirection,
        callType:String(call.kind??"").toLowerCase()==="video"?"video":"voice",
        status,
        missed,
        duration,
        timestamp:dateValue(call.createdAt??call.startedAt),
      }];
    });
    return res.json({calls:result});
  }catch(err){return supabaseError(res,err);}
});


messagesRouter.post("/messages/conversations/:userId/media",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId),friendId=Number(req.params["userId"]);
  const dataUrl=typeof req.body?.dataUrl==="string"?req.body.dataUrl:"";
  const kind=req.body?.kind==="audio"?"audio":"image";
  const durationMs=Number(req.body?.durationMs);
  if(!Number.isInteger(friendId)||friendId<=0) return res.status(400).json({error:"Invalid user id"});
  if(!(await areFriends(currentId,friendId))) return res.status(403).json({error:"You can only message friends"});
  const match=dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if(!match) return res.status(400).json({error:"Invalid media data"});
  const contentType=String(match[1]).toLowerCase();
  const allowed=kind==="image"
    ? ["image/jpeg","image/png","image/webp","image/gif"].includes(contentType)
    : ["audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav"].includes(contentType);
  if(!allowed) return res.status(400).json({error:"Unsupported media type"});
  const binary=atob(match[2]);
  const maxBytes=kind==="image"?8*1024*1024:10*1024*1024;
  if(binary.length>maxBytes) return res.status(413).json({error:"Media is too large"});
  try{
    const supabaseUrl=String(process.env["SUPABASE_URL"]??"").replace(/\/+$/,"");
    const serviceKey=process.env["SUPABASE_SERVICE_ROLE_KEY"]??"";
    if(!supabaseUrl||!serviceKey) throw new Error("Supabase storage is not configured");
    const bucket="yuniko-chat-media";
    const createBucket=await fetch(`${supabaseUrl}/storage/v1/bucket`,{
      method:"POST",
      headers:{Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"Content-Type":"application/json"},
      body:JSON.stringify({id:bucket,name:bucket,public:true}),
    });
    if(!createBucket.ok&&createBucket.status!==409) throw new Error(`Chat media bucket creation failed: ${createBucket.status}`);
    const extension=contentType==="image/jpeg"?"jpg":contentType==="image/png"?"png":contentType==="image/webp"?"webp":contentType==="image/gif"?"gif":contentType==="audio/ogg"?"ogg":contentType==="audio/mp4"?"m4a":contentType==="audio/mpeg"?"mp3":contentType==="audio/wav"?"wav":"webm";
    const objectPath=`${currentId}/${crypto.randomUUID()}.${extension}`;
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    const upload=await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,{
      method:"POST",
      headers:{Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"Content-Type":contentType,"x-upsert":"false","Cache-Control":"31536000"},
      body:bytes,
    });
    if(!upload.ok) throw new Error(`Chat media upload failed: ${upload.status}`);
    const mediaUrl=`${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
    const conversationId=await ensureFriendConversation(currentId,friendId),now=new Date();
    const message=await insertRow("messages",{
      conversationId,senderId:currentId,kind,body:null,mediaUrl,
      durationMs:Number.isFinite(durationMs)&&durationMs>0?Math.floor(durationMs):null,
      deliveredAt:now,readAt:null,createdAt:now,
    });
    await updateRows("conversations",{updatedAt:now},[eq("id",conversationId)]);
    return res.status(201).json({message:{
      id:Number(message.id),senderId:currentId,
      text:undefined,imageUrl:kind==="image"?mediaUrl:undefined,audioUrl:kind==="audio"?mediaUrl:undefined,
      durationMs:Number.isFinite(durationMs)&&durationMs>0?Math.floor(durationMs):null,
      timestamp:dateValue(message.createdAt),read:false,reactions:[],type:kind,
    }});
  }catch(err){return supabaseError(res,err);}
});

export default messagesRouter;