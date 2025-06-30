import { SearchIndex, SearchQuery, SearchResult, SearchIndexEntry } from '../../types/search';
import { CryptoUtils } from '../crypto/CryptoUtils';

/**
 * Very first slice of encrypted SearchIndexService.
 *  - Uses deterministic SHA-256 hashing of lowercase tokens under a salt key.
 *  - Indexed in memory Map. Persistence will be added later.
 */
export class SearchIndexService implements SearchIndex {
  private entries: Map<string, SearchIndexEntry> = new Map(); // key = messageId
  private tokenMap: Map<string, Set<string>> = new Map();     // token -> messageId set
  private readonly salt: Uint8Array;

  constructor(saltKey?: Uint8Array) {
    // salt for deterministic token hashing; predictable across sessions if provided.
    this.salt = saltKey || CryptoUtils.generateRandomBytes(16);
  }

  /** Build full index from message array (minimal fields) */
  async build(messages: { id: string; text: string; session_id?: string; sender?: string; timestamp?: string }[]): Promise<void> {
    this.entries.clear();
    this.tokenMap.clear();
    for (const m of messages) {
      await this.update(m);
    }
  }

  /** Incremental update for single message */
  async update(message: { id: string; text: string; session_id?: string; sender?: string; timestamp?: string }): Promise<void> {
    if (this.entries.has(message.id)) return; // ignore duplicates for now

    const tokens = this.tokenize(message.text);
    const encryptedTerms: string[] = [];

    for (const t of tokens) {
      const enc = await this.encryptToken(t);
      encryptedTerms.push(enc);
      if (!this.tokenMap.has(enc)) this.tokenMap.set(enc, new Set());
      this.tokenMap.get(enc)!.add(message.id);
    }

    const entry: SearchIndexEntry = {
      messageId: message.id,
      sessionId: message.session_id || 'default',
      encryptedTerms,
      createdAt: Date.now()
    };
    this.entries.set(message.id, entry);
  }

  /** Query index and return top N results (simple OR match scoring) */
  async query(q: SearchQuery): Promise<SearchResult[]> {
    const tokens = this.tokenize(q.text);
    const encrypted = await Promise.all(tokens.map(t => this.encryptToken(t)));

    const scoreMap: Map<string, number> = new Map();
    for (const tok of encrypted) {
      const ids = this.tokenMap.get(tok);
      if (!ids) continue;
      for (const id of ids) {
        scoreMap.set(id, (scoreMap.get(id) || 0) + 1);
      }
    }

    const results: SearchResult[] = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(q.offset || 0, (q.offset || 0) + (q.limit || 20))
      .map(([id, score]) => {
        const entry = this.entries.get(id)!;
        return {
          messageId: id,
          sessionId: entry.sessionId,
          score: score / tokens.length,
          timestamp: new Date(entry.createdAt).toISOString(),
          sender: 'unknown'
        } as SearchResult;
      });

    return results;
  }

  /** Placeholder, does nothing for in-memory */
  async optimize(): Promise<void> {}

  // ----------------- helpers -----------------
  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(Boolean);
  }

  private async encryptToken(token: string): Promise<string> {
    // Deterministic: SHA-256(salt || token)
    const enc = new TextEncoder().encode(token);
    const combined = new Uint8Array(this.salt.length + enc.length);
    combined.set(this.salt);
    combined.set(enc, this.salt.length);
    const hash = await crypto.subtle.digest('SHA-256', combined);
    return Buffer.from(hash).toString('hex');
  }
} 