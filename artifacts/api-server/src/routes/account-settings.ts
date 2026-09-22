import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, insertRow, selectRows, deleteRows, supabaseError, updateRows } from "../lib/supabase";
const router = Router();
router.get("/blocked-users", authMiddleware, async (req,res)=>{
 const userId=(req as any).userId as number;
 try { const rows=await selectRows("blocked_users",{filters:[eq("blockerId",userId)]});
  const users=await selectRows("users",{limit:1000}); const map=new Map(users.map(u=>[Number(u.id),u]));
  return res.json({users:rows.map(r=>map.get(Number(r.blockedId))).filter(Boolean).map((u:any)=>({id:u.id,username:u.username,displayName:u.displayName,avatarUrl:u.avatarUrl,countryFlag:u.countryFlag}))});
 } catch(err){return supabaseError(res,err)}
});
router.delete("/blocked-users/:id",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number; const blockedUserId=Number(req.params["id"]);
 if(!Number.isInteger(blockedUserId)) return res.status(400).json({error:"Invalid user id"});
 try{await deleteRows("blocked_users",[eq("blockerId",userId),eq("blockedId",blockedUserId)]);return res.json({success:true})}catch(err){return supabaseError(res,err)}
});
router.post("/blocked-users/:id",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number; const blockedUserId=Number(req.params["id"]);
 if(!Number.isInteger(blockedUserId)||blockedUserId===userId)return res.status(400).json({error:"Invalid user id"});
 try{await insertRow("blocked_users",{blockerId:userId,blockedId:blockedUserId});return res.status(201).json({success:true})}catch(err){return supabaseError(res,err)}
});
router.get("/verification/status",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number;
 try {
  const rows=await selectRows("verification_requests",{filters:[eq("userId",userId)],order:{column:"createdAt",ascending:false},limit:1});
  return res.json({request:rows[0]??null});
 } catch(err){return supabaseError(res,err)}
});
router.post("/verification/request",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number;
 try{
  const [user]=await selectRows("users",{select:"verificationStatus",filters:[eq("id",userId)],limit:1});
  if(user?.verificationStatus==="approved") return res.json({success:true,status:"approved"});
  const existing=await selectRows("verification_requests",{filters:[eq("userId",userId),eq("status","pending")],limit:1});
  if(existing.length)return res.json({success:true,status:"pending"});
  const request=await insertRow("verification_requests",{userId,status:"pending",createdAt:new Date()});
  await updateRows("users",{verificationStatus:"pending",verificationRequestedAt:new Date()},[eq("id",userId)]);
  return res.status(201).json({success:true,status:"pending",request});
 }catch(err){return supabaseError(res,err)}
});

router.post("/verification/admin/:id",authMiddleware,async(req,res)=>{
 const reviewerId=(req as any).userId as number;
 const admins=new Set((process.env["VERIFICATION_ADMIN_USER_IDS"]??"").split(",").map(v=>Number(v.trim())).filter(Number.isInteger));
 if(!admins.has(reviewerId)) return res.status(403).json({error:"Verification admin access required"});
 const requestId=Number(req.params["id"]);
 const status=req.body?.status;
 const reason=typeof req.body?.reason==="string"?req.body.reason.trim():null;
 if(!Number.isInteger(requestId)||!["approved","rejected"].includes(status)) return res.status(400).json({error:"Invalid verification review"});
 try{
  const [request]=await selectRows("verification_requests",{filters:[eq("id",requestId)],limit:1});
  if(!request) return res.status(404).json({error:"Verification request not found"});
  if(request.status!=="pending") return res.status(409).json({error:"Verification request already reviewed"});
  await updateRows("verification_requests",{status,reviewedAt:new Date(),reviewedBy:reviewerId,reason},[eq("id",requestId)]);
  await updateRows("users",{verificationStatus:status,verificationRequestedAt:null},[eq("id",Number(request.userId))]);
  return res.json({success:true,status});
 }catch(err){return supabaseError(res,err)}
});
router.get("/settings/export",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number;
 const direct=[
  ["users","id"],["user_settings","userId"],["posts","userId"],["stories","userId"],["comments","userId"],["follows","followerId"],
  ["follows","followingId"],["notifications","recipientId"],["notifications","actorId"],["message_requests","senderId"],["message_requests","recipientId"],
  ["blocked_users","blockerId"],["blocked_users","blockedId"],["story_views","userId"],["story_reactions","userId"],["story_replies","userId"],
  ["feedback","userId"],["post_engagements","userId"],["collections","userId"],["user_affinity","userId"],["user_affinity","targetUserId"],
  ["user_topic_affinity","userId"],["likes","userId"],["saves","userId"],["shares","userId"],["notification_preferences","userId"],
  ["verification_requests","userId"],["events","userId"],["seen_posts","userId"],["reports","reporterId"],["login_events","userId"],
  ["notification_settings","userId"],["auth_sessions","userId"],["username_history","userId"],["user_rate_limits","userId"]
 ] as const;
 try{
  const data:Record<string,unknown>= {};
  for(const [table,column] of direct){
   try{data[table]=await selectRows(table,{filters:[eq(column,userId)],limit:5000});}catch{data[table]=[]}
  }
  const posts=Array.isArray(data.posts)?data.posts as Record<string,unknown>():[];
  const postIds=posts.map(p=>Number(p.id)).filter(Number.isInteger);
  const postRelated=["post_engagements","post_likes","post_saves","post_edits","post_media","post_stats","post_distribution","post_hashtags","post_mentions","post_processing_jobs"];
  data.postRelated={postIds, tables:Object.fromEntries(postRelated.map(name=>[name,[]]))};
  for(const name of postRelated){
   try{const rows=[]; for(const postId of postIds){rows.push(...await selectRows(name,{filters:[eq("postId",postId)],limit:5000}));} (data.postRelated as any).tables[name]=rows;}catch{}
  }
  const memberships=await selectRows("conversation_members",{filters:[eq("userId",userId)],limit:5000});
  const conversationIds=memberships.map(r=>Number(r.conversationId)).filter(Number.isInteger);
  const conversations=[]; const messages=[]; const archived=[];
  for(const conversationId of conversationIds){
   try{messages.push(...await selectRows("messages",{filters:[eq("conversationId",conversationId)],limit:5000}));}catch{}
   try{archived.push(...await selectRows("archived_conversations",{filters:[eq("conversationId",conversationId)],limit:5000}));}catch{}
   try{conversations.push(...await selectRows("conversations",{filters:[eq("id",conversationId)],limit:1}));}catch{}
  }
  data.conversations={memberships,conversations,messages,archived};
  return res.json({exportedAt:new Date().toISOString(),version:2,data});
 }catch(err){return supabaseError(res,err)}
});

export default router;