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

export const currentUser: User = {
  id: "me",
  username: "you",
  displayName: "You",
  avatar: "https://picsum.photos/seed/me/200/200",
  bio: "Living life one post at a time ✨ | Photographer | Traveler",
  location: "San Francisco, CA 🇺🇸",
  flag: "🇺🇸",
  verified: true,
  followers: 4820,
  following: 312,
  posts: 87,
  isOnline: true,
  coverPhoto: "https://picsum.photos/seed/cover_me/800/400",
  isFollowing: false,
  isFriend: false,
};

export const users: User[] = [
  {
    id: "u1",
    username: "maya_art",
    displayName: "Maya",
    avatar: "https://picsum.photos/seed/maya/200/200",
    bio: "Digital artist & coffee addict ☕ | Creating worlds one pixel at a time",
    location: "New York 🇺🇸",
    flag: "🇺🇸",
    verified: true,
    followers: 25600,
    following: 480,
    posts: 234,
    isOnline: true,
    coverPhoto: "https://picsum.photos/seed/cover_maya/800/400",
    isFollowing: true,
    isFriend: true,
  },
  {
    id: "u2",
    username: "alex_lens",
    displayName: "Alex",
    avatar: "https://picsum.photos/seed/alex/200/200",
    bio: "Street photographer | Capturing moments that matter 📸",
    location: "London 🇬🇧",
    flag: "🇬🇧",
    verified: false,
    followers: 8900,
    following: 320,
    posts: 156,
    isOnline: true,
    coverPhoto: "https://picsum.photos/seed/cover_alex/800/400",
    isFollowing: true,
    isFriend: true,
  },
  {
    id: "u3",
    username: "sophie_vibes",
    displayName: "Sophie",
    avatar: "https://picsum.photos/seed/sophie/200/200",
    bio: "Travel blogger | 47 countries and counting 🌍",
    location: "Paris 🇫🇷",
    flag: "🇫🇷",
    verified: true,
    followers: 142000,
    following: 890,
    posts: 521,
    isOnline: true,
    coverPhoto: "https://picsum.photos/seed/cover_sophie/800/400",
    isFollowing: true,
    isFriend: false,
  },
  {
    id: "u4",
    username: "ken.waves",
    displayName: "Ken",
    avatar: "https://picsum.photos/seed/ken/200/200",
    bio: "Surfer | Ocean lover 🌊 | Honolulu born & raised",
    location: "Hawaii 🇺🇸",
    flag: "🇺🇸",
    verified: false,
    followers: 6300,
    following: 210,
    posts: 98,
    isOnline: false,
    coverPhoto: "https://picsum.photos/seed/cover_ken/800/400",
    isFollowing: false,
    isFriend: false,
  },
  {
    id: "u5",
    username: "sara.creates",
    displayName: "Sara",
    avatar: "https://picsum.photos/seed/sara/200/200",
    bio: "Fashion designer | Building sustainable brands 🌿",
    location: "Milan 🇮🇹",
    flag: "🇮🇹",
    verified: true,
    followers: 88500,
    following: 1200,
    posts: 445,
    isOnline: false,
    coverPhoto: "https://picsum.photos/seed/cover_sara/800/400",
    isFollowing: true,
    isFriend: true,
  },
  {
    id: "u6",
    username: "liam.codes",
    displayName: "Liam",
    avatar: "https://picsum.photos/seed/liam/200/200",
    bio: "Full-stack dev | Building the future 💻 | Open source advocate",
    location: "Toronto 🇨🇦",
    flag: "🇨🇦",
    verified: false,
    followers: 3200,
    following: 540,
    posts: 67,
    isOnline: true,
    coverPhoto: "https://picsum.photos/seed/cover_liam/800/400",
    isFollowing: false,
    isFriend: false,
  },
  {
    id: "u7",
    username: "aina.mg",
    displayName: "Aina",
    avatar: "https://picsum.photos/seed/aina/200/200",
    bio: "Sunset chaser | Madagascar vibes 🌅 | Nature photographer",
    location: "Madagascar 🇲🇬",
    flag: "🇲🇬",
    verified: true,
    followers: 312000,
    following: 450,
    posts: 892,
    isOnline: false,
    coverPhoto: "https://picsum.photos/seed/cover_aina/800/400",
    isFollowing: false,
    isFriend: false,
  },
  {
    id: "u8",
    username: "jade.studio",
    displayName: "Jade",
    avatar: "https://picsum.photos/seed/jade/200/200",
    bio: "Interior design | Making spaces beautiful ✨",
    location: "Singapore 🇸🇬",
    flag: "🇸🇬",
    verified: false,
    followers: 15700,
    following: 380,
    posts: 203,
    isOnline: true,
    coverPhoto: "https://picsum.photos/seed/cover_jade/800/400",
    isFollowing: true,
    isFriend: true,
  },
];

