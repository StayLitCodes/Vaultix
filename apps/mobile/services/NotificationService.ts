export interface NotificationItem {
  id: string;
  type: 'ESCROW_CREATED' | 'ESCROW_FUNDED' | 'MILESTONE_APPROVED' | 'DISPUTE_OPENED' | 'DISPUTE_RESOLVED' | 'PAYMENT_RELEASED';
  message: string;
  isRead: boolean;
  createdAt: string;
}

export class NotificationService {
  // Stubbed for MVP
  static async fetchNotifications(): Promise<NotificationItem[]> {
    return [
      {
        id: '1',
        type: 'ESCROW_CREATED',
        message: 'A new escrow was created for "Web Development".',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'DISPUTE_OPENED',
        message: 'A dispute was opened for "Mobile App Design".',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  static async markAsRead(id: string): Promise<boolean> {
    // API call stub
    return true;
  }

  static async markAllAsRead(): Promise<boolean> {
    // API call stub
    return true;
  }
}
