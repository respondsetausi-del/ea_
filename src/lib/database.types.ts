export interface Database {
  public: {
    Tables: {
      distributors: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
        };
      };
      branding: {
        Row: {
          id: string;
          distributor_id: string;
          app_name: string;
          glow_color: string;
          logo_url: string | null;
          robot_image_url: string | null;
          tagline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          distributor_id: string;
          app_name: string;
          glow_color?: string;
          logo_url?: string | null;
          robot_image_url?: string | null;
          tagline?: string | null;
        };
        Update: {
          app_name?: string;
          glow_color?: string;
          logo_url?: string | null;
          robot_image_url?: string | null;
          tagline?: string | null;
          updated_at?: string;
        };
      };
      eas: {
        Row: {
          id: string;
          distributor_id: string;
          name: string;
          description: string | null;
          mentor_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          distributor_id: string;
          name: string;
          description?: string | null;
          mentor_id: string;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          mentor_id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      app_users: {
        Row: {
          id: string;
          distributor_id: string;
          ea_id: string;
          email: string;
          is_active: boolean;
          created_at: string;
          last_seen: string | null;
        };
        Insert: {
          id?: string;
          distributor_id: string;
          ea_id: string;
          email: string;
          is_active?: boolean;
        };
        Update: {
          email?: string;
          is_active?: boolean;
          last_seen?: string | null;
        };
      };
    };
  };
}

export type Distributor = Database['public']['Tables']['distributors']['Row'];
export type Branding = Database['public']['Tables']['branding']['Row'];
export type EA = Database['public']['Tables']['eas']['Row'];
export type AppUser = Database['public']['Tables']['app_users']['Row'];
