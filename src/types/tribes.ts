export interface Tribe {
  id: number;
  name: string;
  score: number;
  theme_color: string | null;
  bg_image_url: string | null;
}

export interface Badge {
  id: number;
  title: string;
  required_flags: number;
  icon_url: string | null;
  description?: string | null;
}

export interface TribeBadge {
  id: number;
  tribe_id: number;
  badge_id: number;
  earned_at: string;
}

export interface TribeFlagSettings {
  id: number;
  student_attendance: number;
  excellent_page: number;
  good_page: number;
  medium_page: number;
  assignment_completion: number;
  awqaf_certificate: number;
}

export type TribeFlagRule = keyof Omit<TribeFlagSettings, "id">;

export interface TribeStudent {
  id: number;
  tribe_id: number;
  student_id: number;
  assigned_at: string;
}

export interface TribeLog {
  id: number;
  tribe_id: number;
  student_id: number | null;
  student_name: string;
  flags_added: number;
  reason: string;
  created_at: string;
}