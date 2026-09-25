const express = require('express');
const db = require('../db');

const router = express.Router();

const seedConversations = [
  { name: 'Iringa Women Farmers', role: 'Group', preview: 'Sawa! I will be there on Friday.', time_label: '10:45 AM', icon: 'group' },
  { name: 'Dr. Richard Mgata', role: 'Expert', preview: 'The soil analysis reports are ready.', time_label: 'Yesterday', avatar_url: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=120&q=80' },
  { name: 'Samuel Banda', role: 'Transporter', preview: 'I am arriving at the depot in 30 mins.', time_label: 'Monday', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80' },
  { name: 'AgriSeeds Iringa', role: 'Shop', preview: 'Your maize seeds order is confirmed.', time_label: 'Feb 12', icon: 'storefront' },
];

async function seedIfEmpty() {
  const existing = await db('community_conversations').select('conversation_id').limit(1);
  if (existing.length) return;

  const inserted = [];
  for (const conversation of seedConversations) {
    const [row] = await db('community_conversations').insert(conversation).returning('*');
    inserted.push(row);
  }

  await db('community_messages').insert([
    { conversation_id: inserted[0].conversation_id, author: 'Grace', author_avatar_url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80', body: 'Habari! The collective fertilizer order is ready for pickup.', incoming: true },
    { conversation_id: inserted[0].conversation_id, author: 'You', body: 'Sawa! I will be there on Friday.', incoming: false },
    { conversation_id: inserted[0].conversation_id, author: 'Grace', author_avatar_url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=80', body: 'Attached: Stock_Receipt.jpg', image_url: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=900&q=85', incoming: true },
    { conversation_id: inserted[1].conversation_id, author: 'Dr. Richard Mgata', author_avatar_url: seedConversations[1].avatar_url, body: seedConversations[1].preview, incoming: true },
    { conversation_id: inserted[2].conversation_id, author: 'Samuel Banda', author_avatar_url: seedConversations[2].avatar_url, body: seedConversations[2].preview, incoming: true },
    { conversation_id: inserted[3].conversation_id, author: 'AgriSeeds Iringa', body: seedConversations[3].preview, incoming: true },
  ]);
}

function serializeConversation(row, messages) {
  return {
    id: row.conversation_id,
    name: row.name,
    role: row.role,
    time: row.time_label,
    preview: row.preview,
    avatar: row.avatar_url || null,
    icon: row.icon || 'person',
    messages: messages.map((message) => ({
      id: message.message_id,
      author: message.author,
      time: message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
      body: message.body,
      incoming: message.incoming,
      avatar: message.author_avatar_url || undefined,
      image: message.image_url || undefined,
      attachmentName: message.attachment_name || undefined,
      attachmentPreview: message.attachment_url || undefined,
      attachmentKind: message.attachment_kind || undefined,
      location: message.location_label ? {
        latitude: message.location_latitude,
        longitude: message.location_longitude,
        label: message.location_label,
      } : undefined,
    })),
  };
}

router.get('/conversations', async (req, res) => {
  try {
    await seedIfEmpty();
    const conversations = await db('community_conversations').select('*').orderBy('created_at');
    const messages = await db('community_messages').select('*').orderBy('created_at');
    res.json({ conversations: conversations.map((row) => serializeConversation(row, messages.filter((message) => message.conversation_id === row.conversation_id)) ) });
  } catch (error) {
    console.error('CommunityController.list', error);
    res.status(500).json({ error: 'db_error' });
  }
});

router.post('/conversations/:conversationId/messages', async (req, res) => {
  const { conversationId } = req.params;
  const { author = 'You', body, attachmentName, attachmentUrl, attachmentKind, imageUrl, location } = req.body;
  if (!body && !attachmentName) return res.status(400).json({ error: 'message_body_required' });

  try {
    const [message] = await db('community_messages').insert({
      conversation_id: conversationId,
      author,
      body: body || `Attached: ${attachmentName}`,
      attachment_name: attachmentName || null,
      attachment_url: attachmentUrl || null,
      attachment_kind: attachmentKind || null,
      image_url: imageUrl || null,
      location_latitude: location?.latitude || null,
      location_longitude: location?.longitude || null,
      location_label: location?.label || null,
      incoming: false,
    }).returning('*');
    await db('community_conversations').where({ conversation_id: conversationId }).update({
      preview: message.body,
      time_label: new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      updated_at: db.fn.now(),
    });
    res.status(201).json(serializeConversation({ conversation_id: conversationId }, [message]).messages[0]);
  } catch (error) {
    console.error('CommunityController.createMessage', error);
    res.status(500).json({ error: 'db_error' });
  }
});

module.exports = router;