import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
function getSecret(): string { return process.env["SESSION_SECRET"] ?? "yuniko-dev-secret-change-in-prod"; }
export interface AuthPayload { userId:number; }
export function authMiddleware(req:Request,res:Response,next:NextFunction):void {
  const header=req.headers["authorization"];
  const queryToken=typeof req.query.token === "string" ? req.query.token : undefined;
  const token=header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if(!token){res.status(401).json({error:"Unauthorized"});return;}
  try{const payload=jwt.verify(token,getSecret()) as AuthPayload;(req as Request & {userId:number}).userId=payload.userId;next();}
  catch{res.status(401).json({error:"Invalid or expired token"});}
}
export function signToken(userId:number):string{return jwt.sign({userId},getSecret(),{expiresIn:"30d"});}
