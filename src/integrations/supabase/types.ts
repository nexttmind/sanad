/**
 * Manually synced from supabase/migrations (Step 0.3).
 * Regenerate when CLI access is available: npm run types:gen
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_saved_views: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          filters: Json;
          sort: Json;
          columns: Json | null;
          is_shared: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          filters?: Json;
          sort?: Json;
          columns?: Json | null;
          is_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          filters?: Json;
          sort?: Json;
          columns?: Json | null;
          is_shared?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      aid_request_files: {
        Row: {
          id: string;
          request_id: string;
          bucket: string;
          storage_path: string;
          kind: string;
          size_bytes: number | null;
          mime: string | null;
          doc_admin_verified: boolean | null;
          doc_verified_by: string | null;
          doc_verified_at: string | null;
          doc_rejection_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          bucket: string;
          storage_path: string;
          kind: string;
          size_bytes?: number | null;
          mime?: string | null;
          doc_admin_verified?: boolean | null;
          doc_verified_by?: string | null;
          doc_verified_at?: string | null;
          doc_rejection_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          bucket?: string;
          storage_path?: string;
          kind?: string;
          size_bytes?: number | null;
          mime?: string | null;
          doc_admin_verified?: boolean | null;
          doc_verified_by?: string | null;
          doc_verified_at?: string | null;
          doc_rejection_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aid_request_files_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      aid_request_history: {
        Row: {
          id: string;
          request_id: string;
          from_status: Database["public"]["Enums"]["request_status"] | null;
          to_status: Database["public"]["Enums"]["request_status"];
          changed_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          to_status: Database["public"]["Enums"]["request_status"];
          changed_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          to_status?: Database["public"]["Enums"]["request_status"];
          changed_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aid_request_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      aid_request_notes: {
        Row: {
          id: string;
          request_id: string;
          author_id: string | null;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          author_id?: string | null;
          note: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          author_id?: string | null;
          note?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aid_request_notes_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      aid_requests: {
        Row: {
          id: string;
          reference_code: string;
          full_name: string;
          phone: string;
          alt_phone: string | null;
          national_id: string | null;
          phone_normalized: string | null;
          national_id_normalized: string | null;
          document_type: string | null;
          governorate: string | null;
          district: string | null;
          town: string | null;
          current_address: string | null;
          housing_type: string | null;
          family_size: number;
          infants: number;
          children: number;
          elderly: number;
          disabled: boolean;
          chronic_illness: boolean;
          pregnant_or_nursing: boolean;
          displaced: boolean;
          displacement_date: string | null;
          origin_town: string | null;
          needs: string[];
          needs_other: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["request_status"];
          trust_score: number;
          urgency_score: number;
          flags: string[];
          rejection_reason: string | null;
          distribution_date: string | null;
          distribution_location: string | null;
          submission_seconds: number | null;
          ip_hash: string | null;
          user_agent: string | null;
          phone_verified: boolean;
          device_fingerprint: string | null;
          is_duplicate: boolean;
          priority_override: boolean;
          risk_level: Database["public"]["Enums"]["risk_level"];
          last_scored_at: string | null;
          urgency_tier: Database["public"]["Enums"]["urgency_tier"] | null;
          urgency_breakdown: Json | null;
          effective_urgency: number | null;
          manual_urgency: number | null;
          manual_urgency_reason: string | null;
          manual_urgency_by: string | null;
          manual_urgency_at: string | null;
          priority_override_floor: number;
          queue_number: number;
          queued_at: string;
          qr_pin: string | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          full_name: string;
          phone: string;
          alt_phone?: string | null;
          national_id?: string | null;
          phone_normalized?: string | null;
          national_id_normalized?: string | null;
          document_type?: string | null;
          governorate?: string | null;
          district?: string | null;
          town?: string | null;
          current_address?: string | null;
          housing_type?: string | null;
          family_size?: number;
          infants?: number;
          children?: number;
          elderly?: number;
          disabled?: boolean;
          chronic_illness?: boolean;
          pregnant_or_nursing?: boolean;
          displaced?: boolean;
          displacement_date?: string | null;
          origin_town?: string | null;
          needs?: string[];
          needs_other?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          trust_score?: number;
          urgency_score?: number;
          flags?: string[];
          rejection_reason?: string | null;
          distribution_date?: string | null;
          distribution_location?: string | null;
          submission_seconds?: number | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          phone_verified?: boolean;
          device_fingerprint?: string | null;
          is_duplicate?: boolean;
          priority_override?: boolean;
          risk_level?: Database["public"]["Enums"]["risk_level"];
          last_scored_at?: string | null;
          urgency_tier?: Database["public"]["Enums"]["urgency_tier"] | null;
          urgency_breakdown?: Json | null;
          effective_urgency?: number | null;
          manual_urgency?: number | null;
          manual_urgency_reason?: string | null;
          manual_urgency_by?: string | null;
          manual_urgency_at?: string | null;
          priority_override_floor?: number;
          queue_number?: number;
          queued_at?: string;
          qr_pin?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          full_name?: string;
          phone?: string;
          alt_phone?: string | null;
          national_id?: string | null;
          phone_normalized?: string | null;
          national_id_normalized?: string | null;
          document_type?: string | null;
          governorate?: string | null;
          district?: string | null;
          town?: string | null;
          current_address?: string | null;
          housing_type?: string | null;
          family_size?: number;
          infants?: number;
          children?: number;
          elderly?: number;
          disabled?: boolean;
          chronic_illness?: boolean;
          pregnant_or_nursing?: boolean;
          displaced?: boolean;
          displacement_date?: string | null;
          origin_town?: string | null;
          needs?: string[];
          needs_other?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          trust_score?: number;
          urgency_score?: number;
          flags?: string[];
          rejection_reason?: string | null;
          distribution_date?: string | null;
          distribution_location?: string | null;
          submission_seconds?: number | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          phone_verified?: boolean;
          device_fingerprint?: string | null;
          is_duplicate?: boolean;
          priority_override?: boolean;
          risk_level?: Database["public"]["Enums"]["risk_level"];
          last_scored_at?: string | null;
          urgency_tier?: Database["public"]["Enums"]["urgency_tier"] | null;
          urgency_breakdown?: Json | null;
          effective_urgency?: number | null;
          manual_urgency?: number | null;
          manual_urgency_reason?: string | null;
          manual_urgency_by?: string | null;
          manual_urgency_at?: string | null;
          priority_override_floor?: number;
          queue_number?: number;
          queued_at?: string;
          qr_pin?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          diff: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          diff?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          diff?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      conflict_zones: {
        Row: {
          id: string;
          region_name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          region_name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          region_name?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      distribution_events: {
        Row: {
          id: string;
          name: string;
          location: string;
          scheduled_at: string;
          capacity: number | null;
          status: Database["public"]["Enums"]["distribution_status"];
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          scheduled_at: string;
          capacity?: number | null;
          status?: Database["public"]["Enums"]["distribution_status"];
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          scheduled_at?: string;
          capacity?: number | null;
          status?: Database["public"]["Enums"]["distribution_status"];
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      donation_proof_photos: {
        Row: {
          id: string;
          asset_key: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_key: string;
          label: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_key?: string;
          label?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      donations: {
        Row: {
          id: string;
          reference_code: string;
          donor_name: string | null;
          donor_email: string | null;
          donor_phone: string | null;
          is_anonymous: boolean;
          amount: number;
          currency: string;
          method: Database["public"]["Enums"]["donation_method"];
          pledged_for_request: string | null;
          message: string | null;
          status: Database["public"]["Enums"]["donation_status"];
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          donor_name?: string | null;
          donor_email?: string | null;
          donor_phone?: string | null;
          is_anonymous?: boolean;
          amount: number;
          currency?: string;
          method: Database["public"]["Enums"]["donation_method"];
          pledged_for_request?: string | null;
          message?: string | null;
          status?: Database["public"]["Enums"]["donation_status"];
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          donor_name?: string | null;
          donor_email?: string | null;
          donor_phone?: string | null;
          is_anonymous?: boolean;
          amount?: number;
          currency?: string;
          method?: Database["public"]["Enums"]["donation_method"];
          pledged_for_request?: string | null;
          message?: string | null;
          status?: Database["public"]["Enums"]["donation_status"];
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "donations_pledged_for_request_fkey";
            columns: ["pledged_for_request"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      export_jobs: {
        Row: {
          id: string;
          user_id: string;
          filters: Json;
          columns: Json;
          status: string;
          total_count: number;
          processed_count: number;
          csv_data: string | null;
          csv_path: string | null;
          row_count: number | null;
          error_message: string | null;
          last_cursor: Json | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          filters?: Json;
          columns?: Json;
          status?: string;
          total_count?: number;
          processed_count?: number;
          csv_data?: string | null;
          csv_path?: string | null;
          row_count?: number | null;
          error_message?: string | null;
          last_cursor?: Json | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          filters?: Json;
          columns?: Json;
          status?: string;
          total_count?: number;
          processed_count?: number;
          csv_data?: string | null;
          csv_path?: string | null;
          row_count?: number | null;
          error_message?: string | null;
          last_cursor?: Json | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      fraud_events: {
        Row: {
          id: string;
          request_id: string;
          code: string;
          severity: string;
          points_delta: number;
          details: Json | null;
          resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          code: string;
          severity?: string;
          points_delta?: number;
          details?: Json | null;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          code?: string;
          severity?: string;
          points_delta?: number;
          details?: Json | null;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fraud_events_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      mukhtar_whitelist: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          region: string | null;
          title: string | null;
          verified_at: string | null;
          added_by: string | null;
          created_at: string;
          village: string | null;
          reference_type: string | null;
          is_active: boolean;
          verified_by: string | null;
          times_referenced: number;
          deactivation_reason: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          region?: string | null;
          title?: string | null;
          verified_at?: string | null;
          added_by?: string | null;
          created_at?: string;
          village?: string | null;
          reference_type?: string | null;
          is_active?: boolean;
          verified_by?: string | null;
          times_referenced?: number;
          deactivation_reason?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          region?: string | null;
          title?: string | null;
          verified_at?: string | null;
          added_by?: string | null;
          created_at?: string;
          village?: string | null;
          reference_type?: string | null;
          is_active?: boolean;
          verified_by?: string | null;
          times_referenced?: number;
          deactivation_reason?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      payment_proofs: {
        Row: {
          id: string;
          donation_id: string;
          bucket: string;
          storage_path: string;
          claimed_amount: number | null;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          donation_id: string;
          bucket?: string;
          storage_path: string;
          claimed_amount?: number | null;
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          donation_id?: string;
          bucket?: string;
          storage_path?: string;
          claimed_amount?: number | null;
          verified?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_proofs_donation_id_fkey";
            columns: ["donation_id"];
            isOneToOne: false;
            referencedRelation: "donations";
            referencedColumns: ["id"];
          },
        ];
      };
      phone_verifications: {
        Row: {
          id: string;
          phone: string;
          code: string;
          attempts: number;
          verified_at: string | null;
          expires_at: string;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          code: string;
          attempts?: number;
          verified_at?: string | null;
          expires_at?: string;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          code?: string;
          attempts?: number;
          verified_at?: string | null;
          expires_at?: string;
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pin_attempt_log: {
        Row: {
          id: string;
          request_id: string;
          staff_id: string | null;
          success: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          staff_id?: string | null;
          success: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          staff_id?: string | null;
          success?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pin_attempt_log_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_completions: {
        Row: {
          id: string;
          request_id: string;
          event_id: string | null;
          pin: string;
          scanned_by: string | null;
          scanned_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          event_id?: string | null;
          pin: string;
          scanned_by?: string | null;
          scanned_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          event_id?: string | null;
          pin?: string;
          scanned_by?: string | null;
          scanned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_completions_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_completions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "distribution_events";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_log: {
        Row: {
          id: string;
          identifier: string;
          action: string;
          is_blocked: boolean;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          identifier: string;
          action: string;
          is_blocked?: boolean;
          meta?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          identifier?: string;
          action?: string;
          is_blocked?: boolean;
          meta?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      request_tags: {
        Row: {
          request_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          request_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_tags_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      scoring_config: {
        Row: {
          id: string;
          version: number;
          rules: Json;
          is_active: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          version: number;
          rules: Json;
          is_active?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          version?: number;
          rules?: Json;
          is_active?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_site_config: {
        Row: {
          id: string;
          version: number;
          config: Json;
          is_active: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          version: number;
          config: Json;
          is_active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          version?: number;
          config?: Json;
          is_active?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      submission_references: {
        Row: {
          id: string;
          request_id: string;
          reference_type: string;
          full_name: string;
          phone: string;
          region: string | null;
          village: string | null;
          known_duration: string | null;
          notes: string | null;
          is_whitelisted: boolean;
          whitelist_id: string | null;
          contact_result: Database["public"]["Enums"]["reference_contact_result"];
          contacted_at: string | null;
          contact_notes: string | null;
          contacted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          reference_type: string;
          full_name: string;
          phone: string;
          region?: string | null;
          village?: string | null;
          known_duration?: string | null;
          notes?: string | null;
          is_whitelisted?: boolean;
          whitelist_id?: string | null;
          contact_result?: Database["public"]["Enums"]["reference_contact_result"];
          contacted_at?: string | null;
          contact_notes?: string | null;
          contacted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          reference_type?: string;
          full_name?: string;
          phone?: string;
          region?: string | null;
          village?: string | null;
          known_duration?: string | null;
          notes?: string | null;
          is_whitelisted?: boolean;
          whitelist_id?: string | null;
          contact_result?: Database["public"]["Enums"]["reference_contact_result"];
          contacted_at?: string | null;
          contact_notes?: string | null;
          contacted_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submission_references_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submission_references_whitelist_id_fkey";
            columns: ["whitelist_id"];
            isOneToOne: false;
            referencedRelation: "mukhtar_whitelist";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          slug: string;
          name_ar: string;
          color: string;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_ar: string;
          color?: string;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name_ar?: string;
          color?: string;
          category?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      urgency_score_history: {
        Row: {
          id: string;
          request_id: string;
          calculated_urgency: number;
          effective_urgency: number;
          urgency_tier: Database["public"]["Enums"]["urgency_tier"];
          breakdown: Json;
          config_version: number;
          triggered_by: string;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          calculated_urgency: number;
          effective_urgency: number;
          urgency_tier: Database["public"]["Enums"]["urgency_tier"];
          breakdown: Json;
          config_version?: number;
          triggered_by?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          calculated_urgency?: number;
          effective_urgency?: number;
          urgency_tier?: Database["public"]["Enums"]["urgency_tier"];
          breakdown?: Json;
          config_version?: number;
          triggered_by?: string;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "urgency_score_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "aid_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      adoptable_families: {
        Args: { _limit?: number };
        Returns: {
          request_id: string;
          reference_code: string;
          region: string;
          family_size: number;
          infants: number;
          needs_summary: string | null;
          tag: string;
          raised: number;
          goal: number;
        }[];
      };
      advance_export_job: {
        Args: { _job_id: string };
        Returns: Json;
      };
      bulk_recalculate_scores: {
        Args: { _offset?: number; _batch_size?: number };
        Returns: Json;
      };
      calculate_scores: {
        Args: { _request_id: string; _triggered_by?: string };
        Returns: {
          trust: number;
          urgency: number;
          risk: Database["public"]["Enums"]["risk_level"];
        }[];
      };
      check_queue_integrity: {
        Args: Record<string, never>;
        Returns: Json;
      };
      check_submission_eligibility: {
        Args: { _phone: string; _national_id: string };
        Returns: Json;
      };
      check_rate_limit: {
        Args: {
          _identifier: string;
          _action: string;
          _max_count: number;
          _window_seconds: number;
        };
        Returns: Json;
      };
      claim_first_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      create_export_job: {
        Args: { _filters?: Json; _columns?: Json };
        Returns: Json;
      };
      donation_impact_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      export_submissions_csv: {
        Args: { _filters?: Json; _columns?: Json };
        Returns: string;
      };
      fetch_export_job_csv: {
        Args: { _job_id: string };
        Returns: string;
      };
      get_public_site_config: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_active_scoring_config: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_export_job: {
        Args: { _job_id: string };
        Returns: Json;
      };
      get_scoring_preview_samples: {
        Args: { _limit?: number };
        Returns: Json;
      };
      get_admin_overview_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_submission_status: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_staff: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      list_admin_users: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          display_name: string;
          role: Database["public"]["Enums"]["app_role"];
          is_active: boolean;
          created_at: string;
          last_sign_in_at: string | null;
        }[];
      };
      list_staff_members: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          email: string;
          display_name: string;
        }[];
      };
      list_submissions: {
        Args: {
          _filters?: Json;
          _sort?: Json;
          _cursor?: Json | null;
          _limit?: number;
        };
        Returns: Json;
      };
      public_ledger: {
        Args: { _limit?: number };
        Returns: {
          reference_code: string;
          donor_display: string;
          amount: number;
          currency: string;
          method: Database["public"]["Enums"]["donation_method"];
          message: string | null;
          beneficiary_code: string | null;
          created_at: string;
        }[];
      };
      queue_position: {
        Args: { _request_id: string };
        Returns: Json;
      };
      recent_donation_messages: {
        Args: { _limit?: number };
        Returns: {
          donor_display: string;
          message: string | null;
        }[];
      };
      save_public_site_config: {
        Args: { _config: Json };
        Returns: number;
      };
      save_scoring_config: {
        Args: { _rules: Json };
        Returns: Json;
      };
      track_request: {
        Args: { _code: string; _phone: string };
        Returns: {
          reference_code: string;
          full_name: string;
          phone_masked: string;
          governorate: string | null;
          district: string | null;
          town: string | null;
          family_size: number;
          status: Database["public"]["Enums"]["request_status"];
          distribution_date: string | null;
          distribution_location: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      track_queue_position: {
        Args: { _code: string; _phone: string };
        Returns: Json;
      };
      track_request_history: {
        Args: { _code: string; _phone: string };
        Returns: {
          to_status: Database["public"]["Enums"]["request_status"];
          changed_at: string;
        }[];
      };
      verify_distribution_pin: {
        Args: { _request_id: string; _pin: string };
        Returns: Json;
      };
      verify_phone_otp: {
        Args: { _phone: string; _code: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "reviewer" | "distributor" | "viewer";
      distribution_status: "scheduled" | "in_progress" | "completed" | "cancelled";
      donation_method:
        | "whish"
        | "omt"
        | "moneygram"
        | "western_union"
        | "paypal"
        | "taptap"
        | "bank_transfer"
        | "other";
      donation_status: "pending" | "verified" | "rejected" | "refunded";
      reference_contact_result:
        | "pending"
        | "confirmed"
        | "denied"
        | "unreachable"
        | "no_answer"
        | "wrong_number";
      request_status:
        | "submitted"
        | "reviewing"
        | "verifying"
        | "approved"
        | "distributed"
        | "rejected"
        | "on_hold";
      risk_level: "low" | "medium" | "high" | "critical" | "fraud";
      urgency_tier: "critical" | "high" | "medium" | "low";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    ? (PublicSchema["Tables"] & PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
