import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { deleteRows, eq, gt, selectRows, sortRows, supabaseError, insertRow, updateRows } from "../lib/supabase";
import { canInteract } from "../lib/privacy";
import { ensureFriendConversation } from "./messages";
import { createNotification } from "../lib/notifications";
import { publishRealtimeToUser } from "../lib/realtime";

const storiesRouter = Router();
async function cleanupExpiredStories(){const rows=await selectRows("stories",{filters:[gt("expiresAt",new Date(0))],limit:5000});for(const story of rows){if(new Date(String(story.expiresAt)).getTime()>Date.now())continue;const id=Number(story.id);for(const table of ["story_views","story_reactions","story_replies"]){try{await deleteRows(table,[eq("storyId",id)])}catch{}}try{await deleteRows("stories",[eq("id",id)])}catch{}}}

async function withAuthors(stories: Record<string, unknown>[]) {
  const users = await selectRows("users", { limit: 1000 });
  const byId = new Map(users.map((user) => [Number(user.id), user]));
  return stories.map((story) => {
    const author = byId.get(Number(story.userId));
    return {
      ...story,
      authorDisplayName: author?.displayName ?? null,
      authorUsername: author?.username ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
    };
  });
}

storiesRouter.post("/stories", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const { mediaUrl, caption } = req.body as { mediaUrl?: string; caption?: string };
  if (!mediaUrl) return res.status(400).json({ error: "Photo required for story" });
  try {
    const story = await insertRow("stories", {
      userId: req.userId!,
      mediaUrl,
      caption: caption?.trim() ?? "",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    return res.status(201).json({ story });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.get("/stories", authMiddleware, async (req: Request & { userId?: number }, res) => {
  try {
    await cleanupExpiredStories();
    const rows = await selectRows("stories", {
      filters: [gt("expiresAt", new Date())],
      order: { column: "createdAt", ascending: false },
      limit: 30,
    });
    const settings = await selectRows("user_settings", { limit: 1000 });
    const follows = await selectRows("follows", { filters: [eq("followerId", req.userId!)], limit: 5000 });
    const settingsById = new Map(settings.map(r => [Number(r.userId), r]));
    const followingIds = new Set(follows.map(r => Number(r.followingId)));
    const viewerSettings = settingsById.get(Number(req.userId!));
    let visible = rows.filter(story => {
      const owner = Number(story.userId);
      const setting = settingsById.get(owner);
      const privateAccount = Boolean(setting?.privateAccount);
      const permission = String(setting?.storyPermissions ?? setting?.storyPermission ?? "friendsOnly") as any;
      const accountVisible = !privateAccount || owner === req.userId || followingIds.has(owner);
      return accountVisible && (owner === req.userId || permission === "everyone" || (permission === "friendsOnly" && followingIds.has(owner)));
    });
    if (viewerSettings?.deleteWatchedStories === true && visible.length) {
      const views = await selectRows("story_views", { filters: [eq("userId", req.userId!)], limit: 5000 });
      const viewedIds = new Set(views.map(view => Number(view.storyId)));
      visible = visible.filter(story => Number(story.userId) === req.userId || !viewedIds.has(Number(story.id)));
    }
    return res.json({ stories: await withAuthors(visible) });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.post("/stories/:id/view", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid story id" });

  try {
    await cleanupExpiredStories();
    const [story] = await selectRows("stories", { filters: [eq("id", id)], limit: 1 });
    if (!story) return res.status(404).json({ error: "Story not found" });

    const viewerId = req.userId!;
    if (Number(story.userId) !== viewerId) {
      const [settings] = await selectRows("user_settings", {
        filters: [eq("userId", viewerId)],
        limit: 1,
      });
      const existing=await selectRows("story_views",{filters:[eq("storyId",id),eq("userId",viewerId)],limit:1});
      if(!existing.length){
        await insertRow("story_views", {storyId:id,userId:viewerId,viewedAt:new Date()});
        try{await publishRealtimeToUser(Number(story.userId),{type:"story:view",storyId:id,viewerId});}catch(error){console.error("[YUNIKO REALTIME] story view dispatch failed",error);}
      }

      if (settings?.deleteWatchedStories === true) {
        // Remove it only from this viewer's feed. Never delete the author's story
        // globally just because one viewer enabled auto-delete.
        return res.json({ viewed: true, deleted: false, hiddenForViewer: true });
      }
    }

    return res.json({ viewed: true, deleted: false });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.get("/stories/:id", authMiddleware, async (req: Request & { userId?: number }, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid story id" });
  try {
    const [story] = await selectRows("stories", { filters: [eq("id", id)], limit: 1 });
    const expiresAt = story?.expiresAt instanceof Date ? story.expiresAt : new Date(String(story?.expiresAt));
    if (!story || expiresAt.getTime() <= Date.now()) {
      return res.status(404).json({ error: "Story not found or expired" });
    }
    const [settings] = await selectRows("user_settings", { filters: [eq("userId", Number(story.userId))], limit: 1 });
    if (Number(story.userId) !== req.userId) {
      const follows = await selectRows("follows", { filters: [eq("followerId", req.userId!), eq("followingId", Number(story.userId))], limit: 1 });
      const privateAccount = Boolean(settings?.privateAccount);
      const permission = String(settings?.storyPermissions ?? settings?.storyPermission ?? "friendsOnly") as any;
      if ((privateAccount && !follows.length) || !(await canInteract(permission, req.userId!, Number(story.userId)))) {
        return res.status(403).json({ error: "Story is private" });
      }
    }
    return res.json({ story: (await withAuthors([story]))[0] });
  } catch (err) {
    return supabaseError(res, err);
  }
});

storiesRouter.get("/stories/:id/views",authMiddleware,async(req:Request & {userId?:number},res)=>{const id=Number(req.params["id"]);try{const[story]=await selectRows("stories",{filters:[eq("id",id)],limit:1});if(!story||Number(story.userId)!==Number(req.userId))return res.status(403).json({error:"Only owner"});const[views,reactions,users]=await Promise.all([selectRows("story_views",{filters:[eq("storyId",id)],limit:5000}),selectRows("story_reactions",{filters:[eq("storyId",id)],limit:5000}),selectRows("users",{limit:1000})]);const byId=new Map(users.map(u=>[Number(u.id),u])),rb=new Map(reactions.map(x=>[Number(x.userId),String(x.reaction??"")]));const viewers=views.map(v=>{const u=byId.get(Number(v.userId));if(!u)return null;return{userId:Number(v.userId),displayName:String(u.displayName??u.username??"User"),username:String(u.username??""),avatarUrl:u.avatarUrl??null,reaction:rb.get(Number(v.userId))||null}}).filter(Boolean);return res.json({viewCount:viewers.length,viewers})}catch(err){return supabaseError(res,err)}});
storiesRouter.post("/stories/:id/reaction",authMiddleware,async(req:Request & {userId?:number},res)=>{const id=Number(req.params["id"]),userId=Number(req.userId),reaction=typeof req.body?.reaction==="string"?req.body.reaction.trim():"";if(!reaction||reaction.length>16)return res.status(400).json({error:"Invalid reaction"});try{const[story]=await selectRows("stories",{filters:[eq("id",id)],limit:1});if(!story||Number(story.userId)===userId)return res.status(400).json({error:"Invalid story reaction"});const filters=[eq("storyId",id),eq("userId",userId)],existing=await selectRows("story_reactions",{filters,limit:1});if(existing.length)await updateRows("story_reactions",{reaction,createdAt:new Date()},filters);else await insertRow("story_reactions",{storyId:id,userId,reaction,createdAt:new Date()});await createNotification(Number(story.userId),userId,"story_reaction","Quelqu'un a réagi à votre story.",{storyId:id,url:"/notifications"});return res.json({reaction})}catch(err){return supabaseError(res,err)}});
storiesRouter.post("/stories/:id/reply",authMiddleware,async(req:Request & {userId?:number},res)=>{const id=Number(req.params["id"]),senderId=Number(req.userId),text=typeof req.body?.text==="string"?req.body.text.trim():"";if(!text||text.length>4000)return res.status(400).json({error:"Message must be between 1 and 4000 characters"});try{const[story]=await selectRows("stories",{filters:[eq("id",id)],limit:1});if(!story||Number(story.userId)===senderId)return res.status(400).json({error:"Invalid story reply"});const conversationId=await ensureFriendConversation(senderId,Number(story.userId)),now=new Date(),body=`Story • ${text}`;const message=await insertRow("messages",{conversationId,senderId,kind:"text",body,mediaUrl:null,durationMs:null,deliveredAt:null,readAt:null,replyToMessageId:null,forwardedFromMessageId:null,editedAt:null,deletedAt:null,createdAt:now});await updateRows("conversations",{updatedAt:now},[eq("id",conversationId)]);await insertRow("story_replies",{storyId:id,userId:senderId,messageId:Number(message.id),body:text,createdAt:now});await createNotification(Number(story.userId),senderId,"story_reply",text,{storyId:id,url:`/messages?userId=${senderId}`});return res.status(201).json({sent:true,messageId:Number(message.id)})}catch(err){return supabaseError(res,err)}});

export default storiesRouter;