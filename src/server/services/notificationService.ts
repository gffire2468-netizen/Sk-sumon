import crypto from 'crypto';
import { db } from '../db/database';
import { AppNotification, NotificationType } from '../types';

export class NotificationService {
  public static async createNotification(params: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
  }): Promise<AppNotification> {
    const notif: AppNotification = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    return await db.createNotification(notif);
  }

  public static async getUserNotifications(userId: string) {
    const list = await db.getNotificationsByUserId(userId);
    const unreadCount = list.filter((n) => !n.is_read).length;
    return { notifications: list, unreadCount };
  }

  public static async markAsRead(id: string, userId: string): Promise<boolean> {
    return await db.markNotificationAsRead(id, userId);
  }

  public static async markAllAsRead(userId: string): Promise<void> {
    await db.markAllNotificationsAsRead(userId);
  }
}
