import { useEffect, useState } from 'react';
import { api } from './api';

const dateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function AppAIChats() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ members: [], total: 0, totalPages: 0 });
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [member, setMember] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');
  const limit = 20;

  async function loadMembers(nextPage = page, nextSearch = search) {
    setLoading(true); setError('');
    try {
      const response = await api.getAIChatMembers({ page: nextPage, limit, search: nextSearch });
      setList(response);
      const exists = response.members?.some((item) => item.patientId === selectedMemberId);
      if (!selectedMemberId || !exists) setSelectedMemberId(response.members?.[0]?.patientId || '');
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }

  async function loadMember(patientId) {
    if (!patientId) { setMember(null); setMessages([]); return; }
    setDetailLoading(true); setError('');
    try {
      const response = await api.getAIChatMember(patientId);
      setMember(response);
      setSelectedConversationId(response.conversations?.[0]?.id || '');
    } catch (loadError) { setError(loadError.message); setMember(null); setMessages([]); }
    finally { setDetailLoading(false); }
  }

  async function loadMessages(conversationId) {
    if (!conversationId) { setMessages([]); return; }
    setMessagesLoading(true); setError('');
    try { setMessages((await api.getAIChatMessages(conversationId)).messages || []); }
    catch (loadError) { setError(loadError.message); setMessages([]); }
    finally { setMessagesLoading(false); }
  }

  useEffect(() => { const timer = setTimeout(() => { setPage(1); loadMembers(1, search); }, 280); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { loadMember(selectedMemberId); }, [selectedMemberId]);
  useEffect(() => { loadMessages(selectedConversationId); }, [selectedConversationId]);

  const selectedConversation = member?.conversations?.find((item) => item.id === selectedConversationId);

  return <div className="app-ai-chat-page">
    <section className="app-chat-notice"><div><span>MOBILE APP ONLY</span><strong>Authenticated member conversations</strong><p>Website chatbot conversations are stored separately and never appear in this section.</p></div><b>{list.total}</b></section>
    {error ? <div className="error-banner"><strong>Could not load app chats.</strong><span>{error}</span><button onClick={() => loadMembers()}>Try again</button></div> : null}
    <section className="app-chat-layout">
      <aside className="panel app-chat-members">
        <header><div><small>MEMBERS</small><h3>App chat users</h3></div><span>{list.total}</span></header>
        <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or mobile..."/></label>
        <div className="app-chat-member-list">{loading ? [...Array(6)].map((_, index) => <div className="app-chat-skeleton" key={index}/>) : list.members.map((item) => <button key={item.patientId} className={selectedMemberId === item.patientId ? 'selected' : ''} onClick={() => setSelectedMemberId(item.patientId)}><i>{item.name?.slice(0, 1).toUpperCase() || '?'}</i><div><strong>{item.name}</strong><span>{item.phone || 'Phone unavailable'}</span><small>{item.conversationCount} conversation{item.conversationCount === 1 ? '' : 's'} · {dateTime(item.latestMessageAt)}</small></div><b>›</b></button>)}{!loading && !list.members.length ? <p className="app-chat-empty">No stored mobile app AI chats match your search.</p> : null}</div>
        <footer><button disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); loadMembers(next); }}>←</button><span>Page {page} of {Math.max(1, list.totalPages)}</span><button disabled={page >= list.totalPages} onClick={() => { const next = page + 1; setPage(next); loadMembers(next); }}>→</button></footer>
      </aside>
      <main className="panel app-chat-detail">
        {detailLoading ? <div className="app-chat-placeholder">Loading conversations…</div> : !member ? <div className="app-chat-placeholder"><strong>Select a member</strong><p>Choose a mobile app user to inspect their AI conversations.</p></div> : <>
          <header className="app-chat-user-header"><div><small>MOBILE MEMBER</small><h3>{member.user.name}</h3><p>{member.user.phone || 'Phone unavailable'}</p></div><span>{member.conversations.length} conversations</span></header>
          <div className="app-chat-content">
            <aside className="app-chat-conversations">{member.conversations.map((item) => <button key={item.id} className={selectedConversationId === item.id ? 'selected' : ''} onClick={() => setSelectedConversationId(item.id)}><strong>{item.title}</strong><span>{item.messageCount} messages</span><small>{dateTime(item.lastMessageAt)}</small></button>)}{!member.conversations.length ? <p className="app-chat-empty">No retained conversations.</p> : null}</aside>
            <section className="app-chat-thread">
              <header><div><strong>{selectedConversation?.title || 'Conversation'}</strong><span>{selectedConversation ? `${selectedConversation.language?.toUpperCase()} · retained until ${dateTime(selectedConversation.expiresAt)}` : ''}</span></div></header>
              <div className="app-chat-messages">{messagesLoading ? <div className="app-chat-placeholder">Loading messages…</div> : messages.map((message) => <article key={message.id} className={message.role === 'user' ? 'member-message' : 'assistant-message'}><div><strong>{message.role === 'user' ? member.user.name : 'Muditam AI'}</strong><time>{dateTime(message.createdAt)}</time></div><p>{message.content}</p>{message.role === 'assistant' && message.category ? <small>{message.category.replaceAll('_', ' ')}</small> : null}</article>)}{!messagesLoading && selectedConversationId && !messages.length ? <p className="app-chat-empty">No retained messages in this conversation.</p> : null}</div>
            </section>
          </div>
        </>}
      </main>
    </section>
  </div>;
}
