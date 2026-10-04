import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { HelpCircle, ArrowLeft, Send, Plus, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { SupportTicketItem, SupportMessageItem } from '../types';

export const SupportView: React.FC = () => {
  const { setActiveTab, showToast } = useApp();
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketItem | null>(null);
  const [messages, setMessages] = useState<SupportMessageItem[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState<'MINING' | 'WITHDRAWAL' | 'REFERRAL' | 'ACCOUNT' | 'OTHER'>('MINING');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const list = await api.getSupportTickets();
      setTickets(list);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openTicket = async (ticket: SupportTicketItem) => {
    setSelectedTicket(ticket);
    try {
      const data = await api.getSupportTicketDetails(ticket.id);
      setMessages(data.messages);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createSupportTicket(newCategory, newSubject, newMessage);
      showToast('Support ticket created successfully', 'success');
      setIsCreating(false);
      setNewSubject('');
      setNewMessage('');
      await fetchTickets();
    } catch (err: any) {
      showToast(err.message || 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setSubmitting(true);
    try {
      const msg = await api.replyToSupportTicket(selectedTicket.id, replyText);
      setMessages((prev) => [...prev, msg]);
      setReplyText('');
      showToast('Reply sent', 'success');
      await fetchTickets();
    } catch (err: any) {
      showToast(err.message || 'Failed to send reply', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24 px-4 pt-2 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        <button
          onClick={() => {
            if (selectedTicket || isCreating) {
              setSelectedTicket(null);
              setIsCreating(false);
            } else {
              setActiveTab('mining');
            }
          }}
          className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-['Chakra_Petch'] font-bold text-xl text-white">
          {selectedTicket ? 'TICKET CHAT' : isCreating ? 'NEW TICKET' : 'SUPPORT DESK'}
        </h2>
      </div>

      {/* Ticket Details / Chat View */}
      {selectedTicket ? (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-gray-900/80 border border-gray-800 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white text-sm">{selectedTicket.subject}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  selectedTicket.status === 'RESOLVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {selectedTicket.status}
              </span>
            </div>
            <div className="text-slate-400 text-[10px]">
              Category: {selectedTicket.category} • Created: {new Date(selectedTicket.created_at).toLocaleString()}
            </div>
          </div>

          {/* Messages list */}
          <div className="rounded-3xl bg-gray-950/80 border border-gray-800 p-4 space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto">
            {messages.map((m) => {
              const isAdmin = m.sender_type === 'ADMIN';
              return (
                <div key={m.id} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}>
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs font-mono ${
                      isAdmin
                        ? 'bg-gray-900 text-slate-200 border border-emerald-500/30 rounded-tl-sm'
                        : 'bg-emerald-600 text-black font-medium rounded-tr-sm'
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-75 mb-1">
                      {isAdmin ? '🛡️ Support Team' : 'You'}
                    </div>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <div className="text-[9px] opacity-60 mt-1 text-right">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Input Form */}
          {selectedTicket.status !== 'CLOSED' ? (
            <form onSubmit={handleSendReply} className="flex space-x-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/60"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="p-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-bold transition-all active:scale-95 shadow-[0_0_10px_#10b981]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-gray-900 text-center text-xs font-mono text-slate-500">
              This ticket has been marked as closed.
            </div>
          )}
        </div>
      ) : isCreating ? (
        /* Create New Ticket Form */
        <form onSubmit={handleCreateTicket} className="rounded-3xl bg-gray-900/70 border border-gray-800 p-5 space-y-4">
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1 uppercase">Category</label>
            <select
              value={newCategory}
              onChange={(e: any) => setNewCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/60"
            >
              <option value="MINING">Mining & Energy Issue</option>
              <option value="WITHDRAWAL">Withdrawal & Payment Issue</option>
              <option value="REFERRAL">Referral Verification Issue</option>
              <option value="ACCOUNT">Account Security Issue</option>
              <option value="OTHER">Other Inquiry</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1 uppercase">Subject</label>
            <input
              type="text"
              placeholder="Brief summary of your inquiry"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/60"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1 uppercase">Message</label>
            <textarea
              rows={4}
              placeholder="Describe your issue in detail..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/60"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="py-3 rounded-xl bg-gray-800 text-slate-300 font-mono text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-black font-['Chakra_Petch'] font-bold text-xs shadow-[0_0_12px_#10b981]"
            >
              {submitting ? 'Submitting...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      ) : (
        /* Ticket List */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">MY TICKETS ({tickets.length})</span>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-['Chakra_Petch'] font-bold hover:bg-emerald-500/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>NEW TICKET</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="rounded-3xl bg-gray-900/50 border border-gray-800 p-8 text-center text-slate-500 text-xs font-mono">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              No support tickets yet. Have a question or need assistance? Click New Ticket above.
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className="p-4 rounded-2xl bg-gray-900/70 border border-gray-800 hover:border-emerald-500/40 cursor-pointer transition-all active:scale-98 font-mono text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white truncate max-w-[200px]">{t.subject}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        t.status === 'RESOLVED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{t.category}</span>
                    <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
