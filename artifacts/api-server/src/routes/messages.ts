import { Router, type Request } from "express";
import { env as cloudflareEnv } from "cloudflare:workers";
import { authMiddleware } from "../middlewares/auth";
import { deleteRows, eq, insertRow, selectRows, updateRows, supabaseError } from "../lib/supabase";

const messagesRouter = Router();
const runtimeEnv = cloudflareEnv as unknown as Record<string, string | undefined>;
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
        lastMessage:latest?.kind==="image"?"Photo":latest?.kind==="audio"?"Voice message":String(latest?.body??""),
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
        lastMessage:latest?.kind==="image"?"Photo":latest?.kind==="audio"?"Voice message":String(latest?.body??""),
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
  const afterId=Number(req.query.after??0);
  if(!Number.isInteger(friendId)||friendId<=0) return res.status(400).json({error:"Invalid user id"});
  if(!(await areFriends(currentId,friendId))) return res.status(403).json({error:"You can only chat with friends"});
  try{
    const conversationId=await ensureFriendConversation(currentId,friendId);
    const [friend,messages,deletions,members]=await Promise.all([
      getUser(friendId),
      selectRows("messages",{filters:[eq("conversationId",conversationId)],order:{column:"createdAt",ascending:true},limit:500}),
      selectRows("message_deletions",{filters:[eq("userId",currentId)],limit:5000}),
      selectRows("conversation_members",{filters:[eq("conversationId",conversationId)],limit:10}),
    ]);
    if(!friend) return res.status(404).json({error:"User not found"});
    const deletedForMe=new Set(deletions.map(d=>Number(d.messageId)));
    const visible=messages.filter(m=>!deletedForMe.has(Number(m.id))&&(afterId<=0||Number(m.id)>afterId));
    const undelivered=messages.filter(m=>Number(m.senderId)===friendId&&m.deliveredAt==null&&!deletedForMe.has(Number(m.id)));
    const now=new Date();
    for(const m of undelivered) await updateRows("messages",{deliveredAt:now},[eq("id",Number(m.id))]);
    await updateRows("conversation_members",{lastReadAt:now,lastActiveAt:now,typingAt:null},[eq("conversationId",conversationId),eq("userId",currentId)]);
    const otherMember=members.find(m=>Number(m.userId)===friendId);
    const reactionRows=visible.length?await selectRows("message_reactions",{limit:5000}):[];
    const reactionsByMessage=new Map<number,{reaction:string,count:number,reacted:boolean}[]>();
    for(const row of reactionRows){
      const id=Number(row.messageId);
      if(!visible.some(m=>Number(m.id)===id)) continue;
      const list=reactionsByMessage.get(id)??[];
      const reaction=String(row.reaction);
      const existing=list.find(item=>item.reaction===reaction);
      if(existing){existing.count+=1;existing.reacted=existing.reacted||Number(row.userId)===currentId;}
      else list.push({reaction,count:1,reacted:Number(row.userId)===currentId});
      reactionsByMessage.set(id,list);
    }
    const payload=visible.map(m=>({
      id:Number(m.id),senderId:Number(m.senderId),
      text:m.deletedAt?"This message was deleted":m.kind==="text"?String(m.body??""):undefined,
      imageUrl=m.deletedAt?undefined:m.kind==="image"?String(m.mediaUrl??""):undefined,
      audioUrl=m.deletedAt?undefined:m.kind==="audio"?String(m.mediaUrl??""):undefined,
      durationMs:m.kind==="audio"&&m.durationMs!=null?Number(m.durationMs):null,
      timestamp:dateValue(m.createdAt),read:Boolean(m.readAt),delivered:Boolean(m.deliveredAt),edited:Boolean(m.editedAt),deleted:Boolean(m.deletedAt),
      replyToMessageId:m.replyToMessageId?Number(m.replyToMessageId):null,
      forwardedFromMessageId:m.forwardedFromMessageId?Number(m.forwardedFromMessageId):null,
      reactions:reactionsByMessage.get(Number(m.id))??[],
      type:m.deletedAt?"text":m.kind==="image"?"image":m.kind==="audio"?"audio":"text",
    }));
    return res.json({
      conversationId,
      user:{id:friendId,username:friend.username,displayName:friend.displayName,avatarUrl:friend.avatarUrl??null,verified:String(friend.verificationStatus??"")==="verified"},
      messages:payload,
      otherTyping:Boolean(otherMember?.typingAt&&Date.now()-new Date(String(otherMember.typingAt)).getTime()<5000),
      otherActiveAt:dateValue(otherMember?.lastActiveAt),
    });
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/messages/conversations/:userId",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId),friendId=Number(req.params["userId"]);
  const text=typeof req.body?.text==="string"?req.body.text.trim():"";
  const replyToMessageId=Number(req.body?.replyToMessageId??0);
  if(!Number.isInteger(friendId)||friendId<=0) return res.status(400).json({error:"Invalid user id"});
  if(!text||text.length>4000) return res.status(400).json({error:"Message must be between 1 and 4000 characters"});
  if(!(await areFriends(currentId,friendId))) return res.status(403).json({error:"You can only message friends"});
  try{
    const conversationId=await ensureFriendConversation(currentId,friendId),now=new Date();
    let replyTo=null;
    if(replyToMessageId>0){
      const [parent]=await selectRows("messages",{filters:[eq("id",replyToMessageId),eq("conversationId",conversationId)],limit:1});
      if(!parent) return res.status(400).json({error:"Reply target not found"});
      replyTo=Number(parent.id);
    }
    const message=await insertRow("messages",{conversationId,senderId:currentId,kind:"text",body:text,mediaUrl:null,durationMs:null,deliveredAt:null,readAt:null,replyToMessageId:replyTo,forwardedFromMessageId:null,editedAt:null,deletedAt:null,createdAt:now});
    await updateRows("conversations",{updatedAt:now},[eq("id",conversationId)]);
    await updateRows("conversation_members",{lastActiveAt:now,typingAt:null},[eq("conversationId",conversationId),eq("userId",currentId)]);
    return res.status(201).json({message:{id:Number(message.id),senderId:currentId,text,timestamp:dateValue(message.createdAt),read:false,delivered:false,edited:false,deleted:false,replyToMessageId:replyTo,forwardedFromMessageId:null,reactions:[],type:"text"}});
  }catch(err){return supabaseError(res,err);}
});


