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

export default messagesRouter;