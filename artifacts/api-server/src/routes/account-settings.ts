import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { eq, insertRow, selectRows, deleteRows, supabaseError } from "../lib/supabase";
const router = Router();
router.get("/blocked-users", authMiddleware, async (req,res)=>{
 const userId=(req as any).userId as number;
 try { const rows=await selectRows("blocked_users",{filters:[eq("blockerId",userId)]});
  const users=await selectRows("users",{limit:1000}); const map=new Map(users.map(u=>[Number(u.id),u]));
  return res.json({users:rows.map(r=>map.get(Number(r.blockedUserId))).filter(Boolean).map((u:any)=>({id:u.id,username:u.username,displayName:u.displayName,avatarUrl:u.avatarUrl,countryFlag:u.countryFlag}))});
 } catch(err){return supabaseError(res,err)}
});
router.delete("/blocked-users/:id",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number; const blockedUserId=Number(req.params["id"]);
 if(!Number.isInteger(blockedUserId)) return res.status(400).json({error:"Invalid user id"});
 try{await deleteRows("blocked_users",[eq("userId",userId),eq("blockedId",blockedUserId)]);return res.json({success:true})}catch(err){return supabaseError(res,err)}
});
router.post("/blocked-users/:id",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number; const blockedUserId=Number(req.params["id"]);
 if(!Number.isInteger(blockedUserId)||blockedUserId===userId)return res.status(400).json({error:"Invalid user id"});
 try{await insertRow("blocked_users",{blockerId:userId,blockedId:blockedUserId});return res.status(201).json({success:true})}catch(err){return supabaseError(res,err)}
});
router.post("/verification/request",authMiddleware,async(req,res)=>{
 const userId=(req as any).userId as number;
 try{const existing=await selectRows("verification_requests",{filters:[eq("userId",userId),eq("status","pending")],limit:1});if(existing.length)return res.json({success:true,status:"pending"});await insertRow("verification_requests",{userId,status:"pending"});return res.status(201).json({success:true,status:"pending"})}catch(err){return supabaseError(res,err)}
});
export default router;