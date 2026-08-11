import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { subjectColorVar } from '../../lib/formatters';

const SUGGESTIONS = ['Work', 'Reading', 'Study', 'Exercise'];

/**
 * Subject selection before a session. Functional copy only —
 * "Select a subject", never "Choose a terrain" (PRODUCT_SPEC §3).
 */
export default function SubjectPicker({ selectedId, onSelect }) {
  const [subjects, setSubjects] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadError(null);
    api('/subjects')
      .then((data) => setSubjects(data))
      .catch((err) => setLoadError(err.message));
  };

  useEffect(load, []);

  const createSubject = async (name) => {
    if (busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const created = await api('/subjects', { method: 'POST', body: { name } });
      setSubjects((prev) => [...(prev || []), created]);
      onSelect(created);
      setNewName('');
      setAdding(false);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div>
        <p className="field-error">{loadError}</p>
        <button type="button" className="btn btn-quiet" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (subjects === null) {
    return <p className="field-note">Loading subjects…</p>;
  }

  const isEmpty = subjects.length === 0;

  return (
    <div>
      <div className="subject-row" role="group" aria-label="Select a subject">
        {(isEmpty ? [] : subjects).map((subject) => (
          <button
            key={subject.id}
            type="button"
            className="chip"
            aria-pressed={selectedId === subject.id}
            onClick={() => onSelect(subject)}
          >
            <span
              className="chip-dot"
              style={{ background: subjectColorVar(subject.id) }}
              aria-hidden="true"
            />
            {subject.name}
          </button>
        ))}

        {isEmpty &&
          SUGGESTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className="chip chip-add"
              disabled={busy}
              onClick={() => createSubject(name)}
            >
              + {name}
            </button>
          ))}

        {!adding && (
          <button
            type="button"
            className="chip chip-add"
            onClick={() => setAdding(true)}
          >
            + New subject
          </button>
        )}
      </div>

      {adding && (
        <form
          className="subject-new"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newName.trim();
            if (name) createSubject(name);
          }}
        >
          <input
            autoFocus
            value={newName}
            maxLength={40}
            placeholder="Subject name"
            aria-label="New subject name"
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" className="btn" disabled={busy || !newName.trim()}>
            Add
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setAdding(false);
              setSubmitError(null);
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {submitError && <p className="field-error">{submitError}</p>}
      {isEmpty && !adding && (
        <p className="field-note">Create a subject to begin.</p>
      )}
    </div>
  );
}
