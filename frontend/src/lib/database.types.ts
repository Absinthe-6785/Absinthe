export type Database = {
  public: {
    Tables: {
      routines: {
        Row: {
          id: string;
          user_id: string;
          text: string;
          created_at: string;
          deleted_at: string | null;
          created_timestamp: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          text: string;
          created_at?: string;
          deleted_at?: string | null;
          created_timestamp?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          text?: string;
          created_at?: string;
          deleted_at?: string | null;
          created_timestamp?: string;
        };
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          text: string;
          done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          text: string;
          done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          text?: string;
          done?: boolean;
          created_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string;
          text: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string;
          text: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          text?: string;
          color?: string;
          created_at?: string;
        };
      };
      memos: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          content: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          content?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          content?: string;
          updated_at?: string;
        };
      };
      routine_status: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          routine_id: string;
          completed: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          routine_id: string;
          completed?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          routine_id?: string;
          completed?: boolean;
        };
      };
    };
  };
};
