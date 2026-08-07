export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  location: string;
  flag: string;
  verified: boolean;
  followers: number;
  following: number;
  posts: number;
  isOnline: boolean;
  coverPhoto: string;
  isFollowing: boolean;
  isFriend: boolean;
  website?: string;
}

export interface Story {
  id: string;
  userId: string;
  imageUrl: string;
  timestamp: string;
  viewed: boolean;
}

export interface Post {
  id: string;
  userId: string;
  imageUrl: string;
  mediaType?: "image" | "video" | "carousel" | "text";
  mediaItems?: string[];
  views?: number;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  timestamp: string;
  isLiked: boolean;
  isSaved: boolean;
  location?: string;
  isVideo?: boolean;
  isSponsored?: boolean;
  sponsorCta?: string;
}

export interface Comment {
  id: string;
  userId: string;
  postId: string;
  text: string;
  timestamp: string;
  likes: number;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  timestamp: string;
  read: boolean;
  reactions: string[];
  type: "text" | "image" | "voice";
}

export interface Conversation {
  id: string;
  userId: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  isOnline: boolean;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "story_reply" | "mention" | "tag";
  userId: string;
  postId?: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export const currentUser: User | null = null;
export const users: User[] = [];
export const stories: Story[] = [];
export const posts: Post[] = [];
export const comments: Comment[] = [];
export const conversations: Conversation[] = [];
export const notifications: Notification[] = [];
export const friendRequests: Array<{ user: User; mutualFriends: number }> = [];
export const suggestedFriends: User[] = [];

export function getUserById(_id: string): User | undefined { return undefined; }
export function getPostsByUser(_userId: string): Post[] { return []; }
export function getCommentsByPost(_postId: string): Comment[] { return []; }
export function getChatMessages(_userId: string): Message[] { return []; }
export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
