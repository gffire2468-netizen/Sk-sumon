import crypto from 'crypto';
import { db } from '../db/database';
import { NotificationService } from './notificationService';
import { SupportTicket, SupportMessage, TicketCategory, TicketStatus } from '../types';

export class SupportService {
  public static async createTicket(params: {
    userId: string;
    category: TicketCategory;
    subject: string;
    message: string;
  }): Promise<{ ticket: SupportTicket; initialMessage: SupportMessage }> {
    const { userId, category, subject, message } = params;

    if (!subject.trim() || !message.trim()) {
      throw new Error('Subject and message cannot be empty');
    }

    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();

    const ticket: SupportTicket = {
      id: ticketId,
      user_id: userId,
      category,
      subject: subject.trim(),
      status: 'OPEN',
      created_at: now,
      updated_at: now,
    };

    const initialMessage: SupportMessage = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_type: 'USER',
      sender_id: userId,
      message: message.trim(),
      created_at: now,
    };

    await db.createSupportTicket(ticket);
    await db.createSupportMessage(initialMessage);

    return { ticket, initialMessage };
  }

  public static async getUserTickets(userId: string): Promise<SupportTicket[]> {
    return await db.getSupportTicketsByUserId(userId);
  }

  public static async getTicketDetails(ticketId: string, requestingUserId?: string, isAdmin = false) {
    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    if (!isAdmin && ticket.user_id !== requestingUserId) {
      throw new Error('Unauthorized to access this ticket');
    }

    const messages = await db.getSupportMessagesByTicketId(ticketId);

    // Hide internal notes from non-admin users
    const sanitizedTicket = { ...ticket };
    if (!isAdmin) {
      delete sanitizedTicket.internal_notes;
    }

    return { ticket: sanitizedTicket, messages };
  }

  public static async replyToTicket(params: {
    ticketId: string;
    senderType: 'USER' | 'ADMIN';
    senderId: string;
    message: string;
  }): Promise<SupportMessage> {
    const { ticketId, senderType, senderId, message } = params;

    if (!message.trim()) {
      throw new Error('Message cannot be empty');
    }

    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    if (senderType === 'USER' && ticket.user_id !== senderId) {
      throw new Error('Unauthorized');
    }

    const now = new Date().toISOString();
    const msg: SupportMessage = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_type: senderType,
      sender_id: senderId,
      message: message.trim(),
      created_at: now,
    };

    await db.createSupportMessage(msg);

    // Update ticket updated_at and status
    ticket.updated_at = now;
    if (senderType === 'ADMIN' && ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
    } else if (senderType === 'USER' && ticket.status === 'RESOLVED') {
      ticket.status = 'IN_PROGRESS';
    }
    await db.updateSupportTicket(ticket);

    if (senderType === 'ADMIN') {
      await NotificationService.createNotification({
        userId: ticket.user_id,
        title: 'Support Ticket Update',
        message: `Support team has replied to your ticket: "${ticket.subject}"`,
        type: 'SUPPORT_REPLY',
      });
    }

    return msg;
  }

  public static async updateTicketStatus(params: {
    ticketId: string;
    status: TicketStatus;
    assignedTo?: string;
    internalNotes?: string;
  }): Promise<SupportTicket> {
    const { ticketId, status, assignedTo, internalNotes } = params;
    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = status;
    if (assignedTo !== undefined) ticket.assigned_to = assignedTo;
    if (internalNotes !== undefined) ticket.internal_notes = internalNotes;
    ticket.updated_at = new Date().toISOString();

    await db.updateSupportTicket(ticket);

    if (status === 'RESOLVED') {
      await NotificationService.createNotification({
        userId: ticket.user_id,
        title: 'Support Ticket Resolved',
        message: `Your ticket "${ticket.subject}" has been marked as resolved.`,
        type: 'SUPPORT_REPLY',
      });
    }

    return ticket;
  }
}
