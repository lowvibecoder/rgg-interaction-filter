export interface RggRecipient {
  _id: string;
  displayName: string;
  login: string;
}

export interface RggSender {
  displayName: string;
  login: string;
  _id: string;
}

export interface RggReaction {
  tag: string;
  users: Array<{ name: string; reactedAt: string }>;
}

export interface RggInteraction {
  dateAdded: number;
  reactions: RggReaction[];
  recipients: RggRecipient[];
  sender: RggSender;
  text: string;
  _id: string;
}

export interface ParsedInteraction {
  id: string;
  dateAdded: number;
  senderName: string;
  senderLogin: string;
  actionType: string;
  note: string;
  rawText: string;
  recipients: Array<{
    recipientName: string;
    recipientLogin: string;
  }>;
}

export interface InteractionRow {
  id: string;
  date_added: number;
  sender_name: string;
  sender_login: string;
  action_type: string;
  note: string;
  raw_text: string;
  fetched_at: string;
}

export interface RecipientRow {
  interaction_id: string;
  recipient_name: string;
  recipient_login: string;
}

export interface InteractionsQuery {
  dateFrom?: string;
  dateTo?: string;
  sender?: string;
  recipient?: string;
  action?: string;
  note?: string;
  page?: number;
  pageSize?: number;
}

export interface ParsedInteractionWithRecipients extends InteractionRow {
  recipients: { recipient_name: string; recipient_login: string }[];
}
