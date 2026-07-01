import React, { useState, useEffect, useRef } from 'react';
import { Tenant, Property, PaymentRecord } from '../types';
import { formatCurrency, formatDate, getTenantBillingDetails } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Sparkles, AlertCircle, FileText, Check, DollarSign } from 'lucide-react';

interface AIAssistantProps {
  tenants: Tenant[];
  properties: Property[];
  history: any[];
  activeMonth?: string;
  updateTenant: (id: string, updates: Partial<Tenant>) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  type?: 'text' | 'receipt' | 'alert';
  data?: any; // For rendering custom cards
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ 
  tenants, 
  properties, 
  history, 
  activeMonth = 'Current Cycle',
  updateTenant 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Proactive check on load - notify if any tenant has outstanding dues
  useEffect(() => {
    // Initial greetings
    setMessages([
      {
        id: 'initial',
        sender: 'assistant',
        text: `Welcome to the luxury sanctuary of TenantBilling Elite™. I am Aurelia, your elite architectural concierge. I stand ready to answer your natural queries about tenant accounts, outstanding balances, utility breakdowns, or to display exquisite statements. Let me know which records you wish to illuminate today.`,
        timestamp: Date.now()
      }
    ]);

    // Check for overdue bills after 3 seconds
    const timer = setTimeout(() => {
      const unpaidCount = tenants.filter(t => {
        const prop = properties.find(p => p.id === t.propertyId);
        if (!prop) return false;
        const billing = getTenantBillingDetails(t, prop);
        return billing.outstandingBalance > 0;
      }).length;

      if (unpaidCount > 0) {
        setNotificationCount(unpaidCount);
        // Show inline proactive advice if chat is open, or cache it
        setMessages(prev => [
          ...prev,
          {
            id: 'alert-overdue',
            sender: 'assistant',
            text: `✨ CONCIERGE ALERT: I have scanned the live accounts and detected ${unpaidCount} tenants with outstanding dues in the ${activeMonth}. You can ask me "Who has overdue bills?" to retrieve their direct details.`,
            timestamp: Date.now()
          }
        ]);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [tenants, properties, activeMonth]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          tenants,
          properties,
          history
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.error === 'AI_KEY_MISSING') {
        const localResponse = processQuery(userText);
        setMessages(prev => [...prev, {
          ...localResponse,
          text: `[Offline Mode] ${localResponse.text}`
        }]);
      } else if (responseData.text) {
        let finalType: 'text' | 'receipt' | 'alert' = 'text';
        let finalData: any = null;

        if (responseData.receiptTenantId) {
          const tenantId = responseData.receiptTenantId;
          const tenant = tenants.find(t => t.id === tenantId);
          if (tenant) {
            const property = properties.find(p => p.id === tenant.propertyId);
            if (property) {
              finalType = 'receipt';
              finalData = { tenant, property };
            }
          }
        }

        const assistantMsg: Message = {
          id: Math.random().toString(),
          sender: 'assistant',
          text: responseData.text,
          timestamp: Date.now(),
          type: finalType,
          data: finalData
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err) {
      console.error('[Rentflo AI] Backend call failed, using local fallback:', err);
      const localResponse = processQuery(userText);
      setMessages(prev => [...prev, localResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  // Sentient NLP-like query analyzer
  const processQuery = (query: string): Message => {
    const q = query.toLowerCase();
    
    // 1. Identify specific tenant if mentioned in message
    let matchedTenant: Tenant | undefined;
    let matchedProp: Property | undefined;

    for (const t of tenants) {
      const tName = t.name.toLowerCase();
      // Match full or first name if distinct
      if (tName.length > 2 && (q.includes(tName) || q.includes(t.roomNumber.toLowerCase()) || q.includes(`room ${t.roomNumber.toLowerCase()}`))) {
        matchedTenant = t;
        matchedProp = properties.find(p => p.id === t.propertyId);
        break;
      }
    }

    // Helper functions for math summaries
    const getSummaryStats = () => {
      let totalDueAll = 0;
      let totalPaidAll = 0;
      let totalOutAll = 0;
      const unpaidTenantsList: string[] = [];

      tenants.forEach(t => {
        const prop = properties.find(p => p.id === t.propertyId);
        if (prop) {
          const billing = getTenantBillingDetails(t, prop);
          totalDueAll += billing.totalDue;
          totalPaidAll += billing.paidAmount;
          totalOutAll += billing.outstandingBalance;
          if (billing.outstandingBalance > 0) {
            unpaidTenantsList.push(`${t.name} (Rm ${t.roomNumber}): ${formatCurrency(billing.outstandingBalance)}`);
          }
        }
      });
      return { totalDueAll, totalPaidAll, totalOutAll, unpaidTenantsList };
    };

    // INTENT 1: Greetings & Concierge Identity
    if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('greetings') || q.includes('support') || q.includes('who are you') || q.includes('is anyone there')) {
      return {
        id: Math.random().toString(),
        sender: 'assistant',
        text: `Salutations. I am Aurelia, your elite TenantBilling concierge. I am fluent in your lease parameters, utility meters, and financial sub-ledgers. How may I serve your administrative elegance today?`,
        timestamp: Date.now()
      };
    }

    // INTENT 2: Overdue / Outstanding list query
    if (q.includes('unpaid') || q.includes('due') || q.includes('overdue') || q.includes('outstanding') || q.includes('arrears') || q.includes('owe') || q.includes('pending')) {
      const { unpaidTenantsList, totalOutAll } = getSummaryStats();
      if (unpaidTenantsList.length === 0) {
        return {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `Exceptional news! Every account matches our ideal parameters: 100% of tenants have cleared their dues. The balance remaining is ₹0.00.`,
          timestamp: Date.now()
        };
      } else {
        return {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `I have extracted the live arrear statistics for ${activeMonth}. There are currently ${unpaidTenantsList.length} accounts reflecting outstanding balances, accumulating to a total of ${formatCurrency(totalOutAll)}: \n\n${unpaidTenantsList.map(item => `• ${item}`).join('\n')}\n\nYou can ask me "Show receipt for [Tenant Name]" to inspect or capture any statement.`,
          timestamp: Date.now()
        };
      }
    }

    // INTENT 3: Aggregate financial summary
    if (q.includes('total') || q.includes('summary') || q.includes('aggregate') || q.includes('financial') || q.includes('revenue') || q.includes('stats')) {
      const { totalDueAll, totalPaidAll, totalOutAll } = getSummaryStats();
      const collectionRate = totalDueAll > 0 ? ((totalPaidAll / totalDueAll) * 100).toFixed(1) : '100';
      return {
        id: Math.random().toString(),
        sender: 'assistant',
        text: `Here is the premium financial overview for ${activeMonth}:\n\n` +
              `• **Rent & Utilities Aggregate:** ${formatCurrency(totalDueAll)}\n` +
              `• **Payments Settled:** ${formatCurrency(totalPaidAll)} (${collectionRate}% Collection Rate)\n` +
              `• **Arrears Outstanding:** ${formatCurrency(totalOutAll)}\n\n` +
              `All calculation models carry forward true credits seamlessly, protecting your property's net yields.`,
        timestamp: Date.now()
      };
    }

    // INTENT 4: Handle specific tenant queries
    if (matchedTenant && matchedProp) {
      const billing = getTenantBillingDetails(matchedTenant, matchedProp);
      
      // If asking for a direct receipt/statement rendering
      if (q.includes('receipt') || q.includes('invoice') || q.includes('statement') || q.includes('show') || q.includes('view') || q.includes('print')) {
        return {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `I have generated and illuminated the luxurious digital statement for **${matchedTenant.name} (Room ${matchedTenant.roomNumber})**:`,
          timestamp: Date.now(),
          type: 'receipt',
          data: { tenant: matchedTenant, property: matchedProp }
        };
      }

      // If asking for bill explaining or breakdown
      if (q.includes('why') || q.includes('explain') || q.includes('breakdown') || q.includes('how did') || q.includes('calculation')) {
        return {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `Let us carefully trace the architectural breakdown for **${matchedTenant.name}** in room **${matchedTenant.roomNumber}**:\n\n` +
                `1. **Core Placement (Rent):** ${formatCurrency(billing.baseRent)}\n` +
                `2. **Maintenance Overlay:** ${formatCurrency(billing.otherFees)}\n` +
                `3. **Electricity Draft:** ${formatCurrency(billing.electricityCharges)} (${billing.elecUnits} units consumed at ${formatCurrency(matchedProp.electricRate)} per unit)\n` +
                `4. **Water Draft:** ${formatCurrency(billing.waterCharges)} (${billing.waterUnits} units consumed at ${formatCurrency(matchedProp.waterRate)} per unit)\n` +
                `5. **Balance Forward:** ${formatCurrency(billing.openingBalance)} (unpaid balances/credits carried from previous cycle)\n` +
                `────────────────────\n` +
                `• **Invoice Total:** ${formatCurrency(billing.totalDue)}\n` +
                `• **Settlements Applied:** ${formatCurrency(billing.paidAmount)}\n` +
                `• **Closing Balance:** ${formatCurrency(billing.outstandingBalance > 0 ? billing.outstandingBalance : 0)}` + 
                `${billing.outstandingBalance < 0 ? ` (Excess credit of ${formatCurrency(Math.abs(billing.outstandingBalance))} is securely locked and ready for rollover)` : ''}`,
          timestamp: Date.now()
        };
      }

      // If utility-specific query (Electricity)
      if (q.includes('electricity') || q.includes('elec') || q.includes('meter') || q.includes('power')) {
        return {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `**${matchedTenant.name} (Room ${matchedTenant.roomNumber})** has dynamic electricity parameters:\n` +
                `• Current Reading: **${matchedTenant.currElecReading}**\n` +
                `• Previous Reading: **${matchedTenant.prevElecReading}**\n` +
                `• Consumed: **${billing.elecUnits} Units**\n` +
                `• Charge: **${formatCurrency(billing.electricityCharges)}** (@ ${formatCurrency(matchedProp.electricRate)}/Unit)`,
          timestamp: Date.now()
        };
      }

      // If utility-specific query (Water)
      if (q.includes('water') || q.includes('flow') || q.includes('liquid')) {
        return {
          id: Math.random().toString(),
          sender: 'assistant',
          text: `**${matchedTenant.name} (Room ${matchedTenant.roomNumber})** has water parameters:\n` +
                `• Current Reading: **${matchedTenant.currWaterReading}**\n` +
                `• Previous Reading: **${matchedTenant.prevWaterReading}**\n` +
                `• Consumed: **${billing.waterUnits} Units**\n` +
                `• Charge: **${formatCurrency(billing.waterCharges)}** (@ ${formatCurrency(matchedProp.waterRate)}/Unit)`,
          timestamp: Date.now()
        };
      }

      // General tenant status response
      const statusIcon = billing.outstandingBalance <= 0 ? 'PAID ✅' : 'PENDING ⏳';
      return {
        id: Math.random().toString(),
        sender: 'assistant',
        text: `I have compiled the active ledger profile for **${matchedTenant.name} (Room ${matchedTenant.roomNumber})**:\n\n` +
              `• **Billing Status:** ${statusIcon}\n` +
              `• **Rent Fee:** ${formatCurrency(billing.baseRent)}\n` +
              `• **Total Charges:** ${formatCurrency(billing.totalDue)}\n` +
              `• **Paid This Cycle:** ${formatCurrency(billing.paidAmount)}\n` +
              `• **Balance Due:** ${formatCurrency(billing.outstandingBalance > 0 ? billing.outstandingBalance : 0)}\n` +
              `${billing.outstandingBalance < 0 ? `• **Account Credit:** ${formatCurrency(Math.abs(billing.outstandingBalance))} (to roll forward)\n` : ''}` + 
              `\nWould you like me to render the formal "receipt" statement for them?`,
        timestamp: Date.now()
      };
    }

    // Default fallback
    return {
      id: Math.random().toString(),
      sender: 'assistant',
      text: `I apologize, but my architectural context could not match that exact request. You may ask me:\n` +
            `• "Who has overdue bills?"\n` +
            `• "Provide a total financial summary"\n` +
            `• "Explain Sita's charges"\n` +
            `• "Show the receipt for Room 102"\n` +
            `• "What is Amit's water consumption?"`,
      timestamp: Date.now()
    };
  };

  // Mini Receipt Component for chat bubble rendering
  const MiniReceiptCard: React.FC<{ tenant: Tenant, property: Property }> = ({ tenant, property }) => {
    const billing = getTenantBillingDetails(tenant, property);
    return (
      <div className="bg-slate-900 text-white p-4 rounded-xl border border-white/5 max-w-full text-xs font-sans shadow-md my-2 space-y-3">
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <div className="flex items-center gap-1">
            <span className="font-sans font-extrabold text-white tracking-wide uppercase">Rental Statement</span>
          </div>
          <span className="text-[9px] font-bold uppercase text-white font-mono">Aurelia Render</span>
        </div>

        <div className="space-y-1">
          <p className="font-sans font-bold text-sm text-white">{tenant.name}</p>
          <p className="text-[10px] text-slate-400">Room {tenant.roomNumber} &bull; {property.name}</p>
        </div>

        <div className="space-y-1 border-t border-b border-dashed border-white/5 py-2 font-mono text-slate-300">
          <div className="flex justify-between">
            <span>Rent</span>
            <span>{formatCurrency(billing.baseRent)}</span>
          </div>
          <div className="flex justify-between">
            <span>Maintenance</span>
            <span>{formatCurrency(billing.otherFees)}</span>
          </div>
          <div className="flex justify-between">
            <span>Electricity ({billing.elecUnits} U)</span>
            <span>{formatCurrency(billing.electricityCharges)}</span>
          </div>
          <div className="flex justify-between">
            <span>Water ({billing.waterUnits} U)</span>
            <span>{formatCurrency(billing.waterCharges)}</span>
          </div>
          {billing.openingBalance !== 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Balance Forward</span>
              <span>{formatCurrency(billing.openingBalance)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-white/5 pt-1 text-white">
            <span>Total Dues</span>
            <span>{formatCurrency(billing.totalDue)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-lg font-sans">
          <span className="font-sans font-bold text-[9px] uppercase text-slate-500">Balance Remaining</span>
          <span className="font-bold text-sm tracking-tight" style={{ color: billing.outstandingBalance <= 0 ? '#10B981' : '#FFFFFF' }}>
            {formatCurrency(billing.outstandingBalance)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Activation Ring (Always Floating on Bottom Right) */}
      <div className="fixed bottom-28 md:bottom-28 right-6 z-50">
        <button
          id="assistant-trigger"
          onClick={() => {
            setIsOpen(prev => !prev);
            setNotificationCount(0); // clear count on open
          }}
          className="relative w-14 h-14 rounded-full bg-slate-950 backdrop-blur-md flex items-center justify-center text-white shadow-[0_8px_24px_rgba(255,255,255,0.1)] border border-white/40 hover:scale-110 active:scale-95 transition-all outline-none"
        >
          {isOpen ? (
            <X className="w-6 h-6 animate-spin-once" />
          ) : (
            <Sparkles className="w-6 h-6 animate-pulse" />
          )}

          {/* Luminous Pulsing Ring Effect */}
          <span className="absolute -inset-1 rounded-full border border-white/20 animate-ping opacity-75 pointer-events-none" />

          {/* Proactive Notification Badge */}
          {notificationCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
              {notificationCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded Obsidian Luxury Glass Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-40 md:bottom-28 right-6 w-[360px] max-w-[calc(100vw-2rem)] h-[70vh] max-h-[600px] bg-slate-950/95 backdrop-blur-lg rounded-3xl flex flex-col overflow-hidden z-50 border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            {/* Elegant Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-sans font-black text-white text-sm tracking-tight leading-none flex items-center gap-1 uppercase">
                    Aurelia 
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_white]" />
                  </h4>
                  <span className="text-[9px] uppercase tracking-widest text-[#8A8D98] font-bold block mt-1">Concierge Intellect</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
               >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat History Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/20">
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`flex flex-col max-w-[85%] ${m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div 
                    className={`px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      m.sender === 'user' 
                        ? 'bg-white/10 text-white rounded-tr-none border border-white/20' 
                        : 'bg-white/[0.03] text-slate-200 rounded-tl-none border border-white/5'
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    
                    {/* Render Spec-aligned Inline Receipt if matches query */}
                    {m.type === 'receipt' && m.data && (
                      <MiniReceiptCard tenant={m.data.tenant} property={m.data.property} />
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="mr-auto flex flex-col items-start max-w-[80%]">
                  <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white/[0.02] text-xs border border-white/5">
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Control Input form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-slate-900/40">
              <div className="relative flex items-center bg-slate-900 rounded-xl border border-white/5 focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/30 transition-all">
                <input
                  type="text"
                  placeholder="Request Aurelia's help..."
                  className="w-full bg-transparent px-4 py-3 pr-10 text-xs text-white placeholder-slate-500 outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="absolute right-2 p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