const sponsorUsers: User[] = [
  {
    id: "sp1",
    username: "nike",
    displayName: "Nike",
    avatar: "https://picsum.photos/seed/nike_brand/200/200",
    bio: "Just Do It. ✓",
    location: "Beaverton, OR 🇺🇸",
    flag: "🇺🇸",
    verified: true,
    followers: 5200000,
    following: 0,
    posts: 4200,
    isOnline: false,
    coverPhoto: "https://picsum.photos/seed/nike_cover/800/400",
    isFollowing: false,
    isFriend: false,
  },
  {
    id: "sp2",
    username: "samsung_official",
    displayName: "Samsung",
    avatar: "https://picsum.photos/seed/samsung_brand/200/200",
    bio: "Do What You Can't 📱",
    location: "Seoul, South Korea 🇰🇷",
    flag: "🇰🇷",
    verified: true,
    followers: 8900000,
    following: 0,
    posts: 6800,
    isOnline: false,
    coverPhoto: "https://picsum.photos/seed/samsung_cover/800/400",
    isFollowing: false,
    isFriend: false,
  },
];

export const allUsers: User[] = [currentUser, ...users, ...sponsorUsers];

export const getUserById = (id: string): User | undefined =>
  allUsers.find((u) => u.id === id);

export const stories: Story[] = [
  { id: "s1", userId: "u1", imageUrl: "https://picsum.photos/seed/story1/400/700", timestamp: "2h", viewed: false },
  { id: "s2", userId: "u2", imageUrl: "https://picsum.photos/seed/story2/400/700", timestamp: "3h", viewed: false },
  { id: "s3", userId: "u3", imageUrl: "https://picsum.photos/seed/story3/400/700", timestamp: "5h", viewed: true },
  { id: "s4", userId: "u4", imageUrl: "https://picsum.photos/seed/story4/400/700", timestamp: "6h", viewed: true },
  { id: "s5", userId: "u5", imageUrl: "https://picsum.photos/seed/story5/400/700", timestamp: "8h", viewed: false },
  { id: "s6", userId: "u6", imageUrl: "https://picsum.photos/seed/story6/400/700", timestamp: "9h", viewed: true },
  { id: "s7", userId: "u7", imageUrl: "https://picsum.photos/seed/story7/400/700", timestamp: "10h", viewed: false },
];

