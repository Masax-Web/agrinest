import { useEffect, useRef, useState } from 'react';
import api from './lib/api';
import { resizeImageForUpload } from './lib/image-uploads';
import { personas } from '../shared/personas.json';
import './FloatingAgriChat.css';

const personaLabels = new Map(personas.map((persona) => [persona.id, persona.label]));

const quickQuestions = [
  'How can I check if my soil needs lime?',
  'What should I do when I find leaf damage?',
  'How can I reduce water stress?',
];

function getGuidedReply(question) {
  const text = question.toLocaleLowerCase();
  if (/\b(pest|bug|insect|worm|caterpillar|aphid|mite|disease|spot|rust|blight|yellow|leaf damage)\b/.test(text)) {
    return 'Start by checking several plants across the field, including the underside of leaves, and note how symptoms are spreading. A clear close-up photo can be sent for a Jicho crop scan. Treat a scan as an estimate: confirm the cause with a local extension officer before applying any product, and follow its label.';
  }
  if (/\b(soil|ph|lime|acid|test|compost|organic matter)\b/.test(text)) {
    return 'Soil conditions vary from field to field. Take a representative soil sample and use a laboratory result before deciding whether to lime or change fertilizer. Avoid working wet soil; adding suitable compost or retained crop residues can help maintain organic matter.';
  }
  if (/\b(water|irrigat|dry|drought|moisture|rain)\b/.test(text)) {
    return 'Check moisture in the root zone and the crop growth stage before irrigating. Water needs depend on soil, weather, and crop; avoid waterlogging and consider mulching to reduce evaporation. For a field-specific plan, share your crop, growth stage, and recent rainfall with an extension officer.';
  }
  if (/\b(fertili[sz]er|nutrient|nitrogen|manure|feed|planting)\b/.test(text)) {
    return 'Choose fertilizer based on the crop, growth stage, and preferably a soil test. Follow local extension recommendations and the product label; do not place fertilizer directly against seed or stems. If you share your crop and growth stage, I can point you to the relevant AGRI-NEST guidance.';
  }
  if (/\b(scan|photo|picture|image|diagnos|camera)\b/.test(text)) {
    return 'Attach a clear, well-lit close-up photo of the affected plant area and send it for a Jicho crop scan. The result is a model estimate, not a confirmed diagnosis; consult a qualified agronomist before choosing treatment.';
  }
  return 'I can share general guidance about crop symptoms, soil, irrigation, and fertilizer. Tell me the crop, what you observed, and when it started—or attach a clear plant photo for a Jicho scan. Guidance here is educational and is not a substitute for local extension advice.';
}

function makeChatProfile(user) {
  const persona = user?.persona_id;
  const role = user?.role || 'farmer';
  return {
    id: user?.user_id || user?.id || 'agrinest-user',
    name: user?.name || 'AGRI-NEST member',
    role: personaLabels.get(persona) || role.replace(/[_-]/g, ' '),
    avatar: user?.avatar_url || '',
    location: user?.region || 'Tanzania',
  };
}

