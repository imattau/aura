import { useEffect, useState } from "preact/hooks";
import {
  formatNip07Error,
  loginNip07,
  loginNip46,
  loginNsec,
} from "../stores/auth";

interface Props {
  onAuthenticated: (pubkey: string) => void;
}

export function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"choose" | "extension" | "nip46" | "nsec">(
    "choose",
  );
  const [nip07Available, setNip07Available] = useState(true);
  const [connectionString, setConnectionString] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNip07Available("nostr" in window);
  }, []);

  async function handleNip07() {
    if (!nip07Available) {
      setMode("nip46");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pubkey = await loginNip07();
      onAuthenticated(pubkey);
    } catch (caught) {
      setError(formatNip07Error(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleNip46() {
    setLoading(true);
    setError(null);

    try {
      const pubkey = await loginNip46(connectionString);
      onAuthenticated(pubkey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleNsec() {
    setLoading(true);
    setError(null);

    try {
      const pubkey = await loginNsec(secretKey);
      onAuthenticated(pubkey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  function selectExtension() {
    if (!nip07Available) {
      setMode("nip46");
      return;
    }

    setMode("extension");
    setError(null);
  }

  function selectNip46() {
    setMode("nip46");
    setError(null);
  }

  function selectNsec() {
    setMode("nsec");
    setError(null);
  }

  return (
    <dialog class="auth-modal" open aria-labelledby="auth-title">
      <div class="auth-card auth-card--wide">
        <aside class="auth-rail">
          <p class="auth-eyebrow">Login required</p>
          <h2>Choose your signer</h2>
          <p class="auth-copy">
            Aura reads your public key from a browser extension, a remote
            signer, or a trusted local `nsec` for session-only use.
          </p>
          <div class="auth-rail-list">
            <div class="auth-rail-item">
              <span class="auth-rail-label">Extension</span>
              <span>Fastest path when NIP-07 is available.</span>
            </div>
            <div class="auth-rail-item">
              <span class="auth-rail-label">Nostr Connect</span>
              <span>Best for mobile or remote signer flows.</span>
            </div>
            <div class="auth-rail-item">
              <span class="auth-rail-label">nsec paste</span>
              <span>Only for trusted local testing or recovery.</span>
            </div>
          </div>
        </aside>

        <div class="auth-body">
          {mode === "choose" ? (
            <>
              <p class="auth-mode-kicker">Pick a path</p>
              <h2 id="auth-title">Choose your signer</h2>
              {error && <p class="error">{error}</p>}
              <div class="auth-choice-grid">
                <button
                  type="button"
                  class="auth-choice"
                  onClick={selectExtension}
                  disabled={loading || !nip07Available}
                >
                  <span class="auth-choice-title">Extension</span>
                  <span class="auth-choice-copy">
                    {nip07Available
                      ? "Use NIP-07 if your browser already has a signer extension."
                      : "This browser profile is not exposing NIP-07. Use Nostr Connect instead."}
                  </span>
                </button>
                <button
                  type="button"
                  class="auth-choice"
                  onClick={selectNip46}
                  disabled={loading}
                >
                  <span class="auth-choice-title">Nostr Connect</span>
                  <span class="auth-choice-copy">
                    Paste a bunker URI from a remote signer or mobile app.
                  </span>
                </button>
                <button
                  type="button"
                  class="auth-choice"
                  onClick={selectNsec}
                  disabled={loading}
                >
                  <span class="auth-choice-title">Paste nsec</span>
                  <span class="auth-choice-copy">
                    Paste a raw secret key only if you trust this device.
                  </span>
                </button>
              </div>
            </>
          ) : null}

          {mode === "extension" ? (
            <>
              <p class="auth-mode-kicker">Browser extension</p>
              <h2 id="auth-title">Connect your extension</h2>
              <p class="auth-copy">
                {nip07Available
                  ? "Aura will request your public key from the browser extension and keep only that pubkey in memory."
                  : "This browser profile is not exposing NIP-07. Use Nostr Connect instead, or enable the extension for this site."}
              </p>
              {error && <p class="error">{error}</p>}
              <div class="auth-actions">
                <button
                  type="button"
                  onClick={handleNip07}
                  disabled={loading || !nip07Available}
                >
                  {loading ? "Connecting..." : "Continue with extension"}
                </button>
                <button
                  type="button"
                  class="ghost"
                  onClick={selectNip46}
                  disabled={loading}
                >
                  Use Nostr Connect
                </button>
              </div>
            </>
          ) : null}

          {mode === "nip46" ? (
            <>
              <p class="auth-mode-kicker">Remote signer</p>
              <h2 id="auth-title">Connect with Nostr Connect</h2>
              <p class="auth-copy">
                Paste a `bunker://` connection string from your remote signer.
              </p>
              <input
                type="text"
                placeholder="bunker://..."
                value={connectionString}
                onInput={(event) =>
                  setConnectionString((event.target as HTMLInputElement).value)
                }
              />
              {error && <p class="error">{error}</p>}
              <div class="auth-actions">
                <button
                  type="button"
                  onClick={handleNip46}
                  disabled={loading || !connectionString}
                >
                  {loading ? "Connecting..." : "Connect"}
                </button>
                <button
                  type="button"
                  class="ghost"
                  onClick={() => setMode("choose")}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            </>
          ) : null}

          {mode === "nsec" ? (
            <>
              <p class="auth-mode-kicker">Local import</p>
              <h2 id="auth-title">Paste your nsec</h2>
              <p class="auth-copy">
                Aura will keep the secret key only in memory for this session
                and derive your pubkey locally.
              </p>
              <input
                type="password"
                placeholder="nsec1..."
                value={secretKey}
                onInput={(event) =>
                  setSecretKey((event.target as HTMLInputElement).value)
                }
                spellCheck={false}
                autoComplete="off"
              />
              {error && <p class="error">{error}</p>}
              <div class="auth-actions">
                <button
                  type="button"
                  onClick={handleNsec}
                  disabled={loading || !secretKey}
                >
                  {loading ? "Connecting..." : "Connect"}
                </button>
                <button
                  type="button"
                  class="ghost"
                  onClick={() => setMode("choose")}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