export const posts: Post[] = [
  {
    id: "p1",
    userId: "u7",
    imageUrl: "https://picsum.photos/seed/post1/600/900",
    caption: "Sunset hits different 🌅✨",
    hashtags: ["#sunset", "#goodvibes", "#life"],
    likes: 25600,
    comments: 1200,
    shares: 3400,
    saves: 2100,
    timestamp: "2h",
    isLiked: false,
    isSaved: false,
    location: "Madagascar",
  },
  {
    id: "p2",
    userId: "u1",
    imageUrl: "https://picsum.photos/seed/post2/600/900",
    caption: "New artwork just dropped! What do you think? 🎨",
    hashtags: ["#art", "#digitalart", "#creative"],
    likes: 8900,
    comments: 432,
    shares: 1200,
    saves: 980,
    timestamp: "4h",
    isLiked: true,
    isSaved: false,
  },
  {
    id: "p3",
    userId: "u3",
    imageUrl: "https://picsum.photos/seed/post3/600/900",
    caption: "Morning views from Santorini 🏛️",
    hashtags: ["#travel", "#greece", "#wanderlust"],
    likes: 45200,
    comments: 2100,
    shares: 8900,
    saves: 12000,
    timestamp: "6h",
    isLiked: false,
    isSaved: true,
    location: "Santorini, Greece",
  },
  {
    id: "p4",
    userId: "u2",
    imageUrl: "https://picsum.photos/seed/post4/600/900",
    caption: "The city never sleeps 🌃",
    hashtags: ["#streetphoto", "#nightlife", "#urban"],
    likes: 3400,
    comments: 156,
    shares: 450,
    saves: 320,
    timestamp: "8h",
    isLiked: false,
    isSaved: false,
    location: "London",
  },
  {
    id: "p5",
    userId: "u5",
    imageUrl: "https://picsum.photos/seed/post5/600/900",
    caption: "New collection dropping this week 🌿",
    hashtags: ["#fashion", "#sustainable", "#style"],
    likes: 18700,
    comments: 890,
    shares: 2300,
    saves: 4500,
    timestamp: "12h",
    isLiked: true,
    isSaved: true,
  },
  {
    id: "p6",
    userId: "u4",
    imageUrl: "https://picsum.photos/seed/post6/600/900",
    caption: "Perfect waves this morning 🌊",
    hashtags: ["#surf", "#ocean", "#hawaii"],
    likes: 5600,
    comments: 234,
    shares: 780,
    saves: 1100,
    timestamp: "1d",
    isLiked: false,
    isSaved: false,
    location: "North Shore, Hawaii",
  },
  {
    id: "p7",
    userId: "u8",
    imageUrl: "https://picsum.photos/seed/post7/600/900",
    caption: "Living room transformation — before & after ✨",
    hashtags: ["#interiordesign", "#homedecor", "#transformation"],
    likes: 12300,
    comments: 567,
    shares: 1890,
    saves: 8900,
    timestamp: "2d",
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p8",
    userId: "u6",
    imageUrl: "https://picsum.photos/seed/post8/600/900",
    caption: "Shipping my first open source project 🚀",
    hashtags: ["#coding", "#opensource", "#developer"],
    likes: 2100,
    comments: 98,
    shares: 340,
    saves: 450,
    timestamp: "3d",
    isLiked: false,
    isSaved: false,
  },
];

export const sponsoredPosts: Post[] = [
  {
    id: "ad1",
    userId: "sp1",
    imageUrl: "https://picsum.photos/seed/sponsor_ad1/600/900",
    caption: "Step into the future of performance. Our latest collection is here. 💪",
    hashtags: ["#JustDoIt", "#Nike", "#Sport"],
    likes: 145200,
    comments: 3240,
    shares: 28900,
    saves: 12400,
    timestamp: "Sponsored",
    isLiked: false,
    isSaved: false,
    isSponsored: true,
    sponsorCta: "Shop Now",
  },
  {
    id: "ad2",
    userId: "sp2",
    imageUrl: "https://picsum.photos/seed/sponsor_ad2/600/900",
    caption: "See the world in a whole new way. Galaxy S25 Ultra. 📱✨",
    hashtags: ["#Samsung", "#GalaxyS25", "#DoWhatYouCant"],
    likes: 289700,
    comments: 8900,
    shares: 42100,
    saves: 18700,
    timestamp: "Sponsored",
    isLiked: false,
    isSaved: false,
    isSponsored: true,
    sponsorCta: "Learn More",
  },
];

export const getFeedWithAds = (): Post[] => {
  const result: Post[] = [];
  const adPositions = [2, 5];
  let adIndex = 0;
  posts.forEach((post, i) => {
    result.push(post);
    if (adPositions.includes(i + 1) && adIndex < sponsoredPosts.length) {
      result.push(sponsoredPosts[adIndex++]);
    }
  });
  return result;
};

export const getPostsByUser = (userId: string) =>
  posts.filter((p) => p.userId === userId);

