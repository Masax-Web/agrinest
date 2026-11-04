import './AccountSecurityEntry.css';

export default function AccountSecurityEntry({ onOpenSecurity }) {
  return (
    <section className="account-security-entry">
      <div>
        <span className="account-security-entry-icon material-symbols-outlined">shield_lock</span>
        <div>
          <h2>Account security</h2>
          <p>Manage your password and optional PIN sign-in verification.</p>
        </div>
      </div>
      <button type="button" onClick={onOpenSecurity}>Manage account security</button>
    </section>
  );
}
