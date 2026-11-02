import { useState } from 'react';
import api from './lib/api';

export default function SecuritySettings({ user, onClose, onSignedOut }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(Boolean(user?.pin_enabled));

  const handlePin = async (event, shouldRemove = false) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setMessage('');
    try {
      const currentPassword = user?.password_enabled
        ? String(form.get('current_password') || '')
        : '';
      if (shouldRemove) {
        await api.removePin(currentPassword);
        setMessage('PIN sign-in verification has been disabled.');
      } else {
        const pin = String(form.get('pin') || '');
        if (pin !== form.get('confirm_pin')) throw new Error('PIN entries do not match.');
        await api.setPin(currentPassword, pin);
        setMessage('PIN verification is enabled for future sign-ins.');
        setPinEnabled(true);
      }
      if (shouldRemove) setPinEnabled(false);
      formElement.reset();
    } catch (error) {
      setMessage(String(error.message || 'Could not update PIN settings.').replaceAll('_', ' '));
    } finally {
      setBusy(false);
    }
  };

  const handlePassword = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('new_password') || '');
    if (newPassword !== form.get('confirm_password')) {
      setMessage('The new passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api.changePassword(String(form.get('current_password') || ''), newPassword);
      onSignedOut();
    } catch (error) {
      setMessage(String(error.message || 'Could not change password.').replaceAll('_', ' '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="security-settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="security-settings-card" role="dialog" aria-modal="true" aria-labelledby="security-settings-title">
        <button type="button" className="security-settings-close" onClick={onClose} aria-label="Close security settings">×</button>
        <span className="security-settings-eyebrow">ACCOUNT</span>
        <h2 id="security-settings-title">Security settings</h2>
        <p>Signed in as {user?.email || user?.phone || user?.name || 'your AGRI-NEST account'}.</p>
        {message && <p className="security-settings-message" role="status">{message}</p>}

        <form className="security-settings-form" onSubmit={(event) => handlePin(event)}>
          <h3>{pinEnabled ? 'Update PIN verification' : 'Enable PIN verification'}</h3>
          {user?.password_enabled && (
              <label>Current password<input name="current_password" type="password" autoComplete="current-password" required /></label>
          )}
          <label>6–12 digit PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength="6" maxLength="12" autoComplete="new-password" required /></label>
          <label>Confirm PIN<input name="confirm_pin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength="6" maxLength="12" autoComplete="new-password" required /></label>
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : pinEnabled ? 'Update PIN' : 'Enable PIN'}</button>
        </form>

        {pinEnabled && (
          <form className="security-settings-form" onSubmit={(event) => handlePin(event, true)}>
            <h3>Disable PIN verification</h3>
            {user?.password_enabled && (
                <label>Current password<input name="current_password" type="password" autoComplete="current-password" required /></label>
            )}
            <button type="submit" className="security-settings-secondary" disabled={busy}>Disable PIN</button>
          </form>
        )}

        {user?.password_enabled ? (
            <form className="security-settings-form" onSubmit={handlePassword}>
              <h3>Change password</h3>
              <label>Current password<input name="current_password" type="password" autoComplete="current-password" required /></label>
              <label>New password (12–128 characters)<input name="new_password" type="password" minLength="12" maxLength="128" autoComplete="new-password" required /></label>
              <label>Confirm new password<input name="confirm_password" type="password" minLength="12" maxLength="128" autoComplete="new-password" required /></label>
              <button type="submit" className="security-settings-secondary" disabled={busy}>Change password and sign out</button>
            </form>
        ) : (
          <p>For Google-only accounts, PIN changes are accepted for five minutes after sign-in. Password changes require a password-enabled account.</p>
        )}
      </section>
    </div>
  );
}