export const conversations: Conversation[] = [
  { id: "c1", userId: "u1", lastMessage: "Love your latest post! 😍", lastMessageTime: "2m", unread: 3, isOnline: true },
  { id: "c2", userId: "u2", lastMessage: "When are you coming to London?", lastMessageTime: "1h", unread: 0, isOnline: true },
  { id: "c3", userId: "u3", lastMessage: "Let's collab on something!", lastMessageTime: "3h", unread: 1, isOnline: false },
  { id: "c4", userId: "u5", lastMessage: "Sent you the files 📎", lastMessageTime: "5h", unread: 0, isOnline: false },
  { id: "c5", userId: "u8", lastMessage: "That design is gorgeous ✨", lastMessageTime: "1d", unread: 0, isOnline: true },
  { id: "c6", userId: "u4", lastMessage: "Waves were insane today!", lastMessageTime: "2d", unread: 0, isOnline: false },
  { id: "c7", userId: "u6", lastMessage: "Check out my new repo", lastMessageTime: "3d", unread: 0, isOnline: false },
];

export const getChatMessages = (userId: string): Message[] => [
  { id: "m1", senderId: userId, text: "Hey! Love your content!", timestamp: "10:20 AM", read: true, reactions: [], type: "text" },
  { id: "m2", senderId: "me", text: "Thank you so much! ❤️", timestamp: "10:22 AM", read: true, reactions: ["❤️"], type: "text" },
  { id: "m3", senderId: userId, text: "How do you edit your photos?", timestamp: "10:25 AM", read: true, reactions: [], type: "text" },
  { id: "m4", senderId: "me", text: "I use Lightroom mostly! I can send you my presets if you want", timestamp: "10:26 AM", read: true, reactions: [], type: "text" },
  { id: "m5", senderId: userId, imageUrl: "https://picsum.photos/seed/chat_img/400/300", timestamp: "10:28 AM", read: true, reactions: [], type: "image" },
  { id: "m6", senderId: userId, text: "Edited this one, what do you think?", timestamp: "10:28 AM", read: true, reactions: [], type: "text" },
  { id: "m7", senderId: "me", text: "Wow this looks amazing! Great job 🎉", timestamp: "10:30 AM", read: true, reactions: ["🔥"], type: "text" },
  { id: "m8", senderId: userId, text: "We should definitely collab sometime!", timestamp: "10:32 AM", read: false, reactions: [], type: "text" },
];

export const notifications: Notification[] = [
  { id: "n1", type: "like", userId: "u1", postId: "p2", text: "liked your post", timestamp: "2m", read: false },
  { id: "n2", type: "follow", userId: "u3", text: "started following you", timestamp: "5m", read: false },
  { id: "n3", type: "comment", userId: "u2", postId: "p1", text: 'commented: "Absolutely stunning! 😍"', timestamp: "10m", read: false },
  { id: "n4", type: "mention", userId: "u5", postId: "p3", text: "mentioned you in a post", timestamp: "30m", read: true },
  { id: "n5", type: "like", userId: "u4", postId: "p1", text: "liked your photo", timestamp: "1h", read: true },
  { id: "n6", type: "story_reply", userId: "u8", text: "replied to your story", timestamp: "2h", read: true },
  { id: "n7", type: "follow", userId: "u6", text: "started following you", timestamp: "3h", read: true },
  { id: "n8", type: "like", userId: "u7", postId: "p2", text: "liked your post", timestamp: "4h", read: true },
  { id: "n9", type: "comment", userId: "u1", postId: "p3", text: 'commented: "This is art 🎨"', timestamp: "5h", read: true },
  { id: "n10", type: "tag", userId: "u3", postId: "p4", text: "tagged you in a photo", timestamp: "6h", read: true },
];

export const suggestedFriends: User[] = [
  { ...users[3], isFollowing: false, isFriend: false },
  { ...users[5], isFollowing: false, isFriend: false },
  { ...users[6], isFollowing: false, isFriend: false },
];

export const friendRequests: { user: User; mutualFriends: number }[] = [
  { user: users[2], mutualFriends: 12 },
  { user: users[6], mutualFriends: 5 },
];

export const formatCount = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "K";
  return n.toString();
};
