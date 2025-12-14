export interface ModeratorDbEntity {
  id: string;
  full_name: string;
  email: string;
  image_url?: string | null;
  created_at: Date | string;
}

export interface ModeratorEntity {
  id: string;
  fullname: string;
  email: string;
  image?: string | null;
  created_at: Date | string;
}

