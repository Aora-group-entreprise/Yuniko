import { useCallback } from "react";
import { InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorldFeed } from "@/features/feed/feed-api";

export interface WorldFeedAuthor { displayName:string; username:string; avatarUrl:string|null; verified?:boolean; isFollowing?:boolean }
export interface WorldFeedPost { post:any; author:WorldFeedAuthor; raw:any }
export interface WorldFeedPage { items:WorldFeedPost[]; nextCursor:number|null; hasMore:boolean }

function normalizeCursor(value:unknown):number|null{if(typeof value==="number"&&Number.isSafeInteger(value)&&value>0)return value;if(typeof value==="string"&&value.trim()!==""){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null}return null}
function relativeTime(iso:string){const diff=Math.max(0,Date.now()-new Date(iso).getTime()),m=Math.floor(diff/60000);if(m<1)return"just now";if(m<60)return`${m}m`;const h=Math.floor(m/60);if(h<24)return`${h}h`;return`${Math.floor(h/24)}d`}
function convert(raw:any):WorldFeedPost{let mediaItems:string[]|undefined;if(raw.mediaItems){try{const parsed=typeof raw.mediaItems==="string"?JSON.parse(raw.mediaItems):raw.mediaItems;if(Array.isArray(parsed))mediaItems=parsed}catch{}}return{raw,post:{id:raw.id,userId:raw.userId,imageUrl:raw.mediaUrl??"",mediaType:raw.mediaType??"text",mediaItems,caption:raw.caption??"",hashtags:raw.hashtags?String(raw.hashtags).split(/[\s,]+/).filter(Boolean):[],likes:raw.likes??0,comments:raw.comments??0,shares:raw.shares??0,saves:raw.saves??0,timestamp:relativeTime(raw.createdAt),isLiked:Boolean(raw.liked),isSaved:Boolean(raw.saved),location:raw.location??undefined,views:raw.views??0,isSponsored:Boolean(raw.isSponsored),sponsorCta:raw.sponsorCta??undefined},author:{displayName:raw.authorDisplayName??"Yuniko user",username:raw.authorUsername??"user",avatarUrl:raw.authorAvatarUrl??null,verified:Boolean(raw.authorVerified),isFollowing:Boolean(raw.following??raw.isFollowing)}}}

async function fetchWorldFeedPage(cursor:number|null,signal?:AbortSignal):Promise<WorldFeedPage>{const data=await fetchWorldFeed({cursor,limit:cursor===null?50:20,signal});const posts=Array.isArray(data.posts)?data.posts:[];const nextCursor=normalizeCursor(data.nextCursor);return{items:posts.map(convert),nextCursor,hasMore:Boolean(data.hasMore)&&nextCursor!==null&&posts.length>0}}

export const worldFeedKeys={all:(userId:number|null)=>["world-feed",userId] as const};

export function useWorldFeed(userId:number|null){const queryClient=useQueryClient();const query=useInfiniteQuery({queryKey:worldFeedKeys.all(userId),enabled:userId!==null,initialPageParam:null as number|null,queryFn:({pageParam,signal})=>fetchWorldFeedPage(pageParam,signal),getNextPageParam:last=>last.hasMore&&last.nextCursor!==null?last.nextCursor:undefined,staleTime:0,gcTime:15*60_000,retry:2,refetchOnWindowFocus:true,refetchOnMount:"always",refetchOnReconnect:true,refetchInterval:15000,refetchIntervalInBackground:false});

const checkNewPosts=useCallback(async()=>{if(userId===null)return 0;try{const firstPage=await fetchWorldFeedPage(null);const current=queryClient.getQueryData<InfiniteData<WorldFeedPage,number|null>>(worldFeedKeys.all(userId));if(!current||current.pages.length===0)return firstPage.items.length;const existingIds=new Set(current.pages.flatMap(page=>page.items.map(item=>String(item.post.id))));return firstPage.items.filter(item=>!existingIds.has(String(item.post.id))).length}catch{return 0}},[queryClient,userId]);

const refreshNewPosts=useCallback(async()=>{if(userId===null)return 0;try{const firstPage=await fetchWorldFeedPage(null);const key=worldFeedKeys.all(userId);let added=0;queryClient.setQueryData<InfiniteData<WorldFeedPage,number|null>>(key,current=>{if(!current||current.pages.length===0){added=firstPage.items.length;return{pages:[firstPage],pageParams:[null]};}const existingIds=new Set(current.pages.flatMap(page=>page.items.map(item=>String(item.post.id))));const incomingById=new Map(firstPage.items.map(item=>[String(item.post.id),item]));const fresh=firstPage.items.filter(item=>!existingIds.has(String(item.post.id)));added=fresh.length;const pages=current.pages.map((page,index)=>{const updated=page.items.map(item=>incomingById.get(String(item.post.id))??item);if(index===0){const freshIds=new Set(fresh.map(item=>String(item.post.id)));return{...page,items:[...fresh,...updated.filter(item=>!freshIds.has(String(item.post.id)))]};}return{...page,items:updated}});return{...current,pages};});return added}catch{return 0}},[queryClient,userId]);

return{...query,refreshNewPosts,checkNewPosts}}
export function flattenWorldFeed(data:{pages?:WorldFeedPage[]}|undefined):WorldFeedPost[]{return data?.pages?.flatMap(page=>page.items)??[]}
