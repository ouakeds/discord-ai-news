export interface CollectedItem {
  url: string;
  title: string;
  description: string;
  titleFr?: string;
  descriptionFr?: string;
  sourceName: string;
  theme: string;
  publishedAt: Date;
  imageUrl?: string;
}

export interface RssSource {
  type: 'rss';
  url: string;
  name: string;
  theme: string;
}

export interface YoutubeSource {
  type: 'youtube';
  channel_id: string;
  name: string;
  theme: string;
}

export interface RedditSource {
  type: 'reddit';
  subreddit: string;
  name: string;
  theme: string;
  min_score?: number;
}

export interface HnSource {
  type: 'hn';
  keywords: string[];
  min_score?: number;
  theme: string;
}

export interface ProductHuntSource {
  type: 'producthunt';
  theme: string;
}

export type SourceConfig =
  | RssSource
  | YoutubeSource
  | RedditSource
  | HnSource
  | ProductHuntSource;

export interface ThemeConfig {
  channel_id: string;
}

export interface ScheduleConfig {
  time: string;
}

export interface AdminConfig {
  alert_channel_id: string;
}

export interface AppConfig {
  schedule: ScheduleConfig;
  admin: AdminConfig;
  themes: Record<string, ThemeConfig>;
  sources: SourceConfig[];
}
