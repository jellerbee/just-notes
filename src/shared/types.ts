export type UUID = string;

export interface NoteRow {
  id: UUID;
  path: string;      // absolute path
  title: string;
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
}

export interface BlockRow {
  id: UUID;
  note_id: UUID;
  parent_block_id: UUID | null;
  order_in_parent: number;
  depth: number;
  text_md: string;
  text_plain: string;
}

export interface LinkRow {
  id?: number;
  src_block_id: UUID;
  target: string;
  kind: 'wikilink' | 'url';
}

export interface TagRow {
  id?: number;
  block_id: UUID;
  tag_text: string;
}

export interface TaskRow {
  id?: number;
  block_id: UUID;
  state: 'TODO' | 'DOING' | 'DONE';
  due?: string | null;
  priority?: 'A' | 'B' | 'C' | null;
}