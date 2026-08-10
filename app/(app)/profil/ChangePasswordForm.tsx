"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-6 flex max-w-sm flex-col gap-4">
      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        Changer mon mot de passe
      </p>
      <label>
        <span className="label">Nouveau mot de passe</span>
        <input
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input"
        />
      </label>
      <label>
        <span className="label">Confirmer le mot de passe</span>
        <input
          type="password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">Mot de passe mis à jour.</p>}
      <button type="submit" disabled={loading} className="btn-secondary">
        {loading ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}