// Message actions: reactions, edit, delete-for-me/delete-for-everyone, forward and typing/presence.
messagesRouter.post("/messages/:id/reaction",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const messageId=Number(req.params["id"]),currentId=Number(req.userId),reaction=typeof req.body?.reaction==="string"?req.body.reaction.trim():"";
  if(!Number.isInteger(messageId)||messageId<=0) return res.status(400).json({error:"Invalid message id"});
  if(reaction.length>32) return res.status(400).json({error:"Invalid reaction"});
  try{
    const [message]=await selectRows("messages",{filters:[eq("id",messageId)],limit:1});
    if(!message) return res.status(404).json({error:"Message not found"});
    if(!(await conversationForUser(Number(message.conversationId),currentId))) return res.status(403).json({error:"Not a conversation member"});
    const filters=[eq("messageId",messageId),eq("userId",currentId)];
    if(!reaction){await deleteRows("message_reactions",filters);return res.json({reaction:null});}
    const [existing]=await selectRows("message_reactions",{filters,limit:1});
    if(existing) await updateRows("message_reactions",{reaction,createdAt:new Date()},filters);
    else await insertRow("message_reactions",{messageId,userId:currentId,reaction,createdAt:new Date()});
    return res.json({reaction});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.patch("/messages/:id",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const messageId=Number(req.params["id"]),currentId=Number(req.userId),text=typeof req.body?.text==="string"?req.body.text.trim():"";
  if(!Number.isInteger(messageId)||messageId<=0) return res.status(400).json({error:"Invalid message id"});
  if(!text||text.length>4000) return res.status(400).json({error:"Message must be between 1 and 4000 characters"});
  try{
    const [message]=await selectRows("messages",{filters:[eq("id",messageId),eq("senderId",currentId)],limit:1});
    if(!message) return res.status(404).json({error:"Message not found"});
    if(String(message.kind)!=="text"||message.deletedAt) return res.status(400).json({error:"Only active text messages can be edited"});
    const editedAt=new Date();
    await updateRows("messages",{body:text,editedAt},[eq("id",messageId),eq("senderId",currentId)]);
    return res.json({message:{id:messageId,text,edited:true,editedAt:editedAt.toISOString()}});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.delete("/messages/:id",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const messageId=Number(req.params["id"]),currentId=Number(req.userId),forEveryone=String(req.query.forEveryone??"false")==="true";
  if(!Number.isInteger(messageId)||messageId<=0) return res.status(400).json({error:"Invalid message id"});
  try{
    const [message]=await selectRows("messages",{filters:[eq("id",messageId)],limit:1});
    if(!message) return res.status(404).json({error:"Message not found"});
    if(!(await conversationForUser(Number(message.conversationId),currentId))) return res.status(403).json({error:"Not a conversation member"});
    if(forEveryone){
      if(Number(message.senderId)!==currentId) return res.status(403).json({error:"Only the sender can delete for everyone"});
      await updateRows("messages",{body:"",mediaUrl:null,deletedAt:new Date(),editedAt:null},[eq("id",messageId),eq("senderId",currentId)]);
    }else{
      await insertRow("message_deletions",{messageId,userId:currentId,deletedAt:new Date()});
    }
    return res.json({deleted:true,forEveryone});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/messages/:id/forward",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const messageId=Number(req.params["id"]),currentId=Number(req.userId),targetUserId=Number(req.body?.targetUserId);
  if(!Number.isInteger(messageId)||messageId<=0||!Number.isInteger(targetUserId)||targetUserId<=0||targetUserId===currentId) return res.status(400).json({error:"Invalid forward request"});
  if(!(await areFriends(currentId,targetUserId))) return res.status(403).json({error:"You can only forward to friends"});
  try{
    const [source]=await selectRows("messages",{filters:[eq("id",messageId)],limit:1});
    if(!source) return res.status(404).json({error:"Message not found"});
    if(!(await conversationForUser(Number(source.conversationId),currentId))) return res.status(403).json({error:"Not a conversation member"});
    if(source.deletedAt) return res.status(400).json({error:"Deleted messages cannot be forwarded"});
    const conversationId=await ensureFriendConversation(currentId,targetUserId),now=new Date();
    const copy=await insertRow("messages",{conversationId,senderId:currentId,kind:source.kind,body:source.body??"",mediaUrl:source.mediaUrl??null,durationMs:source.durationMs??null,deliveredAt:null,readAt:null,replyToMessageId:null,forwardedFromMessageId:Number(source.id),editedAt:null,deletedAt:null,createdAt:now});
    await updateRows("conversations",{updatedAt:now},[eq("id",conversationId)]);
    return res.status(201).json({message:{id:Number(copy.id),senderId:currentId,text:copy.kind==="text"?String(copy.body??""):undefined,imageUrl:copy.kind==="image"?String(copy.mediaUrl??""):undefined,audioUrl:copy.kind==="audio"?String(copy.mediaUrl??""):undefined,durationMs:copy.durationMs?Number(copy.durationMs):null,timestamp:dateValue(copy.createdAt),read:false,delivered:false,edited:false,deleted:false,replyToMessageId:null,forwardedFromMessageId:Number(source.id),reactions:[],type:copy.kind==="image"?"image":copy.kind==="audio"?"audio":"text"}});
  }catch(err){return supabaseError(res,err);}
});

messagesRouter.post("/messages/conversations/:userId/typing",authMiddleware,async(req:AuthenticatedRequest,res)=>{
  const currentId=Number(req.userId),friendId=Number(req.params["userId"]),typing=Boolean(req.body?.typing);
  if(!Number.isInteger(friendId)||friendId<=0) return res.status(400).json({error:"Invalid user id"});
  if(!(await areFriends(currentId,friendId))) return res.status(403).json({error:"You can only chat with friends"});
  try{
    const conversationId=await ensureFriendConversation(currentId,friendId),now=new Date();
    await updateRows("conversation_members",{lastActiveAt:now,typingAt:typing?now:null},[eq("conversationId",conversationId),eq("userId",currentId)]);
    return res.json({typing});
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
    const supabaseUrl=String(runtimeEnv["SUPABASE_URL"]??process.env["SUPABASE_URL"]??"").replace(/\/+$/,"");
    const serviceKey=runtimeEnv["SUPABASE_SERVICE_ROLE_KEY"]??process.env["SUPABASE_SERVICE_ROLE_KEY"]??"";
    if(!supabaseUrl||!serviceKey) throw new Error("Supabase storage is not configured");
    const bucket="yuniko-chat-media";
    const extension=contentType==="image/jpeg"?"jpg":contentType==="image/png"?"png":contentType==="image/webp"?"webp":contentType==="image/gif"?"gif":contentType==="audio/ogg"?"ogg":contentType==="audio/mp4"?"m4a":contentType==="audio/mpeg"?"mp3":contentType==="audio/wav"?"wav":"webm";
    const objectPath=`${currentId}/${crypto.randomUUID()}.${extension}`;
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    const storageHeaders={Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"Content-Type":contentType,"x-upsert":"false","Cache-Control":"31536000"};
    let upload=await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,{
      method:"POST",headers:storageHeaders,body:bytes,
    });
    if(upload.status===404){
      const createBucket=await fetch(`${supabaseUrl}/storage/v1/bucket`,{
        method:"POST",
        headers:{Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"Content-Type":"application/json"},
        body:JSON.stringify({id:bucket,name:bucket,public:true}),
      });
      if(!createBucket.ok&&createBucket.status!==409) throw new Error(`Chat media bucket creation failed: ${createBucket.status}`);
      upload=await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,{
        method:"POST",headers:storageHeaders,body:bytes,
      });
    }
    if(!upload.ok) throw new Error(`Chat media upload failed: ${upload.status}`);
    const mediaUrl=`${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
    const conversationId=await ensureFriendConversation(currentId,friendId),now=new Date();
    const message=await insertRow("messages",{
      conversationId,senderId:currentId,kind,body:null,mediaUrl,
      durationMs:Number.isFinite(durationMs)&&durationMs>0?Math.floor(durationMs):null,
      deliveredAt:null,readAt:null,replyToMessageId:null,forwardedFromMessageId:null,editedAt:null,deletedAt:null,createdAt:now,
    });
    await updateRows("conversations",{updatedAt:now},[eq("id",conversationId)]);
    await updateRows("conversation_members",{lastActiveAt:now,typingAt:null},[eq("conversationId",conversationId),eq("userId",currentId)]);
    return res.status(201).json({message:{
      id:Number(message.id),senderId:currentId,
      text:undefined,imageUrl:kind==="image"?mediaUrl:undefined,audioUrl:kind==="audio"?mediaUrl:undefined,
      durationMs:Number.isFinite(durationMs)&&durationMs>0?Math.floor(durationMs):null,
      timestamp:dateValue(message.createdAt),read:false,reactions:[],type:kind,
    }});
  }catch(err){return supabaseError(res,err);}
});

export default messagesRouter;