export default function FloatingAgriChat({ user, farmerProfile, CommunityChat }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('menu');
  const [messages, setMessages] = useState([{
    id: 'jicho-welcome',
    sender: 'assistant',
    text: 'Habari! Ask me about crops, soil, pests, or water—or attach a clear crop photo for a Jicho scan.',
  }]);
  const [draft, setDraft] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const profile = makeChatProfile(user);
  const viewerProfile = {
    ...profile,
    role: profile.role.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  };

  useEffect(() => {
    if (view === 'jicho' && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, view]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const addMessage = (sender, text, image = '') => {
    setMessages((current) => [...current, {
      id: `jicho-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender,
      text,
      image,
    }]);
  };

  const handleImageChange = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    setIsPreparingImage(true);
    setError('');
    try {
      const dataUrl = await resizeImageForUpload(file);
      setSelectedImage({ name: file.name, dataUrl });
    } catch (imageError) {
      setError(imageError.message || 'Could not prepare this image. Choose a different photo.');
    } finally {
      setIsPreparingImage(false);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    const question = draft.trim();
    if ((!question && !selectedImage) || isSending || isPreparingImage) return;
    const image = selectedImage?.dataUrl || '';
    addMessage('user', question || (image ? 'Please check this crop photo.' : ''), image);
    setDraft('');
    setSelectedImage(null);
    setError('');

    if (!image) {
      addMessage('assistant', getGuidedReply(question));
      return;
    }

    setIsSending(true);
    try {
      const result = await api.diagnoseCrop({
        farmer_id: user?.user_id || '',
        image_base64: image,
        crop: 'unknown',
      });
      const confidence = Number(result.confidence);
      const confidenceText = Number.isFinite(confidence)
        ? ` Model confidence: ${(confidence * 100).toFixed(1)}%.`
        : '';
      addMessage(
        'assistant',
        `Jicho scan estimate: ${result.diagnosis || 'No diagnosis returned'}.${confidenceText} Suggested next step: ${result.recommended_treatment || 'Ask a qualified agronomist to review the crop.'} This is not a confirmed diagnosis; verify before treating.`,
      );
    } catch (scanError) {
      setError(scanError.message || 'Jicho could not analyze that photo. Check your connection and try again.');
      addMessage('assistant', 'I could not complete the photo scan. Please check your connection and try again, or ask a local extension officer to inspect the crop.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="agri-floating-chat">
      {isOpen && <section className={`agri-chat-panel${view === 'community' ? ' is-community' : ''}`} role="dialog" aria-modal="false" aria-label="AGRI-NEST community and Jicho chat">
        <header className="agri-chat-header">
          <div className="agri-chat-brand">
            <span className="agri-chat-brand-icon material-symbols-outlined">{view === 'community' ? 'groups' : 'eco'}</span>
            <span><strong>{view === 'community' ? 'Community chat' : view === 'jicho' ? 'Jicho AI' : 'AGRI-NEST Chat'}</strong><small>{view === 'jicho' ? 'Crop guidance & photo scans' : 'Community support for your farm'}</small></span>
          </div>
          <div className="agri-chat-header-actions">
            {view !== 'menu' && <button type="button" className="agri-chat-icon-button" aria-label="Back to chat options" onClick={() => setView('menu')}><span className="material-symbols-outlined">arrow_back</span></button>}
            <button type="button" className="agri-chat-icon-button" aria-label="Close chat" onClick={() => setIsOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
        </header>

        {view === 'menu' && <div className="agri-chat-choice-list">
          <p>What would you like help with?</p>
          <button type="button" className="agri-chat-choice" onClick={() => setView('community')}>
            <span className="material-symbols-outlined">forum</span><span><strong>Community chat</strong><small>Talk with farmer groups and community members</small></span><span className="material-symbols-outlined">chevron_right</span>
          </button>
          <button type="button" className="agri-chat-choice" onClick={() => setView('jicho')}>
            <span className="material-symbols-outlined">psychology</span><span><strong>Jicho AI</strong><small>Ask crop questions or scan a plant photo</small></span><span className="material-symbols-outlined">chevron_right</span>
          </button>
          <p className="agri-chat-note">Jicho text replies use curated guidance. Photo scans require the Jicho service to be enabled.</p>
        </div>}

        {view === 'community' && <div className="agri-chat-community">
          <CommunityChat
            onBackToDashboard={() => setView('menu')}
            viewerProfile={viewerProfile}
            farmerProfile={farmerProfile}
            floating
          />
        </div>}

        {view === 'jicho' && <>
          <div className="agri-jicho-notice"><span className="material-symbols-outlined">info</span>Text replies are curated farm guidance, not live generative AI. Photo scans use Jicho AI and should be confirmed locally.</div>
          <div className="agri-jicho-messages" ref={messageListRef} aria-live="polite">
            {messages.map((message) => <article className={`agri-jicho-message is-${message.sender}`} key={message.id}>
              {message.sender === 'assistant' && <span className="agri-jicho-avatar material-symbols-outlined">eco</span>}
              <div className="agri-jicho-bubble">
                {message.image && <img src={message.image} alt="Crop attached for Jicho scan" />}
                <p>{message.text}</p>
              </div>
            </article>)}
            {isSending && <div className="agri-jicho-status" role="status"><span className="material-symbols-outlined">progress_activity</span>Jicho is checking the photo…</div>}
          </div>
          {error && <p className="agri-jicho-error" role="alert">{error}</p>}
          {messages.length === 1 && <div className="agri-jicho-quick-prompts">
            {quickQuestions.map((question) => <button type="button" key={question} onClick={() => setDraft(question)}>{question}</button>)}
          </div>}
          {selectedImage && <div className="agri-jicho-attachment"><img src={selectedImage.dataUrl} alt="Selected crop preview" /><span>{selectedImage.name}</span><button type="button" aria-label="Remove photo" onClick={() => setSelectedImage(null)}><span className="material-symbols-outlined">close</span></button></div>}
          <form className="agri-jicho-composer" onSubmit={sendMessage}>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageChange} />
            <button type="button" aria-label="Attach crop photo" disabled={isPreparingImage || isSending} onClick={() => fileInputRef.current?.click()}><span className="material-symbols-outlined">{isPreparingImage ? 'progress_activity' : 'add_a_photo'}</span></button>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }} rows="1" maxLength="500" placeholder="Ask about your crop…" aria-label="Ask Jicho about your crop" />
            <button type="submit" className="agri-jicho-send" disabled={isSending || isPreparingImage || (!draft.trim() && !selectedImage)} aria-label="Send message"><span className="material-symbols-outlined">send</span></button>
          </form>
          <p className="agri-jicho-disclaimer">General guidance only. Confirm diagnosis and treatment with an extension officer.</p>
        </>}
      </section>}

      <button
        type="button"
        className={`agri-floating-chat-toggle${isOpen ? ' is-open' : ''}`}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close community and Jicho chat' : 'Open community and Jicho chat'}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="material-symbols-outlined">{isOpen ? 'close' : 'forum'}</span>
        {!isOpen && <span>Community &amp; Jicho</span>}
      </button>
    </div>
  );
}
